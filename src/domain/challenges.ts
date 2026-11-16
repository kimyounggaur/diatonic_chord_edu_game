import { KEYS, getKey } from '../data/worlds';
import { shuffleSeeded } from './questions';
import { buildAllDiatonicTriads, buildDiatonicTriad, parseNote, type Accidental, type ChordQuality, type KeyDefinition, type SpelledNote } from './theory';

export type ChallengeMode = 'signature' | 'stack' | 'roman' | 'spelling' | 'aural' | 'fifths';
export interface ChallengeModeDefinition { id: ChallengeMode; title: string; description: string; timed: boolean }
export interface ChallengeQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  keyId: string;
  degree: number;
  notes: SpelledNote[];
  signature?: string;
}

export const CHALLENGE_MODES: ChallengeModeDefinition[] = [
  { id: 'signature', title: '60초 조표 질주', description: '조표를 보고 장조·자연단조를 찾아요.', timed: true },
  { id: 'stack', title: '7개 화음 연속 구축', description: 'C 장조의 모든 도수에 1·3·5를 쌓아요.', timed: false },
  { id: 'roman', title: '로마 숫자 변환', description: '60초 동안 코드 이름을 도수와 품질로 읽어요.', timed: true },
  { id: 'spelling', title: '철자 오류 탐지', description: '소리가 같아도 지켜야 하는 음이름을 찾아요.', timed: false },
  { id: 'aural', title: '코드 품질 청음', description: '합성음으로 장·단·감 화음을 구별해요.', timed: false },
  { id: 'fifths', title: '5도권 릴레이', description: '다음 완전5도 중심을 따라 열두 조성을 연결해요.', timed: false },
];

/** The F# -> Db hand-off uses enharmonic C# to keep twelve pitch centres. */
export const FIFTHS_CYCLE = ['C-major', 'G-major', 'D-major', 'A-major', 'E-major', 'B-major', 'F#-major', 'Db-major', 'Ab-major', 'Eb-major', 'Bb-major', 'F-major'] as const;
const qualityLabel: Record<ChordQuality, string> = { major: '장 · M', minor: '단 · m', diminished: '감 · °', augmented: '증 · +' };
const QUALITY_OPTIONS = Object.values(qualityLabel);
const signatureOrder = { '#': ['F', 'C', 'G', 'D', 'A', 'E', 'B'], b: ['B', 'E', 'A', 'D', 'G', 'C', 'F'] };
const accidentalText: Record<Accidental, string> = { natural: '', '#': '♯', b: '♭', '##': '##', bb: 'bb' };
const sharpPitches = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const flatPitches = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export function formatChallengeSignature(key: KeyDefinition): string {
  const entries = Object.entries(key.keySignature);
  if (!entries.length) return '♮ 조표 없음';
  const accidental = entries[0][1] === 'b' ? 'b' : '#';
  const order = signatureOrder[accidental];
  return `${accidentalText[accidental]} ${entries.length}개 · ${entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([letter, a]) => letter + accidentalText[a]).join(' · ')}`;
}

function optionsFor(answer: string, candidates: string[], seed: string, count = 4): string[] {
  return shuffleSeeded([answer, ...shuffleSeeded([...new Set(candidates)].filter(item => item !== answer), seed).slice(0, count - 1)], `${seed}:options`);
}

function signatureQuestions(seed: string): ChallengeQuestion[] {
  return KEYS.map(key => ({
    id: `signature:${key.id}`, keyId: key.id, degree: 1, notes: key.scale,
    signature: formatChallengeSignature(key),
    prompt: `이 조표를 쓰는 ${key.mode === 'major' ? '장조' : '자연단조'}를 골라 주세요.`,
    answer: key.koreanName,
    options: optionsFor(key.koreanName, KEYS.filter(k => k.mode === key.mode).map(k => k.koreanName), `${seed}:${key.id}`),
    explanation: `${formatChallengeSignature(key)}는 ${key.koreanName}의 조표예요. ${key.scale.map(n => n.display).join(' – ')}를 사용해요. 상대조와 조표가 같아도 이 문제에서는 ${key.mode === 'major' ? '장조' : '자연단조'}를 찾아요.`,
  }));
}

function stackQuestions(seed: string): ChallengeQuestion[] {
  const key = getKey('C-major');
  return buildAllDiatonicTriads(key).map(triad => ({
    id: `stack:C-major:${triad.degree}`, keyId: key.id, degree: triad.degree, notes: triad.notes,
    prompt: `${triad.degree}도 ${triad.notes[0].display}에서 한 칸씩 건너뛰어 1·3·5를 쌓아 주세요.`,
    answer: triad.notes.map(n => n.display).join('|'),
    options: shuffleSeeded(key.scale.map(n => n.display), `${seed}:stack:${triad.degree}`),
    explanation: `${triad.notes.map(n => n.display).join(' – ')} = ${triad.symbol} (${triad.romanNumeral}). 음계에서 +2칸, 다시 +2칸을 이동했어요.`,
  }));
}

function romanQuestions(seed: string): ChallengeQuestion[] {
  return KEYS.flatMap(key => {
    const triads = buildAllDiatonicTriads(key);
    return triads.map(triad => ({
      id: `roman:${key.id}:${triad.degree}`, keyId: key.id, degree: triad.degree, notes: triad.notes,
      prompt: `${key.koreanName}에서 ${triad.symbol}의 로마 숫자를 골라 주세요.`,
      answer: triad.romanNumeral,
      options: shuffleSeeded(triads.map(t => t.romanNumeral), `${seed}:roman:${key.id}:${triad.degree}`),
      explanation: `${triad.symbol}는 ${triad.degree}도 ${qualityLabel[triad.quality]} 화음이므로 ${triad.romanNumeral}예요.${key.mode === 'naturalMinor' && triad.degree === 5 ? ' 자연단조의 v는 단화음으로 유지해요.' : ''}`,
    }));
  });
}

