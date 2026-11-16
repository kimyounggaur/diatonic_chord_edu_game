import { create } from 'zustand';
import { KEY_BY_ID, LEVELS, WORLDS } from '../data/worlds';
import { calculateMasteryUpdate, calculateStars, type LearningConcept, type ReviewItem } from '../domain/learning';

export const STORAGE_KEY = 'chord-crafter-save';
export const SCHEMA_VERSION = 1;
const MAX_SAVE_BYTES = 2_000_000;
const CONCEPTS: LearningConcept[] = ['scaleSpelling', 'keySignature', 'stackedThirds', 'triadQuality', 'romanNumeral', 'harmonicFunction', 'relativeKey', 'auralQuality'];

export interface PlayerProgress {
  schemaVersion: number;
  unlockedKeyIds: string[];
  completedLevelIds: string[];
  starsByLevel: Record<string, 0 | 1 | 2 | 3>;
  masteryByConceptAndKey: Record<string, number>;
  reviewQueue: ReviewItem[];
  codexUnlocks: string[];
  cosmetics: string[];
  lastPlayedAt: string;
}

export interface GameSettings {
  muted: boolean;
  volume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  vibration: boolean;
  noteLabels: 'english' | 'korean' | 'solfege';
  ascii: boolean;
  timbre: 'piano' | 'sine' | 'marimba' | '8bit';
  advanced: boolean;
  visualAudio: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  muted: false, volume: 0.65, sfxVolume: 0.3, reducedMotion: false,
  vibration: false, noteLabels: 'english', ascii: false, timbre: 'piano', advanced: false, visualAudio: true,
};

export function createInitialProgress(): PlayerProgress {
  return {
    schemaVersion: SCHEMA_VERSION,
    unlockedKeyIds: ['C-major'], completedLevelIds: [], starsByLevel: {},
    masteryByConceptAndKey: {}, reviewQueue: [], codexUnlocks: ['C-major'],
    cosmetics: ['piano'], lastPlayedAt: '',
  };
}

type CompletedLevel = { id: string; keyId: string; worldId: string; templateId: string };
export interface GameStore {
  progress: PlayerProgress;
  settings: GameSettings;
  storageWarning: string | null;
  completeLevel: (level: CompletedLevel, scores: number[], assisted: boolean) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetProgress: () => void;
  exportProgress: () => string;
  importProgress: (json: string) => boolean;
  addReview: (keyId: string, concept: LearningConcept, degree: number, levelId?: string, taskId?: string) => void;
  markReviewCorrect: (id: string) => void;
  dismissStorageWarning: () => void;
}

type Save = { schemaVersion: number; progress: PlayerProgress; settings: GameSettings };
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isSafeString = (value: unknown): value is string => typeof value === 'string' && value.length <= 250 && !['__proto__', 'prototype', 'constructor'].includes(value);
const unique = <T,>(values: T[]): T[] => [...new Set(values)];
const validKey = (id: unknown): id is string => isSafeString(id) && Object.hasOwn(KEY_BY_ID, id);
const validLevel = (id: unknown): id is string => isSafeString(id) && LEVELS.some(level => level.id === id);
const validStrings = (value: unknown, predicate: (v: unknown) => boolean): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every(predicate);
const validDate = (value: unknown): value is string => value === '' || (typeof value === 'string' && value.length < 50 && Number.isFinite(Date.parse(value)));
const validNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function parseSettings(raw: unknown): GameSettings | null {
  if (!isObject(raw)) return null;
  const settings = { ...DEFAULT_SETTINGS, ...raw };
  if (!['muted', 'reducedMotion', 'vibration', 'ascii', 'advanced', 'visualAudio'].every(key => typeof settings[key as keyof GameSettings] === 'boolean')) return null;
  if (!validNumber(settings.volume, 0, 1) || !validNumber(settings.sfxVolume, 0, 1)) return null;
  if (!['english', 'korean', 'solfege'].includes(String(settings.noteLabels)) || !['piano', 'sine', 'marimba', '8bit'].includes(String(settings.timbre))) return null;
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, settings[key as keyof GameSettings]])) as unknown as GameSettings;
}

