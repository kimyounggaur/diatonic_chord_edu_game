import type { DiatonicTriad, SpelledNote } from '../domain/theory';

type Timbre = 'piano' | 'sine' | 'marimba' | '8bit';
type AudioSettings = { muted: boolean; volume: number; sfxVolume: number; timbre: Timbre };
type PlaybackMode = 'block' | 'arpeggio' | 'scale';

/** One gesture-unlocked synthesizer. No external recordings or network requests. */
class AudioService {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: AudioSettings = { muted: false, volume: 0.65, sfxVolume: 0.35, timbre: 'piano' };
  private voices = new Set<OscillatorNode>();
  private pending = new Map<ReturnType<typeof setTimeout>, () => void>();
  private lastEnd = 0;
  private hasUnlocked = false;
  private generation = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hasUnlocked && this.context?.state === 'suspended') {
          void this.context.resume().catch(() => undefined);
        }
        if (document.visibilityState === 'hidden') this.stop();
      });
    }
  }

  async unlock(): Promise<void> {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.hasUnlocked = this.context.state === 'running';
    } catch { /* Browsers without audio may continue all visual learning. */ }
  }

  configure(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.settings.volume = Math.min(1, Math.max(0, this.settings.volume));
    this.settings.sfxVolume = Math.min(1, Math.max(0, this.settings.sfxVolume));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume, this.context.currentTime, 0.025);
    }
  }

  private async ready(): Promise<boolean> {
    await this.unlock();
    return Boolean(this.hasUnlocked && this.context && this.master && !this.settings.muted);
  }

  private midiNotes(notes: SpelledNote[]): number[] {
    let previous = -Infinity;
    return notes.map(note => {
      let midi = 60 + note.midiClass;
      while (midi <= previous) midi += 12;
      previous = midi;
      return midi;
    });
  }

  private voice(midi: number, start: number, duration: number, amplitude = 0.24): void {
    if (!this.context || !this.master) return;
    const context = this.context;
    const envelope = context.createGain();
    envelope.connect(this.master);
    const peak = Math.max(0.0001, amplitude);
    const timbre = this.settings.timbre;
    const decay = timbre === 'marimba' ? 0.13 : timbre === 'piano' ? 0.24 : 0.35;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(peak * decay, start + Math.min(duration * 0.5, 0.32));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const fundamental = 440 * Math.pow(2, (midi - 69) / 12);
    const harmonics = timbre === 'piano' ? [[1, 0.78], [2, 0.16], [3, 0.06]] : timbre === 'marimba' ? [[1, 0.85], [4, 0.15]] : [[1, 1]];
    let remaining = harmonics.length;
    for (const [multiple, strength] of harmonics) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = timbre === '8bit' ? 'triangle' : 'sine';
      oscillator.frequency.value = fundamental * multiple;
      gain.gain.value = strength;
      oscillator.connect(gain);
      gain.connect(envelope);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
        remaining -= 1;
        if (remaining === 0) envelope.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.025);
    }
    this.lastEnd = Math.max(this.lastEnd, start + duration);
  }

  private wait(seconds: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.pending.delete(timer); resolve(); }, Math.max(0, seconds * 1000));
      this.pending.set(timer, resolve);
    });
  }

  async playNotes(notes: SpelledNote[], mode: PlaybackMode = 'block', bpm = 80): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (!notes.length || !(await this.ready()) || !this.context || generation !== this.generation) return;
    const beat = 60 / Math.min(240, Math.max(30, bpm));
    const spacing = mode === 'block' ? 0 : beat * 0.42;
    const duration = mode === 'scale' ? beat * 0.55 : beat * 1.4;
    const start = this.context.currentTime + 0.025;
    this.midiNotes(notes).forEach((midi, index) => this.voice(midi, start + spacing * index, duration, mode === 'block' ? 0.16 : 0.23));
    await this.wait(spacing * (notes.length - 1) + duration + 0.04);
  }

  async playProgression(chords: DiatonicTriad[], bpm = 80, rhythm: 'block' | 'arpeggio' = 'block'): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (!chords.length || !(await this.ready()) || !this.context || generation !== this.generation) return;
    const beat = 60 / Math.min(240, Math.max(30, bpm));
    const chordLength = beat * 2;
    const start = this.context.currentTime + 0.025;
    chords.forEach((chord, index) => {
      const chordStart = start + index * chordLength;
      this.midiNotes(chord.notes).forEach((midi, voiceIndex) => {
        this.voice(midi, chordStart + (rhythm === 'arpeggio' ? voiceIndex * beat * 0.45 : 0), chordLength * 0.88, 0.15);
      });
      // A quiet bass makes the tonal centre audible without changing the spelling.
      this.voice(48 + chord.notes[0].midiClass, chordStart, chordLength * 0.95, 0.12);
    });
    await this.wait(chords.length * chordLength + 0.04);
  }

  success(): void {
    if (!this.context || !this.hasUnlocked || this.settings.muted || this.settings.sfxVolume === 0) return;
    const start = Math.max(this.context.currentTime, this.lastEnd) + 0.2;
    [79, 84].forEach((midi, i) => this.voice(midi, start + i * 0.1, 0.36, 0.12 * this.settings.sfxVolume));
  }

  stop(): void {
    this.generation += 1;
    for (const oscillator of this.voices) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
    }
    this.voices.clear();
    for (const [timer, resolve] of this.pending) { clearTimeout(timer); resolve(); }
    this.pending.clear();
    this.lastEnd = this.context?.currentTime ?? 0;
  }
}

export const audio = new AudioService();
export default audio;
