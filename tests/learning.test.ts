import { describe, expect, it } from 'vitest';
import { beginReplay, calculateAttemptScore, calculateMasteryUpdate, calculateStars, createAttemptState, recordCorrect, recordHint, recordIncorrect, selectReviewQuestions, type ReviewItem } from '../src/domain/learning';

describe('scoring follows learning rules', () => {
  it('awards 100, 70, 40, 20 with hints deducted and no negative scores', () => {
    expect([0, 1, 2, 3].map(errors => calculateAttemptScore(errors))).toEqual([100, 70, 40, 20]);
    expect(calculateAttemptScore(0, 2)).toBe(70);
    expect(calculateAttemptScore(0, 0, true)).toBe(20);
    expect(calculateAttemptScore(2, 10)).toBe(0);
  });
  it('requires 90 average and no automatic help for three stars', () => {
    expect(calculateStars([])).toBe(0);
    expect(calculateStars([20])).toBe(1);
    expect(calculateStars([100, 70])).toBe(2);
    expect(calculateStars([100, 100, 70])).toBe(3);
    expect(calculateStars([100], true)).toBe(2);
  });
  it('updates only a weighted concept score', () => {
    expect(calculateMasteryUpdate(50, 100)).toBe(60);
    expect(calculateMasteryUpdate(0, 100)).toBe(20);
    expect(calculateMasteryUpdate(120, 200)).toBe(100);
  });
});

describe('assistance requires independent replay', () => {
  it('does not pass at the third wrong answer or while showing the answer', () => {
    let attempt = createAttemptState();
    attempt = recordIncorrect(attempt);
    expect(attempt.phase).toBe('building');
    attempt = recordIncorrect(attempt);
    expect(attempt.phase).toBe('building');
    attempt = recordIncorrect(attempt);
    expect(attempt).toMatchObject({ errors: 3, phase: 'assisted', assisted: true, replayRequired: true });
    expect(recordCorrect(attempt)).toEqual(attempt);
    attempt = beginReplay(attempt);
    expect(attempt.phase).toBe('replay');
    attempt = recordCorrect(attempt);
    expect(attempt).toMatchObject({ phase: 'complete', score: 20, replayRequired: false });
    expect(recordIncorrect(attempt)).toEqual(attempt);
  });
  it('keeps assistance on a failed replay and counts hints', () => {
    let attempt = recordHint(recordIncorrect(recordIncorrect(recordIncorrect(createAttemptState()))));
    attempt = recordIncorrect(beginReplay(attempt));
    expect(attempt.phase).toBe('assisted');
    expect(recordCorrect(beginReplay(attempt)).score).toBe(5);
  });
});

describe('review prioritization', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const item = (id: string, overrides: Partial<ReviewItem> = {}): ReviewItem => ({ id, keyId: 'C-major', concept: 'triadQuality', degree: 1, errorCount: 1, lastReviewedAt: now.toISOString(), dueAt: now.toISOString(), correctStreak: 0, ...overrides });
  it('prioritizes due, weak, repeatedly mistaken items without duplicates', () => {
    const weak = item('weak', { keyId: 'A-naturalMinor', errorCount: 3 });
    const strong = item('strong');
    const later = item('later', { dueAt: '2026-11-18T00:00:00Z', errorCount: 8 });
    const selected = selectReviewQuestions([strong, weak, later, weak], { 'C-major:triadQuality': 95, 'A-naturalMinor:triadQuality': 10 }, 3, now);
    expect(selected.map(review => review.id)).toEqual(['weak', 'strong', 'later']);
  });
  it('does not mutate queues', () => {
    const items = [item('z'), item('a')];
    selectReviewQuestions(items, {}, 1, now);
    expect(items.map(review => review.id)).toEqual(['z', 'a']);
  });
});


describe('adaptive choices', () => {
  it('retains the answer before expanding choices after three independent answers', async () => {
    const { adaptiveChoices } = await import('../src/domain/learning');
    const choices = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    expect(adaptiveChoices(choices, ['vi'], 2)).toEqual(['I', 'ii', 'iii', 'vi']);
    expect(adaptiveChoices(choices, ['vi'], 3)).toEqual(choices);
    expect(adaptiveChoices(choices, ['missing'], 0)).toEqual(choices);
  });
});