/** Import is validated before any live state or local bytes change. */
export function parseSave(json: string): Save | null {
  try {
    if (json.length > MAX_SAVE_BYTES) return null;
    const root: unknown = JSON.parse(json);
    if (!isObject(root)) return null;
    const raw = isObject(root.progress) ? root.progress : root;
    const version = raw.schemaVersion ?? root.schemaVersion ?? 0;
    if (!Number.isInteger(version) || Number(version) < 0 || Number(version) > SCHEMA_VERSION) return null;
    // Version zero saves predate review/codex fields and receive safe additive defaults.
    const p = Number(version) === 0 ? { ...createInitialProgress(), ...raw, schemaVersion: SCHEMA_VERSION } : raw;
    if (!validStrings(p.unlockedKeyIds, validKey) || !validStrings(p.completedLevelIds, validLevel) || !validStrings(p.codexUnlocks, validKey)) return null;
    if (!validStrings(p.cosmetics, isSafeString) || !validDate(p.lastPlayedAt)) return null;
    if (!isObject(p.starsByLevel) || !isObject(p.masteryByConceptAndKey) || !Array.isArray(p.reviewQueue) || p.reviewQueue.length > 5000) return null;
    if (!Object.entries(p.starsByLevel).every(([id, stars]) => validLevel(id) && validNumber(stars, 0, 3) && Number.isInteger(stars))) return null;
    if (!Object.entries(p.masteryByConceptAndKey).every(([id, value]) => {
      const [keyId, concept, ...rest] = id.split(':');
      return rest.length === 0 && validKey(keyId) && CONCEPTS.includes(concept as LearningConcept) && validNumber(value, 0, 100);
    })) return null;
    if (!p.reviewQueue.every(item => isObject(item) && (item.levelId === undefined || validLevel(item.levelId)) && (item.taskId === undefined || isSafeString(item.taskId)) && isSafeString(item.id) && validKey(item.keyId) && CONCEPTS.includes(item.concept as LearningConcept) && validNumber(item.degree, 1, 7) && Number.isInteger(item.degree) && validNumber(item.errorCount, 0, 100000) && Number.isInteger(item.errorCount) && validNumber(item.correctStreak, 0, 100000) && Number.isInteger(item.correctStreak) && validDate(item.lastReviewedAt) && validDate(item.dueAt))) return null;
    const settings = parseSettings(root.settings ?? DEFAULT_SETTINGS);
    if (!settings) return null;
    const progress: PlayerProgress = {
      schemaVersion: SCHEMA_VERSION,
      unlockedKeyIds: unique(['C-major', ...p.unlockedKeyIds]),
      completedLevelIds: unique(p.completedLevelIds),
      starsByLevel: Object.fromEntries(Object.entries(p.starsByLevel)) as PlayerProgress['starsByLevel'],
      masteryByConceptAndKey: Object.fromEntries(Object.entries(p.masteryByConceptAndKey)) as Record<string, number>,
      reviewQueue: p.reviewQueue.map(item => ({ ...item })) as ReviewItem[],
      codexUnlocks: unique(['C-major', ...p.codexUnlocks]),
      cosmetics: unique(p.cosmetics), lastPlayedAt: p.lastPlayedAt,
    };
    return { schemaVersion: SCHEMA_VERSION, progress, settings };
  } catch { return null; }
}

function readInitialState(): { progress: PlayerProgress; settings: GameSettings; storageWarning: string | null } {
  const fallback = { progress: createInitialProgress(), settings: { ...DEFAULT_SETTINGS }, storageWarning: null as string | null };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const save = parseSave(raw);
    return save ? { progress: save.progress, settings: save.settings, storageWarning: null } : { ...fallback, storageWarning: '저장 기록을 읽지 못했어요. 새 게임을 시작할 수 있고, 내보낸 기록이 있다면 설정에서 복원할 수 있어요.' };
  } catch { return { ...fallback, storageWarning: '저장 공간을 사용할 수 없어요. 게임은 계속할 수 있어요. 설정에서 진행 기록을 내보내 주세요.' }; }
}

function persist(progress: PlayerProgress, settings: GameSettings): string | null {
  try {
    if (typeof localStorage === 'undefined') return '이 환경에서는 자동 저장을 사용할 수 없어요. 설정에서 진행 기록을 내보내 주세요.';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, progress, settings }));
    return null;
  } catch { return '진행 기록을 자동 저장하지 못했어요. 게임은 계속할 수 있어요. 설정에서 진행 기록을 내보내 주세요.'; }
}

