/** Spelling-aware diatonic theory. No browser or UI dependencies. */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = 'bb' | 'b' | 'natural' | '#' | '##';
export type Mode = 'major' | 'naturalMinor' | 'harmonicMinor';
export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';
export type HarmonicFunction = 'tonic' | 'predominant' | 'dominant';
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TemplateId = 'scale' | 'stack' | 'quality' | 'roman' | 'function' | 'progression' | 'relative';
export interface SpelledNote { letter: Letter; accidental: Accidental; midiClass: number; display: string }
export interface ScaleSource { tonic: SpelledNote; mode: Mode }
export interface KeyDefinition extends ScaleSource {
  id: string;
  koreanName: string;
  keySignature: Partial<Record<Letter, Accidental>>;
  scale: SpelledNote[];
  relativeKeyId?: string;
  enharmonicAliasIds?: string[];
  progression: number[];
  signatureCount: number;
  worldId: string;
  mapOrder: number;
  themeId: string;
  unlockPrerequisite?: string;
}
export interface DiatonicTriad {
  degree: Degree;
  notes: [SpelledNote, SpelledNote, SpelledNote];
  quality: ChordQuality;
  romanNumeral: string;
  symbol: string;
  function: HarmonicFunction;
}
export interface LevelDefinition {
  id: string;
  keyId: string;
  worldId: string;
  templateId: TemplateId;
  title: string;
  difficulty: number;
  seed: string;
  learningObjectives: string[];
  order: number;
}
export interface ValidationResult { valid: boolean; errors: string[] }
export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_OFFSET: Record<Accidental, number> = { bb: -2, b: -1, natural: 0, '#': 1, '##': 2 };
const OFFSET_ACCIDENTAL: Record<number, Accidental> = { [-2]: 'bb', [-1]: 'b', 0: 'natural', 1: '#', 2: '##' };
const ACCIDENTAL_DISPLAY: Record<Accidental, string> = { bb: 'bb', b: '♭', natural: '', '#': '♯', '##': '##' };
export const SCALE_PATTERNS: Record<Mode, readonly number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  naturalMinor: [2, 1, 2, 2, 1, 2, 2],
  harmonicMinor: [2, 1, 2, 2, 1, 3, 1],
};
export const QUALITY_LABELS: Record<ChordQuality, string> = { major: '장3화음', minor: '단3화음', diminished: '감3화음', augmented: '증3화음' };
export const FUNCTION_LABELS: Record<HarmonicFunction, string> = { tonic: '토닉 · 집', predominant: '프리도미넌트 · 길', dominant: '도미넌트 · 문' };
const mod12 = (n: number) => ((n % 12) + 12) % 12;
function checkDegree(degree: number): asserts degree is Degree {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) throw new RangeError('도수는 1~7의 정수여야 합니다.');
}
function spell(letter: Letter, accidental: Accidental): SpelledNote {
  return { letter, accidental, midiClass: mod12(NATURAL_PC[letter] + ACCIDENTAL_OFFSET[accidental]), display: letter + ACCIDENTAL_DISPLAY[accidental] };
}
/** Accepts ASCII and Unicode accidentals; double accidentals are preserved. */
export function parseNote(value: string): SpelledNote {
  const normalized = value.trim().replaceAll('𝄪', '##').replaceAll('𝄫', 'bb').replaceAll('♯', '#').replaceAll('♭', 'b').replaceAll('♮', '');
  const match = /^([A-Ga-g])(bb|b|##|#)?$/.exec(normalized);
  if (!match) throw new Error(`지원하지 않는 음이름: ${value}`);
  return spell(match[1].toUpperCase() as Letter, (match[2] || 'natural') as Accidental);
}
/** Letter order is chosen before accidentals, so Gb's fourth is Cb, never B. */
export function buildScale(key: ScaleSource): SpelledNote[] {
  const start = LETTERS.indexOf(key.tonic.letter);
  if (start < 0 || !SCALE_PATTERNS[key.mode]) throw new Error('유효한 으뜸음과 음계 종류가 필요합니다.');
  let offset = 0;
  return Array.from({ length: 7 }, (_, degree) => {
    if (degree) offset += SCALE_PATTERNS[key.mode][degree - 1];
    const letter = LETTERS[(start + degree) % 7];
    const target = mod12(key.tonic.midiClass + offset);
    const distance = mod12(target - NATURAL_PC[letter]);
    const signed = distance > 6 ? distance - 12 : distance;
    const accidental = OFFSET_ACCIDENTAL[signed];
    if (!accidental) throw new Error(`${letter}음에 겹임시표 범위를 넘는 표기가 필요합니다.`);
    return spell(letter, accidental);
  });
}
export function getTriadIntervals(notes: readonly SpelledNote[]): [number, number] {
  if (notes.length !== 3) throw new Error('3화음에는 세 음이 필요합니다.');
  return [mod12(notes[1].midiClass - notes[0].midiClass), mod12(notes[2].midiClass - notes[1].midiClass)];
}
export function identifyTriadQuality(notes: readonly SpelledNote[]): ChordQuality {
  const pair = getTriadIntervals(notes).join(',');
  const quality = ({ '4,3': 'major', '3,4': 'minor', '3,3': 'diminished', '4,4': 'augmented' } as const)[pair as '4,3'];
  if (!quality) throw new Error(`3도 쌓기 화음이 아닙니다: ${pair}`);
  return quality;
}
export function getRomanNumeral(mode: Mode, degree: number, quality?: ChordQuality): string {
  checkDegree(degree);
  const patterns: Record<Mode, readonly ChordQuality[]> = {
    major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'],
    naturalMinor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
    harmonicMinor: ['minor', 'diminished', 'augmented', 'minor', 'major', 'major', 'diminished'],
  };
  const actual = quality || patterns[mode][degree - 1];
  const base = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree - 1];
  return (actual === 'minor' || actual === 'diminished' ? base.toLowerCase() : base) + (actual === 'diminished' ? '°' : actual === 'augmented' ? '+' : '');
}
export function getHarmonicFunction(_mode: Mode, degree: number): HarmonicFunction {
  checkDegree(degree);
  // Introductory grouping; harmonic-minor raised leading tone remains dominant.
  if (degree === 2 || degree === 4) return 'predominant';
  if (degree === 5 || degree === 7) return 'dominant';
  return 'tonic';
}
export function buildDiatonicTriad(key: ScaleSource, degree: number): DiatonicTriad {
  checkDegree(degree);
  const scale = buildScale(key);
  const notes = [scale[degree - 1], scale[(degree + 1) % 7], scale[(degree + 3) % 7]] as DiatonicTriad['notes'];
  const quality = identifyTriadQuality(notes);
  const suffix: Record<ChordQuality, string> = { major: '', minor: 'm', diminished: 'dim', augmented: 'aug' };
  return { degree, notes, quality, romanNumeral: getRomanNumeral(key.mode, degree, quality), symbol: notes[0].display + suffix[quality], function: getHarmonicFunction(key.mode, degree) };
}
export function buildAllDiatonicTriads(key: ScaleSource): DiatonicTriad[] {
  return Array.from({ length: 7 }, (_, index) => buildDiatonicTriad(key, index + 1));
}
/** Transposition follows degree and checks case/quality, rather than ignoring a wrong Roman spelling. */
export function transposeProgression(romanNumerals: string[], key: ScaleSource): DiatonicTriad[] {
  const triads = buildAllDiatonicTriads(key);
  return romanNumerals.map(roman => {
    const triad = triads.find(item => item.romanNumeral === roman);
    if (!triad) throw new Error(`이 음계에 없는 로마 숫자: ${roman}`);
    return triad;
  });
}
/** Each proposed note must have its diatonic letter and accidental, not merely an equal pitch. */
export function validateSpelling(notes: readonly SpelledNote[], key: ScaleSource): ValidationResult {
  const scale = buildScale(key);
  const errors = notes.flatMap(note => {
    const expected = scale.find(candidate => candidate.letter === note.letter);
    if (!expected || expected.accidental !== note.accidental || expected.midiClass !== note.midiClass || note.display !== expected.display) {
      return [`${note.display}의 철자 또는 음높이를 조표와 확인하세요.${expected ? ` 이 조성의 ${note.letter}음은 ${expected.display}입니다.` : ''}`];
    }
    return [];
  });
  return { valid: errors.length === 0, errors };
}
