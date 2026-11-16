import type { DiatonicTriad, LevelDefinition } from './theory';
export interface GeneratedQuestion { id: string; degree: number; keyId: string }

/** Function exercises demonstrate V→I; the boss resolves its actual final chord. */
export function resolutionProgression(triads: DiatonicTriad[], progression: DiatonicTriad[], template: LevelDefinition['templateId']): DiatonicTriad[] {
  const source = template === 'function' ? triads[4] : progression[progression.length - 1];
  if (!source || !triads[0]) throw new Error('해결을 재생할 화음이 없습니다.');
  return [source, triads[0]];
}
/** FNV-1a followed by mulberry32: stable across browser engines and sessions. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createSeededQuestionSet(level: Pick<LevelDefinition, 'id' | 'keyId' | 'seed' | 'templateId'>, count = 7): GeneratedQuestion[] {
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new RangeError('문제 수는 0~1000이어야 합니다.');
  const tutorial = level.keyId === 'C-major' && ['stack', 'quality'].includes(level.templateId);
  const degrees = tutorial ? [1, 2, 7, 3, 4, 5, 6] : shuffleSeeded([1, 2, 3, 4, 5, 6, 7], level.seed);
  return Array.from({ length: count }, (_, index) => ({ id: `${level.id}-q${index + 1}`, keyId: level.keyId, degree: degrees[index % 7] }));
}