const conceptForTemplate: Record<string, LearningConcept[]> = {
  scale: ['scaleSpelling', 'keySignature'], stack: ['stackedThirds'], quality: ['triadQuality'],
  roman: ['romanNumeral'], function: ['harmonicFunction'], progression: ['stackedThirds', 'triadQuality', 'romanNumeral', 'harmonicFunction'], relative: ['relativeKey'],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...readInitialState(),
  completeLevel(level, scores, assisted) {
    if (!validLevel(level.id) || !validKey(level.keyId) || scores.length === 0 || !scores.every(score => validNumber(score, 0, 100))) return;
    const actual = LEVELS.find(item => item.id === level.id)!;
    if (actual.keyId !== level.keyId || actual.worldId !== level.worldId || actual.templateId !== level.templateId) return;
    const old = get().progress;
    const now = new Date().toISOString();
    const average = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
    const concepts = conceptForTemplate[level.templateId] ?? [];
    const mastery = { ...old.masteryByConceptAndKey };
    for (const concept of concepts) {
      const id = `${level.keyId}:${concept}`;
      mastery[id] = calculateMasteryUpdate(mastery[id] ?? 0, average);
    }
    const unlocked = [...old.unlockedKeyIds];
    const world = WORLDS.find(item => item.id === level.worldId);
    if (world && level.templateId === 'progression' && level.keyId === world.majorKeyId) unlocked.push(world.minorKeyId);
    if (world && level.templateId === 'relative') {
      const nextWorld = [...WORLDS].sort((a, b) => a.order - b.order).find(item => item.order > world.order);
      if (nextWorld) unlocked.push(nextWorld.majorKeyId);
    }
    const progress: PlayerProgress = {
      ...old,
      completedLevelIds: unique([...old.completedLevelIds, level.id]),
      starsByLevel: { ...old.starsByLevel, [level.id]: Math.max(old.starsByLevel[level.id] ?? 0, calculateStars(scores, assisted)) as 0 | 1 | 2 | 3 },
      masteryByConceptAndKey: mastery,
      unlockedKeyIds: unique(unlocked),
      codexUnlocks: unique([...old.codexUnlocks, level.keyId, ...unlocked]),
      cosmetics: unique([...old.cosmetics, ...(level.templateId === 'progression' ? ['marimba'] : []), ...(level.templateId === 'relative' ? ['8bit'] : [])]),
      lastPlayedAt: now,
      reviewQueue: old.reviewQueue,
    };
    set({ progress, storageWarning: persist(progress, get().settings) });
  },
  updateSettings(patch) {
    const settings = parseSettings({ ...get().settings, ...patch });
    if (!settings) return;
    set({ settings, storageWarning: persist(get().progress, settings) });
  },
  resetProgress() {
    const progress = createInitialProgress();
    set({ progress, storageWarning: persist(progress, get().settings) });
  },
  exportProgress() {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), progress: get().progress, settings: get().settings }, null, 2);
  },
  importProgress(json) {
    const save = parseSave(json);
    if (!save) { set({ storageWarning: '가져올 기록의 형식이나 버전을 확인해 주세요. 현재 진행 기록은 유지했어요.' }); return false; }
    set({ progress: save.progress, settings: save.settings, storageWarning: persist(save.progress, save.settings) });
    return true;
  },
  addReview(keyId, concept, degree, levelId, taskId) {
    if (!validKey(keyId) || !CONCEPTS.includes(concept) || !Number.isInteger(degree) || degree < 1 || degree > 7) return;
    if ((levelId === undefined) !== (taskId === undefined) || (levelId !== undefined && (!validLevel(levelId) || LEVELS.find(level => level.id === levelId)?.keyId !== keyId || !isSafeString(taskId)))) return;
    const old = get().progress;
    const id = `${keyId}:${concept}:${degree}${levelId ? `:${levelId}:${taskId}` : ''}`;
    const previous = old.reviewQueue.find(item => item.id === id);
    const now = new Date().toISOString();
    const item: ReviewItem = { id, keyId, concept, degree, ...(levelId && taskId ? { levelId, taskId } : {}), errorCount: (previous?.errorCount ?? 0) + 1, lastReviewedAt: previous?.lastReviewedAt ?? now, dueAt: now, correctStreak: 0 };
    const progress = { ...old, reviewQueue: [...old.reviewQueue.filter(review => review.id !== id), item], lastPlayedAt: now };
    set({ progress, storageWarning: persist(progress, get().settings) });
  },
  markReviewCorrect(id) {
    const old = get().progress;
    const item = old.reviewQueue.find(review => review.id === id);
    if (!item) return;
    const now = Date.now();
    const streak = item.correctStreak + 1;
    const reviewQueue = streak >= 3
      ? old.reviewQueue.filter(review => review.id !== id)
      : old.reviewQueue.map(review => review.id === id
        ? { ...review, correctStreak: streak, lastReviewedAt: new Date(now).toISOString(), dueAt: new Date(now + streak * 86_400_000).toISOString() }
        : review);
    const progress = { ...old, reviewQueue, lastPlayedAt: new Date(now).toISOString() };
    set({ progress, storageWarning: persist(progress, get().settings) });
  },
  dismissStorageWarning() { set({ storageWarning: null }); },
}));
