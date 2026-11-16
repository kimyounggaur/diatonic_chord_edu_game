import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Hand, HelpCircle, Music2, RotateCcw, Sparkles, Star, Volume2 } from 'lucide-react';
import type { DiatonicTriad, LevelDefinition, SpelledNote } from '../domain/theory';
import { buildAllDiatonicTriads, buildDiatonicTriad, getTriadIntervals, SCALE_PATTERNS } from '../domain/theory';
import { getKey, LEVELS, WORLDS } from '../data/worlds';
import { calculateAttemptScore, calculateStars } from '../domain/learning';
import type { LearningConcept } from '../domain/learning';
import { createSeededQuestionSet, shuffleSeeded } from '../domain/questions';
import { useGameStore } from '../storage/store';
import { audio } from '../audio/AudioService';

type Kind = 'scale' | 'halfsteps' | 'tower' | 'quality' | 'roman' | 'function' | 'timeline' | 'playback' | 'resolution' | 'relative';
interface Task {
  id: string;
  kind: Kind;
  title: string;
  prompt: string;
  rule: string;
  explanation: string;
  correct: string[];
  options: string[];
  degree?: number;
  notes?: SpelledNote[];
  triad?: DiatonicTriad;
  prefill?: string[];
  npc?: string;
  audioOnly?: boolean;
}
const qualityNames: Record<string, string> = { major: '장 · M', minor: '단 · m', diminished: '감 · °', augmented: '증 · +' };
const functionNames: Record<string, string> = { tonic: '집 · 토닉', predominant: '길 · 프리도미넌트', dominant: '문 · 도미넌트' };
const QUALITY_OPTIONS = Object.values(qualityNames);
const FUNCTION_OPTIONS = Object.values(functionNames);
const conceptFor: Record<string, LearningConcept> = { scale: 'scaleSpelling', stack: 'stackedThirds', quality: 'triadQuality', roman: 'romanNumeral', function: 'harmonicFunction', progression: 'stackedThirds', relative: 'relativeKey' };
const conceptDescriptions: Record<string, string> = {
  scaleSpelling: '조표를 지켜 일곱 음의 음계 만들기', keySignature: '모든 같은 음에 조표를 적용하기',
  stackedThirds: '음계에서 한 칸씩 건너뛰며 1·3·5 쌓기', triadQuality: '두 3도의 반음 수로 화음 품질 구별하기',
  romanNumeral: '코드 이름과 로마 숫자 연결하기', harmonicFunction: '토닉·프리도미넌트·도미넌트의 역할 알기',
  relativeKey: '같은 음과 다른 으뜸음을 가진 상대조 비교하기', auralQuality: '화음의 간격을 눈과 귀로 함께 확인하기',
};
const noteLabels: Record<string, string> = { C: '다', D: '라', E: '마', F: '바', G: '사', A: '가', B: '나' };
const solfege: Record<string, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };

