import type { DiatonicTriad, LevelDefinition, SpelledNote } from './theory';
import { buildAllDiatonicTriads, getTriadIntervals, SCALE_PATTERNS } from './theory';
import type { LearningConcept } from './learning';
import { createSeededQuestionSet, shuffleSeeded } from './questions';
import { getKey } from '../data/worlds';

export type Kind = 'scale' | 'halfsteps' | 'tower' | 'quality' | 'roman' | 'function' | 'timeline' | 'playback' | 'resolution' | 'relative';
export interface Task {
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
  reviewOf?: string;
  sourceTaskId?: string;
}
export const qualityNames: Record<string, string> = { major: '장 · M', minor: '단 · m', diminished: '감 · °', augmented: '증 · +' };
export const functionNames: Record<string, string> = { tonic: '집 · 토닉', predominant: '길 · 프리도미넌트', dominant: '문 · 도미넌트' };
export const QUALITY_OPTIONS = Object.values(qualityNames);
export const FUNCTION_OPTIONS = Object.values(functionNames);
export const conceptFor: Record<string, LearningConcept> = { scale: 'scaleSpelling', stack: 'stackedThirds', quality: 'triadQuality', roman: 'romanNumeral', function: 'harmonicFunction', progression: 'stackedThirds', relative: 'relativeKey' };
export const conceptDescriptions: Record<string, string> = {
  scaleSpelling: '조표를 지켜 일곱 음의 음계 만들기', keySignature: '모든 같은 음에 조표를 적용하기',
  stackedThirds: '음계에서 한 칸씩 건너뛰며 1·3·5 쌓기', triadQuality: '두 3도의 반음 수로 화음 품질 구별하기',
  romanNumeral: '코드 이름과 로마 숫자 연결하기', harmonicFunction: '토닉·프리도미넌트·도미넌트의 역할 알기',
  relativeKey: '같은 음과 다른 으뜸음을 가진 상대조 비교하기', auralQuality: '화음의 간격을 눈과 귀로 함께 확인하기',
};
export const noteLabels: Record<string, string> = { C: '다', D: '라', E: '마', F: '바', G: '사', A: '가', B: '나' };
export const solfege: Record<string, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };

export function makeTasks(level: LevelDefinition): Task[] {
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

