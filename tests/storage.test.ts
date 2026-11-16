import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LEVELS, WORLDS } from '../src/data/worlds';

const makeStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(), key: (index: number) => [...data.keys()][index] ?? null, get length() { return data.size; } };
};

beforeEach(() => { vi.resetModules(); vi.stubGlobal('localStorage', makeStorage()); });
afterEach(() => vi.unstubAllGlobals());

describe('validated local progress persistence', () => {
  it('retains completed level stars after a simulated page reload', async () => {
    const first = await import('../src/storage/store');
    const level = LEVELS.find(level => level.keyId === 'C-major' && level.templateId === 'scale')!;
    first.useGameStore.getState().completeLevel(level, [100, 100], false);
    expect(first.useGameStore.getState().progress.starsByLevel[level.id]).toBe(3);
    vi.resetModules();
    const reloaded = await import('../src/storage/store');
    expect(reloaded.useGameStore.getState().progress.completedLevelIds).toContain(level.id);
    expect(reloaded.useGameStore.getState().progress.starsByLevel[level.id]).toBe(3);
  });
  it('keeps best stars but updates only relevant concepts', async () => {
    const { useGameStore } = await import('../src/storage/store');
    const level = LEVELS.find(level => level.keyId === 'C-major' && level.templateId === 'quality')!;
    useGameStore.getState().completeLevel(level, [100], false);
    useGameStore.getState().completeLevel(level, [20], true);
    const p = useGameStore.getState().progress;
    expect(p.starsByLevel[level.id]).toBe(3);
    expect(Object.keys(p.masteryByConceptAndKey)).toEqual(['C-major:triadQuality']);
    expect(p.completedLevelIds.filter(id => id === level.id)).toHaveLength(1);
  });
  it('unlocks relative minor and the next region at their completion gates', async () => {
    const { useGameStore } = await import('../src/storage/store');
    const world = WORLDS.find(world => world.majorKeyId === 'C-major')!;
    const progression = LEVELS.find(level => level.keyId === 'C-major' && level.templateId === 'progression')!;
    useGameStore.getState().completeLevel(progression, [100], false);
    expect(useGameStore.getState().progress.unlockedKeyIds).toContain(world.minorKeyId);
    const relative = LEVELS.find(level => level.worldId === world.id && level.templateId === 'relative')!;
    useGameStore.getState().completeLevel(relative, [100], false);
    const next = [...WORLDS].sort((a, b) => a.order - b.order).find(item => item.order > world.order)!;
    expect(useGameStore.getState().progress.unlockedKeyIds).toContain(next.majorKeyId);
  });
  it('imports a valid exported save and preserves current progress on invalid data', async () => {
    const { useGameStore } = await import('../src/storage/store');
    const level = LEVELS[0];
    useGameStore.getState().completeLevel(level, [100], false);
    const json = useGameStore.getState().exportProgress();
    useGameStore.getState().resetProgress();
    expect(useGameStore.getState().importProgress(json)).toBe(true);
    const before = useGameStore.getState().progress;
    const bytes = localStorage.getItem('chord-crafter-save');
    const invalid = JSON.parse(json);
    invalid.progress.starsByLevel[level.id] = 999;
    expect(useGameStore.getState().importProgress(JSON.stringify(invalid))).toBe(false);
    expect(useGameStore.getState().progress).toEqual(before);
    expect(localStorage.getItem('chord-crafter-save')).toBe(bytes);
  });
  it('rejects unknown versions and malicious or invalid values', async () => {
    const { useGameStore, parseSave } = await import('../src/storage/store');
    const save = JSON.parse(useGameStore.getState().exportProgress());
    save.progress.schemaVersion = 200;
    expect(parseSave(JSON.stringify(save))).toBeNull();
    save.progress.schemaVersion = 1;
    save.settings.volume = -1;
    expect(parseSave(JSON.stringify(save))).toBeNull();
    save.settings.volume = 0.5;
    save.progress.unlockedKeyIds = ['made-up-key'];
    expect(parseSave(JSON.stringify(save))).toBeNull();
    expect(parseSave('{')).toBeNull();
    expect(parseSave('null')).toBeNull();
  });
  it('migrates version zero saves additively', async () => {
    const { parseSave } = await import('../src/storage/store');
    const save = parseSave(JSON.stringify({ schemaVersion: 0, unlockedKeyIds: ['C-major'], completedLevelIds: [], starsByLevel: {}, masteryByConceptAndKey: {} }));
    expect(save?.progress.schemaVersion).toBe(1);
    expect(save?.progress.reviewQueue).toEqual([]);
    expect(save?.settings.timbre).toBe('piano');
  });
  it('continues in memory and reports storage failures', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
    const { useGameStore } = await import('../src/storage/store');
    expect(useGameStore.getState().storageWarning).toBeTruthy();
    useGameStore.getState().completeLevel(LEVELS[0], [100], false);
    expect(useGameStore.getState().progress.completedLevelIds).toContain(LEVELS[0].id);
    expect(useGameStore.getState().storageWarning).toBeTruthy();
  });
  it('deduplicates mistakes and preserves a review queue across reloads', async () => {
    const { useGameStore } = await import('../src/storage/store');
    useGameStore.getState().addReview('C-major', 'stackedThirds', 2);
    useGameStore.getState().addReview('C-major', 'stackedThirds', 2);
    expect(useGameStore.getState().progress.reviewQueue).toHaveLength(1);
    expect(useGameStore.getState().progress.reviewQueue[0].errorCount).toBe(2);
    vi.resetModules();
    const reloaded = await import('../src/storage/store');
    expect(reloaded.useGameStore.getState().progress.reviewQueue[0].degree).toBe(2);
  });
  it('advances only the reviewed item, never unrelated items from a level average', async () => {
    const { useGameStore } = await import('../src/storage/store');
    const level = LEVELS.find(item => item.keyId === 'C-major' && item.templateId === 'stack')!;
    useGameStore.getState().addReview('C-major', 'stackedThirds', 2);
    useGameStore.getState().addReview('C-major', 'stackedThirds', 7);
    useGameStore.getState().completeLevel(level, [100], false);
    expect(useGameStore.getState().progress.reviewQueue.map(item => item.correctStreak)).toEqual([0, 0]);
    useGameStore.getState().markReviewCorrect('C-major:stackedThirds:2');
    let queue = useGameStore.getState().progress.reviewQueue;
    expect(queue.find(item => item.degree === 2)?.correctStreak).toBe(1);
    expect(queue.find(item => item.degree === 7)?.correctStreak).toBe(0);
    expect(Date.parse(queue.find(item => item.degree === 2)!.dueAt)).toBeGreaterThan(Date.now());
    useGameStore.getState().markReviewCorrect('C-major:stackedThirds:2');
    useGameStore.getState().markReviewCorrect('C-major:stackedThirds:2');
    queue = useGameStore.getState().progress.reviewQueue;
    expect(queue.map(item => item.degree)).toEqual([7]);
    vi.resetModules();
    const reloaded = await import('../src/storage/store');
    expect(reloaded.useGameStore.getState().progress.reviewQueue.map(item => item.degree)).toEqual([7]);
  });

  it('keeps distinct tasks with the same concept and degree after reload', async () => {
    const { useGameStore } = await import('../src/storage/store');
    const level = LEVELS.find(item => item.keyId === 'C-major' && item.templateId === 'scale')!;
    useGameStore.getState().addReview('C-major', 'scaleSpelling', 1, level.id, 'scale');
    useGameStore.getState().addReview('C-major', 'scaleSpelling', 1, level.id, 'halfsteps');
    let queue = useGameStore.getState().progress.reviewQueue;
    expect(queue.map(item => item.taskId)).toEqual(['scale', 'halfsteps']);
    useGameStore.getState().markReviewCorrect(queue[0].id);
    queue = useGameStore.getState().progress.reviewQueue;
    expect(queue.map(item => item.correctStreak)).toEqual([1, 0]);
    vi.resetModules();
    const reloaded = await import('../src/storage/store');
    expect(reloaded.useGameStore.getState().progress.reviewQueue.map(item => item.taskId)).toEqual(['scale', 'halfsteps']);
  });

});