function makeTasks(level: LevelDefinition): Task[] {
  const key = getKey(level.keyId);
  const scale = key.scale;
  const triads = buildAllDiatonicTriads(key);
  const scaleNames = scale.map(n => n.display);
  const degrees = createSeededQuestionSet(level, 7).map(q => q.degree);
  const tower = (degree: number, id: string): Task => {
    const t = triads[degree - 1];
    return { id, kind: 'tower', degree, triad: t, title: `${degree}도에서 화음 탑 쌓기`, prompt: '루트에서 한 칸 건너뛰고, 다시 한 칸 건너뛰어 주세요.', rule: '3도 쌓기는 음계의 칸으로 세어요. 바로 이웃한 음 대신 하나를 건너뛰어요.', explanation: `${t.notes.map(n => n.display).join(' – ')}. 음계에서 +2칸, 다시 +2칸 이동했어요. ${t.romanNumeral} 화음이 완성됐어요.`, correct: t.notes.map(n => n.display), prefill: [t.notes[0].display], options: scaleNames, notes: t.notes, npc: '테르티' };
  };
  const quality = (degree: number, id: string): Task => {
    const t = triads[degree - 1];
    const [a, b] = getTriadIntervals(t.notes);
    return { id, kind: 'quality', degree, triad: t, title: '두 개의 3도를 관찰해요', prompt: `${t.notes.map(n => n.display).join(' – ')}의 품질 인장을 골라 주세요.`, rule: '아래 3도와 위 3도의 반음 수를 따로 세어요. 4+3 장, 3+4 단, 3+3 감, 4+4 증이에요.', explanation: `${a} + ${b} 반음이므로 ${qualityNames[t.quality]} 3화음이에요. ${t.symbol} = ${t.romanNumeral}.`, correct: [qualityNames[t.quality]], options: QUALITY_OPTIONS, notes: t.notes, npc: '센토' };
  };
  switch (level.templateId) {
    case 'scale': {
      const halfsteps = SCALE_PATTERNS[key.mode].flatMap((distance, i) => distance === 1 ? [String(i)] : []);
      const distractors = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'F♯', 'B♭', 'C♯', 'E♭'].filter(n => !scaleNames.includes(n)).slice(0, 3);
      return [
        { id: 'scale', kind: 'scale', title: '흩어진 음계 조각을 모아요', prompt: `${scale[0].display}부터 음이름 글자 순서대로 배열해 주세요.`, rule: '음이름 글자는 A–G를 한 번씩 지나가요. 조표가 있으면 그 글자의 모든 음에 적용해요.', explanation: `${scaleNames.join(' – ')}. 재료 상자인 음계가 완성됐어요!`, correct: scaleNames, prefill: [scale[0].display], options: shuffleSeeded([...scaleNames, ...distractors], level.seed), notes: scale, npc: '루미' },
        { id: 'halfsteps', kind: 'halfsteps', title: '반음 발판 두 곳을 찾아요', prompt: '음계에서 간격이 가장 가까운 두 구간을 골라 주세요. 마지막 음 다음은 한 옥타브 높은 으뜸음이에요.', rule: '전음은 2반음, 반음은 1반음이에요. 음계 패턴에서 반(1)인 두 위치를 찾아요.', explanation: halfsteps.map(i => `${scale[+i].display}–${scale[(+i + 1) % 7].display}`).join(', ') + '가 반음이에요.', correct: halfsteps, options: scaleNames.map((_, i) => String(i)), notes: scale, npc: '센토' },
      ];
    }
    case 'stack': return degrees.map((d, i) => tower(d, `stack-${i}`));
    case 'quality': return degrees.map((d, i) => quality(d, `quality-${i}`));
    case 'roman': return [
      ...degrees.map((d, i): Task => {
        const t = triads[d - 1];
        return { id: `roman-${i}`, kind: 'roman', degree: d, triad: t, title: '화음을 로마 숫자로 기록해요', prompt: `${key.tonic.display}에서 ${d}번째 음 위에 쌓은 ${t.symbol}은 어떤 로마 숫자일까요?`, rule: '도수는 숫자, 품질은 대소문자로 나타내요. 장은 대문자, 단은 소문자, 감은 °를 붙여요.', explanation: `${t.symbol} = ${t.romanNumeral}. ${d}도와 ${qualityNames[t.quality]} 품질을 함께 읽은 표기예요.`, correct: [t.romanNumeral], options: triads.map(x => x.romanNumeral), notes: t.notes, npc: '로마' };
      }),
      { ...tower(4, 'roman-build'), title: `${triads[3].romanNumeral}를 음으로 번역해요`, prompt: `${key.tonic.display}에서 4번째 음을 루트로, 1·3·5를 만들어 주세요.` },
      { id: 'roman-ear', kind: 'roman', degree: 6, triad: triads[5], title: '듣고 로마 숫자를 연결해요', prompt: '듣기 버튼으로 화음을 듣고 도수를 골라 주세요. 눈으로 보기 버튼으로 구성음을 확인할 수 있어요.', rule: '품질만으로 도수를 단정하지 않아요. 이 문제는 6도 화음이며 조성 안의 구성음을 함께 확인해요.', explanation: `${triads[5].notes.map(n => n.display).join(' – ')}는 ${triads[5].romanNumeral}이에요.`, correct: [triads[5].romanNumeral], options: triads.map(t => t.romanNumeral), notes: triads[5].notes, audioOnly: true, npc: '로마' },
    ];
    case 'function': return [
      ...triads.map((t, i): Task => ({ id: `function-${i}`, kind: 'function', degree: i + 1, triad: t, title: '화음이 머무를 섬을 찾아요', prompt: `${t.symbol} (${t.romanNumeral})의 입문 기본 기능은 무엇일까요?`, rule: key.mode === 'major' ? '토닉 I·iii·vi / 프리도미넌트 ii·IV / 도미넌트 V·vii°. 문맥에 따라 역할은 달라질 수 있어요.' : '토닉 i·III·VI / 프리도미넌트 ii°·iv / 도미넌트 계열 v·VII. 자연단조 v는 단화음이에요.', explanation: `${t.romanNumeral}는 ${functionNames[t.function]} 기능으로 분류해요. 실제 곡에서는 앞뒤 문맥도 함께 들어요.`, correct: [functionNames[t.function]], options: FUNCTION_OPTIONS, notes: t.notes, npc: '도미나' })),
      { id: 'function-resolve', kind: 'resolution', title: '긴장을 집으로 돌려보내요', prompt: `${triads[4].symbol} 뒤에 으뜸화음을 놓아 해소를 들어 보세요.`, rule: '도미넌트 뒤의 토닉이 중심으로 돌아오는 느낌을 만들어요. 자연단조 v의 긴장은 장조 V보다 약해요.', explanation: `${triads[4].romanNumeral} → ${triads[0].romanNumeral}, ${triads[4].symbol} → ${triads[0].symbol}. 긴장과 해소를 비교해 보세요.`, correct: [triads[0].symbol], options: triads.map(t => t.symbol), notes: triads[0].notes, npc: '도미나' },
    ];
    case 'progression': {
      const progression = key.progression.map(d => triads[d - 1]);
      return [
        ...key.progression.flatMap((d, i) => [tower(d, `boss-build-${i}`), quality(d, `boss-quality-${i}`)]),
        { id: 'timeline', kind: 'timeline', title: '네 화음을 타임라인에 연결해요', prompt: `${progression.map(t => t.romanNumeral).join(' → ')} 순서로 코드를 놓아 주세요.`, rule: '각 로마 숫자의 도수와 품질을 확인하고 같은 순서로 배열해요.', explanation: `${progression.map(t => t.symbol).join(' → ')}. 직접 만든 화음이 하나의 진행이 됐어요.`, correct: progression.map(t => t.symbol), options: [...progression.map(t => t.symbol)].reverse(), npc: '도미나' },
        { id: 'playback', kind: 'playback', title: '복원한 진행을 연주해요', prompt: '리듬을 고르고 전체 진행을 들어 주세요. 재생이 끝나면 마지막 해결을 만들어 봐요.', rule: '듣기는 몇 번 반복해도 감점하지 않아요.', explanation: '네 화음의 연결을 들었어요. 마지막에는 중심으로 돌아가 볼까요?', correct: ['listened'], options: [], npc: '루미' },
        { id: 'boss-resolve', kind: 'resolution', title: '마지막 코어를 중심에 맞춰요', prompt: `${progression[3].symbol} 뒤에 으뜸화음을 붙여 마무리해 주세요.`, rule: '진행의 마지막 화음과 별개로, 이 조성의 1도 화음이 으뜸화음이에요.', explanation: `${triads[0].symbol}로 중심을 확인했어요. ${key.koreanName}의 화성 코어가 복원됐어요!`, correct: [triads[0].symbol], options: triads.map(t => t.symbol), notes: triads[0].notes, npc: '도미나' },
      ];
    }
    case 'relative': {
      const relative = getKey(key.relativeKeyId!);
      const relativeTriads = buildAllDiatonicTriads(relative);
      const shared = triads[0];
      const match = relativeTriads.find(t => t.symbol === shared.symbol)!;
      return [
        { id: 'relative-notes', kind: 'relative', title: '같은 재료, 다른 중심', prompt: '두 음계를 비교해 보세요. 상대조의 관계를 가장 정확하게 설명하는 카드를 골라 주세요.', rule: '상대장조와 자연단조는 조표와 사용 음을 공유하지만 으뜸음이 달라요.', explanation: '같은 조표·같은 음을 사용해도 출발점과 중심음이 달라져요.', correct: ['같은 음 · 다른 으뜸음'], options: ['같은 음 · 다른 으뜸음', '같은 으뜸음 · 다른 음', '조표와 구성음이 모두 다름'], npc: '루미' },
        { id: 'relative-roman', kind: 'relative', title: '하나의 화음, 두 개의 도수', prompt: `${shared.symbol}는 ${key.koreanName}에서 ${shared.romanNumeral}. ${relative.koreanName}에서는 무엇일까요?`, rule: '로마 숫자는 현재 으뜸음에서 센 도수예요. 중심이 바뀌면 같은 화음도 도수가 바뀌어요.', explanation: `${shared.symbol}는 ${key.koreanName}의 ${shared.romanNumeral}, ${relative.koreanName}의 ${match.romanNumeral}이에요.`, correct: [match.romanNumeral], options: relativeTriads.map(t => t.romanNumeral), notes: shared.notes, npc: '로마' },
        { id: 'relative-context', kind: 'relative', title: '무엇이 중심을 만들까요?', prompt: '두 진행을 듣고 조성의 중심을 판단할 때 어떤 단서를 함께 살펴야 할까요?', rule: '하나의 코드만으로 조성을 확정하지 않아요. 진행 전체의 맥락을 들어요.', explanation: '시작 코드, 마지막 해결, 반복되는 베이스, 강박을 함께 살펴요. 같은 코드 재료로도 중심감이 달라질 수 있어요.', correct: ['시작·해결·베이스를 함께'], options: ['시작·해결·베이스를 함께', '첫 코드 하나만으로 확정', '장화음이 많으면 무조건 장조'], npc: '도미나' },
      ];
    }
    default: return [tower(1, 'default')];
  }
}