function otherSpelling(note: SpelledNote): string {
  for (const name of [sharpPitches[note.midiClass], flatPitches[note.midiClass]]) if (name !== note.display) return name;
  for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
    for (const accidental of ['', 'b', '#', 'bb', '##']) {
      const candidate = parseNote(letter + accidental);
      if (candidate.midiClass === note.midiClass && candidate.display !== note.display) return candidate.display;
    }
  }
  throw new Error('이명동음 표기를 생성할 수 없습니다.');
}

function spellingQuestion(key: KeyDefinition, degree: number, seed: string): ChallengeQuestion {
  const triad = buildDiatonicTriad(key, degree);
  const correct = triad.notes.map(n => n.display);
  const answer = correct.join(' ');
  let enharmonic = triad.notes.map(n => sharpPitches[n.midiClass]);
  if (enharmonic.join(' ') === answer) enharmonic = [otherSpelling(triad.notes[0]), ...correct.slice(1)];
  const thirdTrap = [correct[0], otherSpelling(triad.notes[1]), correct[2]].join(' ');
  const fifthTrap = [correct[0], correct[1], otherSpelling(triad.notes[2])].join(' ');
  const rootTrap = [otherSpelling(triad.notes[0]), ...correct.slice(1)].join(' ');
  return {
    id: `spelling:${key.id}:${degree}`, keyId: key.id, degree, notes: triad.notes,
    prompt: `${key.koreanName}의 ${triad.romanNumeral} 화음. 조표와 1·3·5 글자 순서를 모두 지킨 표기를 골라 주세요.`,
    answer, options: shuffleSeeded([...new Set([answer, enharmonic.join(' '), thirdTrap, fifthTrap, rootTrap])].slice(0, 4), `${seed}:spelling:${key.id}:${degree}`),
    explanation: `${answer}가 올바른 철자예요. 구성음 글자는 ${triad.notes.map(n => n.letter).join(' – ')} 순서로 하나씩 건너뛰어요. 이명동음으로 같은 소리가 나더라도 이 조성의 철자는 바꾸지 않아요.`,
  };
}

function spellingQuestions(seed: string): ChallengeQuestion[] {
  const first = spellingQuestion(getKey('Gb-major'), 4, seed);
  const rest = KEYS.flatMap(key => buildAllDiatonicTriads(key).map(t => spellingQuestion(key, t.degree, seed)))
    .filter(question => question.id !== first.id);
  return [first, ...shuffleSeeded(rest, `${seed}:spelling-pool`)];
}

function auralQuestions(seed: string): ChallengeQuestion[] {
  const pool = shuffleSeeded(KEYS.flatMap(key => buildAllDiatonicTriads(key).map(triad => ({ key, triad }))), `${seed}:aural-pool`);
  const seen = new Set<string>();
  return pool.flatMap(({ key, triad }) => {
    // A shared chord in two keys is still the same listening question. Do not repeat its sound.
    const fingerprint = `${triad.quality}:${triad.notes.map(n => n.midiClass).join(',')}`;
    if (seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    return [{
      id: `aural:${fingerprint}`, keyId: key.id, degree: triad.degree, notes: triad.notes,
      prompt: '화음을 듣고 품질을 골라 주세요. 필요하면 구성음을 눈으로 확인해도 괜찮아요.',
      answer: qualityLabel[triad.quality], options: shuffleSeeded(QUALITY_OPTIONS, `${seed}:${fingerprint}`),
      explanation: `${triad.notes.map(n => n.display).join(' – ')}는 ${qualityLabel[triad.quality]} 3화음이에요. 소리와 구성음의 두 3도를 함께 확인해 보세요.`,
    }];
  });
}

function fifthsQuestions(seed: string): ChallengeQuestion[] {
  return FIFTHS_CYCLE.map((id, index) => {
    const key = getKey(id);
    const next = getKey(FIFTHS_CYCLE[(index + 1) % FIFTHS_CYCLE.length]);
    return {
      id: `fifths:${key.id}`, keyId: key.id, degree: 1, notes: buildDiatonicTriad(key, 1).notes,
      prompt: `${key.koreanName}에서 시계 방향으로 완전5도 위의 다음 조성은 무엇일까요?`,
      answer: next.koreanName,
      options: optionsFor(next.koreanName, FIFTHS_CYCLE.map(k => getKey(k).koreanName), `${seed}:fifths:${key.id}`),
      explanation: `${key.tonic.display} → ${next.tonic.display}, 완전5도(7반음)로 연결해요.${id === 'F#-major' ? ' F♯ 다음 C♯는 D♭과 이명동음이라, 열두 음고 중심의 지도에서는 D♭ 장조로 이어져요.' : ''}`,
    };
  });
}

/** A session consumes each generated item once; pools cap count instead of silently repeating. */
export function generateChallengeQuestions(mode: ChallengeMode, seed: string, count = 10): ChallengeQuestion[] {
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new RangeError('도전 문제 수는 0~1000의 정수여야 합니다.');
  let pool: ChallengeQuestion[];
  switch (mode) {
    case 'signature': pool = shuffleSeeded(signatureQuestions(seed), `${seed}:signature-pool`); break;
    case 'stack': pool = stackQuestions(seed); break;
    case 'roman': pool = shuffleSeeded(romanQuestions(seed), `${seed}:roman-pool`); break;
    case 'spelling': pool = spellingQuestions(seed); break;
    case 'aural': pool = auralQuestions(seed); break;
    case 'fifths': pool = fifthsQuestions(seed); break;
    default: throw new Error('지원하지 않는 도전 모드입니다.');
  }
  return pool.slice(0, count);
}