export default function LevelPlayer({ level, onExit, onNext, onPhaseChange }: { level: LevelDefinition; onExit: () => void; onNext: (level: LevelDefinition) => void; onPhaseChange?: (playing:boolean) => void }) {
  const { settings, completeLevel, addReview } = useGameStore();
  const key = getKey(level.keyId);
  const tasks = useMemo(() => makeTasks(level), [level.id]);
  const [screen, setScreen] = useState<'intro' | 'game' | 'result'>('intro');
  useEffect(() => { onPhaseChange?.(screen === 'game'); return () => onPhaseChange?.(false); }, [screen, onPhaseChange]);
  const [index, setIndex] = useState(0);
  const task = tasks[Math.min(index, tasks.length - 1)];
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [hints, setHints] = useState(0);
  const [assisted, setAssisted] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [assistedEver, setAssistedEver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showNotes, setShowNotes] = useState(!task.audioOnly || settings.visualAudio);
  const [rhythm, setRhythm] = useState<'block' | 'arpeggio'>('block');
  const [listened, setListened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragRef = useRef<{ value: string; x: number; y: number; moved: boolean } | null>(null);
  const completedRef = useRef(false);
  const alive = useRef(true);
  const signatureNotes = Object.entries(key.keySignature).map(([letter, accidental]) => letter + (accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental === '##' ? '##' : accidental === 'bb' ? 'bb' : ''));
  const triads = useMemo(() => buildAllDiatonicTriads(key), [key.id]);
  const progression = key.progression.map(d => triads[d - 1]);
  const relative = key.relativeKeyId ? getKey(key.relativeKeyId) : undefined;
  const world = WORLDS.find(w => w.id === level.worldId);
  const isSlots = ['scale', 'tower', 'timeline'].includes(task.kind);
  const highlightedNotes = new Set(task.kind === 'halfsteps'
    ? task.correct.flatMap(i => [key.scale[Number(i)].display, key.scale[(Number(i) + 1) % 7].display])
    : task.notes?.map(n => n.display) || task.correct);

  useEffect(() => { alive.current = true; return () => { alive.current = false; audio.stop(); }; }, []);
  useEffect(() => {
    audio.stop();
    setScreen('intro'); setIndex(0); setScores([]); setAssistedEver(false); setLeaveConfirm(false); completedRef.current = false;
  }, [level.id]);
  useEffect(() => {
    setAnswers(task.prefill || []); setSelectedSlot(null); setErrors(0); setHints(0); setAssisted(false); setAutoReveal(false); setSuccess(false); setFeedback(''); setShowNotes(!task.audioOnly || settings.visualAudio); setListened(false);
  }, [index, task.id]);
  useEffect(() => {
    if (!leaveConfirm) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>('.confirm-modal');
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setLeaveConfirm(false); }
      if (event.key !== 'Tab' || !panel) return;
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); before?.focus(); };
  }, [leaveConfirm]);

  const label = (value: string) => settings.ascii ? value.replaceAll('♯', '#').replaceAll('♭', 'b') : value;
  const answerLabel = (value: string) => task.kind === 'halfsteps' ? `${label(key.scale[Number(value)].display)}–${label(key.scale[(Number(value) + 1) % 7].display)}` : value === 'listened' ? '진행 전체 확인' : label(value);
  const noteSub = (value: string) => settings.noteLabels === 'korean' ? noteLabels[value[0]] || '' : settings.noteLabels === 'solfege' ? (solfege[value[0]] || '') + value.slice(1) : '';
  const place = (value: string, slot?: number) => {
    if (success || autoReveal) return;
    if (task.kind === 'halfsteps') {
      setAnswers(old => old.includes(value) ? old.filter(v => v !== value) : old.length < task.correct.length ? [...old, value] : [...old.slice(1), value]);
      return;
    }
    if (!isSlots) { setAnswers([value]); return; }
    const fixed = task.prefill?.length || 0;
    const target = slot ?? selectedSlot ?? answers.findIndex((a, i) => i >= fixed && !a);
    const effective = target === -1 || target === null ? Math.max(fixed, answers.length) : target;
    if (effective >= task.correct.length || effective < fixed) return;
    setAnswers(old => { const next = [...old]; next[effective] = value; return next; });
    setSelectedSlot(null);
    if (task.kind !== 'timeline') { const n = key.scale.find(n => n.display === value); if (n) void audio.playNotes([n]); }
  };
  const removeSlot = (slot: number) => {
    if (success || autoReveal || slot < (task.prefill?.length || 0)) return;
    setAnswers(old => { const next = [...old]; next[slot] = ''; return next; });
    setSelectedSlot(slot);
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, value: string) => {
    if (event.button !== 0 || !isSlots || autoReveal || success) return;
    dragRef.current = { value, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && Math.hypot(event.clientX - d.x, event.clientY - d.y) > 8) { d.moved = true; setDragging(d.value); }
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.moved) {
      const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      if (el) place(d.value, Number(el.dataset.slot));
      event.preventDefault();
    }
    setDragging(null);
    // Keep this flag until the synthetic click has been suppressed.
    if (d.moved) window.setTimeout(() => { dragRef.current = null; }, 0); else dragRef.current = null;
  };
  const play = async (mode: 'block' | 'arpeggio' | 'scale' = 'block') => {
    if (playing) return;
    setPlaying(true);
    try {
      await audio.unlock();
      if (task.kind === 'timeline' || task.kind === 'playback') await audio.playProgression(progression, 80, rhythm);
      else if (task.kind === 'resolution') await audio.playProgression([progression[progression.length - 1], triads[0]], 80, rhythm);
      else await audio.playNotes(task.notes || key.scale, mode, 80);
      if (alive.current) setListened(true);
    } finally { if (alive.current) setPlaying(false); }
  };
  const correctNow = () => task.kind === 'playback' ? listened : task.kind === 'halfsteps' ? answers.length === task.correct.length && [...answers].sort().join('|') === [...task.correct].sort().join('|') : answers.length === task.correct.length && answers.every((a, i) => a === task.correct[i]);
  const validate = () => {
    if (success || autoReveal) return;
    if (correctNow()) {
      setSuccess(true); setFeedback(task.explanation); audio.success();
      if (settings.vibration && navigator.vibrate) navigator.vibrate(30);
      if (task.kind === 'scale') void play('scale');
      if (task.kind === 'tower' || task.kind === 'resolution') void play();
      return;
    }
    const nextErrors = errors + 1;
    setErrors(nextErrors);
    addReview(key.id, conceptFor[level.templateId] || 'stackedThirds', task.degree || 1);
    if (nextErrors >= 3) {
      setAssisted(true); setAssistedEver(true); setAutoReveal(true); setAnswers(task.correct);
      setFeedback('완성 경로를 함께 확인해요. 아래의 ‘직접 다시 만들기’를 눌러 같은 문제를 다시 완성하면 통과할 수 있어요.');
    } else {
      setFeedback(nextErrors === 1 ? task.rule : `${task.rule} 조표와 강조된 음계 위치를 한 번 더 살펴보세요.`);
    }
  };
  const next = () => {
    const score = calculateAttemptScore(errors, hints, assisted);
    const updated = [...scores, score];
    setScores(updated);
    if (index < tasks.length - 1) { setIndex(index + 1); return; }
    if (!completedRef.current) { completeLevel(level, updated, assistedEver || assisted); completedRef.current = true; }
    setScreen('result');
  };
  const replay = () => { setAutoReveal(false); setAnswers(task.prefill || []); setSelectedSlot(null); setFeedback('이제 직접 같은 문제를 재현해 주세요. 천천히 해도 괜찮아요.'); };
  const hint = () => { if (success || autoReveal) return; setHints(hints + 1); setFeedback(`${task.rule}${hints > 0 ? ` ${task.explanation}` : ''}`); };
  const exit = () => screen === 'game' && !leaveConfirm ? setLeaveConfirm(true) : onExit();
  const candidateNextLevel = LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];
  const nextLevel = candidateNextLevel && (!WORLDS.find(w => w.id === candidateNextLevel.worldId)?.advanced || settings.advanced) ? candidateNextLevel : undefined;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const stars = calculateStars(scores, assistedEver);

  if (screen === 'intro') return <section className="level-intro">
    <button className="text-button" onClick={onExit}><ArrowLeft size={18} /> 지도 돌아가기</button>
    <div className="level-eyebrow">{world?.name || '톤테라'} · {key.mode === 'major' ? '태양 도시' : '달 동굴'}</div>
    <div className="intro-card">
      <div className="intro-symbol"><Music2 size={42}/></div>
      <span className="eyebrow">새로운 복원 임무</span>
      <h1>{level.title}</h1><p>{key.koreanName} · 약 {level.templateId === 'progression' ? '5' : '3'}분</p>
      <div className="signature-panel"><span>{key.tonic.display} {key.mode === 'major' ? 'Major' : 'Natural minor'}</span><strong>{signatureNotes.length ? signatureNotes.join(' · ') : '조표 없음 ♮'}</strong></div>
      {key.mode === 'naturalMinor' && <p className="input-help">자연단조의 v는 {label(triads[4].symbol)}인 단화음이에요. 7음을 올리는 화성단음계는 자유 연습의 별도 모드에서 다뤄요.</p>}
      <ul className="objective-list">{level.learningObjectives.map((o, i) => <li key={i}><Check size={17}/>{conceptDescriptions[o] || o}</li>)}</ul>
      <div className="npc-dialogue"><span className="npc-avatar">✦</span><div><strong>루미</strong><p>답을 외우지 않아도 괜찮아. 음계에서 하나씩 건너뛰면 화음이 보여!</p></div></div>
      <button className="primary-button" onClick={() => { void audio.unlock(); setScreen('game'); }}>복원 시작하기 <ArrowRight size={19}/></button>
      <small>듣기는 감점 없음 · 목숨과 시간 제한 없음</small>
    </div>
  </section>;

  if (screen === 'result') return <section className="result-panel">
    <span className="eyebrow">RESTORATION COMPLETE</span><div className="result-stars" aria-label={`별 ${stars}개`}>{[1, 2, 3].map(n => <Star key={n} size={52} fill={n <= stars ? 'currentColor' : 'none'} className={n <= stars ? 'earned' : ''}/>)}</div>
    <h1>빛이 다시 연결됐어요!</h1><p>{key.koreanName} · {level.title}</p>
    <div className="result-stats"><div><strong>{avg}</strong><span>평균 점수</span></div><div><strong>{tasks.length}</strong><span>완성한 과제</span></div><div><strong>{assistedEver ? '함께' : '스스로'}</strong><span>이번 복원</span></div></div>
    <div className="npc-dialogue"><span className="npc-avatar">✦</span><div><strong>루미</strong><p>만든 원리를 기억해 둬. 다른 조성에서도 같은 규칙으로 다시 만들 수 있어!</p></div></div>
    <p className="saved-note"><Check size={16}/> 별과 개념별 숙련도를 저장했어요.</p>
    {nextLevel && <button className="primary-button" onClick={() => onNext(nextLevel)}>다음 임무 <ArrowRight size={19}/></button>}
    <button className="secondary-button" onClick={onExit}>왕국 지도로 돌아가기</button>
    <details open={level.templateId === 'quality'}><summary>이번 조성의 일곱 화음</summary><div className="completed-chords">{triads.map(t => <button key={t.degree} className="choice-card" onClick={() => void audio.playNotes(t.notes)} aria-label={`${t.symbol}, ${t.romanNumeral}, ${qualityNames[t.quality]} 화음 듣기`}><strong>{label(t.symbol)}</strong><span>{t.romanNumeral} · {qualityNames[t.quality].split(' · ')[0]}</span></button>)}</div><p><strong>발견한 품질 패턴</strong><br/>{triads.map(t => qualityNames[t.quality].split(' · ')[0]).join(' – ')}</p></details>
  </section>;

  return <section className="level-game">
    <div className="level-header"><button className="icon-button" aria-label="스테이지 나가기" onClick={exit}><ArrowLeft size={21}/></button><div><span className="eyebrow">{key.koreanName}</span><h2>{level.title}</h2></div><span className="question-counter">{index + 1}<span> / {tasks.length}</span></span></div>
    <div className="level-progress" role="progressbar" aria-label="스테이지 진행" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={tasks.length}><span style={{width: `${(index + (success ? 1 : 0)) / tasks.length * 100}%`}}/></div>
    <div className="game-layout">
      <div className="puzzle-panel">
        <div className="signature-panel compact"><span>{signatureNotes.length ? signatureNotes.join(' · ') : '♮ 조표 없음'}</span><span>학습 모드 · 시간 제한 없음</span></div>
        {key.mode === 'naturalMinor' && <p className="input-help">자연단조 유지: v = {label(triads[4].symbol)} · 7음을 임의로 올리지 않아요.</p>}
        <div className="puzzle-title"><span className="eyebrow">{String(index + 1).padStart(2, '0')} / DISCOVER THE PATTERN</span><h1>{task.title}</h1><p>{task.prompt}</p></div>
        <div className="scale-rail" aria-label="현재 조성 음계">{key.scale.map((n, i) => <span key={n.display} className={`${(errors >= 2 || hints > 0) && highlightedNotes.has(n.display) ? 'highlighted' : ''}`}><b>{label(n.display)}</b><small>{i + 1}도</small></span>)}</div>

        {level.templateId === 'relative' && relative && <div className="relative-comparison">{[key, relative].map(k => <div className="comparison-card" key={k.id}><span className="eyebrow">{k.mode === 'major' ? '태양 도시' : '달 동굴'}</span><strong>{k.koreanName}</strong><p>{k.scale.map(n => label(n.display)).join(' · ')}</p><button className="secondary-button" onClick={async () => { await audio.unlock(); await audio.playProgression(k.progression.map(d => buildDiatonicTriad(k, d as 1 | 2 | 3 | 4 | 5 | 6 | 7)), 80); }}><Volume2 size={16}/>진행 비교 듣기</button></div>)}</div>}

        {isSlots && <>
          <div className={task.kind === 'tower' ? 'chord-tower' : task.kind === 'timeline' ? 'timeline-slots' : 'scale-slots'} aria-label="음 배치 슬롯">
            {task.correct.map((_, slot) => <button type="button" data-slot={slot} className={`note-slot ${answers[slot] ? 'filled' : ''} ${selectedSlot === slot ? 'selected' : ''} ${autoReveal || success ? 'correct' : ''}`} key={slot} aria-label={`${task.kind === 'tower' ? ['루트', '3음', '5음'][slot] : `${slot + 1}번째`} 슬롯${answers[slot] ? ` ${answers[slot]}` : ' 비어 있음'}`} aria-pressed={selectedSlot === slot} onClick={() => removeSlot(slot)} disabled={slot < (task.prefill?.length || 0)}><small>{task.kind === 'tower' ? ['Root · 1', 'Third · 3', 'Fifth · 5'][slot] : task.kind === 'timeline' ? progression[slot]?.romanNumeral : `${slot + 1}`}</small><strong>{answers[slot] ? label(answers[slot]) : '+'}</strong></button>)}
          </div>
          {task.kind === 'tower' && <p className="hint-path">1음 <span>↗ +2칸</span> 3음 <span>↗ +2칸</span> 5음</p>}
          <div className="note-deck" aria-label="배치할 카드">{task.options.map((value, i) => <button key={`${value}-${i}`} className={`note-card ${dragging === value ? 'dragging' : ''}`} aria-label={`${label(value)} 카드 배치`} onPointerDown={e => pointerDown(e, value)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; setDragging(null); }} onClick={() => { if (!dragRef.current?.moved) place(value); }} disabled={success || autoReveal} style={{touchAction:'none'}}><strong>{label(value)}</strong>{noteSub(value) && <small>{noteSub(value)}</small>}</button>)}</div>
          <p className="input-help"><Hand size={15}/>카드를 탭하면 다음 칸에 놓여요. 슬롯을 탭하면 바꿀 수 있어요.</p>
        </>}

        {task.kind === 'halfsteps' && <><div className="halfstep-options" aria-label="반음 구간 선택">{task.options.map(i => <button key={i} className={`choice-card ${answers.includes(i) ? 'selected' : ''}`} aria-label={`${label(key.scale[+i].display)}에서 ${label(key.scale[(+i + 1) % 7].display)} 구간 선택`} aria-pressed={answers.includes(i)} onClick={() => place(i)} disabled={success || autoReveal}><strong>{label(key.scale[+i].display)} → {label(key.scale[(+i + 1) % 7].display)}{+i === 6 ? ' ↑' : ''}</strong><span>{+i + 1} → {+i === 6 ? '8' : +i + 2}도</span></button>)}</div><p className="input-help">선택한 구간 {answers.length} / {task.correct.length}</p></>}

        {task.triad && !isSlots && <div className="chord-display">
          {task.audioOnly && !showNotes ? <><div className="ear-symbol"><Volume2 size={40}/></div><button className="text-button" onClick={() => setShowNotes(true)}>눈으로 보기 · 구성음 확인</button></> : <div className="chord-notes">{task.triad.notes.map((n, i) => <span key={n.display}><small>{['1음', '3음', '5음'][i]}</small><strong>{label(n.display)}</strong></span>)}</div>}
          {task.kind === 'quality' && <div className="interval-meter">{getTriadIntervals(task.triad.notes).map((gap, i) => <div key={i}><span>{i === 0 ? '아래' : '위'} 3도</span><div className="semitone-beads">{Array.from({length:gap}, (_, j) => <i key={j}/>)}</div><strong>{gap}반음</strong></div>)}</div>}
        </div>}

        {!isSlots && !['halfsteps', 'playback'].includes(task.kind) && <div className={`choice-grid ${task.kind === 'function' ? 'function-islands' : ''}`} aria-label="정답 선택">{task.options.map(value => <button className={`choice-card ${answers.includes(value) ? 'selected' : ''} ${autoReveal && task.correct.includes(value) ? 'correct' : ''}`} key={value} aria-pressed={answers.includes(value)} onClick={() => place(value)} disabled={success || autoReveal}>{task.kind === 'function' && <span className="function-icon">{value.startsWith('집') ? '⌂' : value.startsWith('길') ? '↝' : '♜'}</span>}<strong>{label(value)}</strong></button>)}</div>}

        {task.kind === 'playback' && <div className="playback-panel"><div className="completed-chords">{progression.map((t, i) => <div className="progression-chord" key={i}><span>{t.romanNumeral}</span><strong>{label(t.symbol)}</strong></div>)}</div><div className="rhythm-picker" role="group" aria-label="연주 리듬"><button className={`choice-card ${rhythm === 'block' ? 'selected' : ''}`} aria-pressed={rhythm === 'block'} onClick={() => setRhythm('block')}>동시에 · 블록 코드</button><button className={`choice-card ${rhythm === 'arpeggio' ? 'selected' : ''}`} aria-pressed={rhythm === 'arpeggio'} onClick={() => setRhythm('arpeggio')}>차례로 · 아르페지오</button></div><button className="primary-button" onClick={() => void play()} disabled={playing}><Volume2 size={20}/>{playing ? '진행이 연주되고 있어요…' : listened ? '진행 다시 듣기' : '진행 연주하기'}</button>{listened && <p className="saved-note"><Check size={17}/>전체 진행을 들었어요.</p>}</div>}

        <div className="npc-dialogue"><span className="npc-avatar" aria-hidden="true">{task.npc === '테르티' ? '▦' : task.npc === '센토' ? '◈' : task.npc === '로마' ? 'Ⅳ' : '✦'}</span><div aria-live="polite" aria-atomic="true"><strong>{task.npc || '루미'}</strong><p>{feedback || (index === 0 ? '천천히 직접 만들어 보자. 듣기는 몇 번 해도 감점이 없어!' : task.rule)}</p></div></div>
        {(success || autoReveal) && <div className={`feedback ${success ? 'success' : 'assisted'}`} role="status">{success ? <><Sparkles size={19}/>원리를 발견했어요. 다음 단계로 이어 가요!</> : <><HelpCircle size={19}/>완성 경로: {task.correct.map(answerLabel).join(' → ')}</>}</div>}
        {autoReveal && <div className="assist-panel"><p>{task.explanation}</p><button className="primary-button" onClick={replay}><RotateCcw size={18}/>직접 다시 만들기</button></div>}
        <div className="game-actions">{!success && !autoReveal ? <>
          <div className="utility-actions"><button className="secondary-button" onClick={() => void play(task.kind === 'scale' || task.kind === 'halfsteps' ? 'scale' : 'block')} disabled={playing} aria-label="현재 음 듣기"><Volume2 size={18}/>{playing ? '재생 중' : '듣기'}</button>{task.kind === 'tower' && <button className="secondary-button" onClick={() => void play('arpeggio')} disabled={playing}>분산음</button>}<button className="secondary-button" onClick={hint}><HelpCircle size={18}/>힌트 <small>−15</small></button></div>
          <button className="primary-button" onClick={validate} disabled={task.kind === 'playback' && !listened}><Check size={19}/>완성 확인하기</button>
        </> : success ? <button className="primary-button" onClick={next}>{index === tasks.length - 1 ? '복원 결과 보기' : '다음 발견으로'}<ArrowRight size={19}/></button> : null}</div>
        <p className="score-note">{assisted ? '함께 완성 후 재현 · 기본 20점' : `현재 ${errors === 0 ? '첫 번째' : errors === 1 ? '두 번째' : '세 번째'} 시도`} · 듣기와 탭 조작 감점 없음</p>
      </div>
    </div>
    {leaveConfirm && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">이번 임무를 나갈까요?</h2><p>완료한 스테이지의 별은 유지돼요. 현재 진행 중인 임무는 다시 시작하게 돼요.</p><button className="secondary-button" onClick={() => setLeaveConfirm(false)}>계속 복원하기</button><button className="primary-button" onClick={onExit}>지도로 돌아가기</button></div></div>}
  </section>;
}
