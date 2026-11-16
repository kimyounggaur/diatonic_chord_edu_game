import { describe, expect, it } from 'vitest';
import { KEYS, getKey } from '../src/data/worlds';
import { buildDiatonicTriad, identifyTriadQuality, parseNote, validateSpelling } from '../src/domain/theory';
import { CHALLENGE_MODES, FIFTHS_CYCLE, formatChallengeSignature, generateChallengeQuestions } from '../src/domain/challenges';

describe('도전 문제 생성기', () => {
  it('여섯 모드 중 조표와 로마 숫자에만 시간 제한을 둔다', () => {
    expect(CHALLENGE_MODES).toHaveLength(6);
    expect(CHALLENGE_MODES.filter(mode => mode.timed).map(mode => mode.id)).toEqual(['signature', 'roman']);
  });

  it.each(CHALLENGE_MODES)('$id는 같은 시드에 같은 세션을 생성한다', ({ id }) => {
    expect(generateChallengeQuestions(id, 'lesson-01', 14)).toEqual(generateChallengeQuestions(id, 'lesson-01', 14));
  });

  it.each(CHALLENGE_MODES)('$id는 세션 안에서 같은 문제나 중복 보기를 반복하지 않는다', ({ id }) => {
    const questions = generateChallengeQuestions(id, 'unique', 1000);
    expect(new Set(questions.map(q => q.id)).size).toBe(questions.length);
    for (const q of questions) {
      expect(new Set(q.options).size).toBe(q.options.length);
      if (id === 'stack') expect(q.answer.split('|')).toHaveLength(3);
      else expect(q.options.filter(option => option === q.answer)).toHaveLength(1);
    }
  });

  it('보기 순서는 시드에 따라 바뀐다', () => {
    expect(generateChallengeQuestions('stack', 'a', 7)).not.toEqual(generateChallengeQuestions('stack', 'b', 7));
  });

  it('조표 30문제는 장조/자연단조 맥락과 정확한 조표를 함께 제시한다', () => {
    const questions = generateChallengeQuestions('signature', 'signatures', 1000);
    expect(questions).toHaveLength(30);
    expect(questions.map(q => q.keyId).sort()).toEqual(KEYS.map(k => k.id).sort());
    for (const q of questions) {
      const key = getKey(q.keyId);
      expect(q.prompt).toContain(key.mode === 'major' ? '장조' : '자연단조');
      expect(q.answer).toBe(key.koreanName);
      expect(q.signature).toBe(formatChallengeSignature(key));
      expect(q.options.every(option => KEYS.some(k => k.mode === key.mode && k.koreanName === option))).toBe(true);
    }
    expect(formatChallengeSignature(getKey('G-major'))).toBe('♯ 1개 · F♯');
    expect(formatChallengeSignature(getKey('Bb-major'))).toBe('♭ 2개 · B♭ · E♭');
    expect(formatChallengeSignature(getKey('C-major'))).toBe('♮ 조표 없음');
  });

  it('C장조 화음 구축은 1도부터 7도까지 한 번씩 정확한 세 음을 쌓는다', () => {
    const questions = generateChallengeQuestions('stack', 'build', 1000);
    expect(questions).toHaveLength(7);
    expect(questions.map(q => q.degree)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(questions.map(q => q.answer)).toEqual(['C|E|G', 'D|F|A', 'E|G|B', 'F|A|C', 'G|B|D', 'A|C|E', 'B|D|F']);
    for (const q of questions) expect(q.options).toHaveLength(7);
  });

  it('로마숫자 전 범위가 이론 엔진과 일치하고 A 자연단조 v를 Em으로 유지한다', () => {
    const questions = generateChallengeQuestions('roman', 'roman', 1000);
    expect(questions).toHaveLength(210);
    for (const q of questions) expect(q.answer).toBe(buildDiatonicTriad(getKey(q.keyId), q.degree).romanNumeral);
    const minorFifth = questions.find(q => q.keyId === 'A-naturalMinor' && q.degree === 5)!;
    expect(minorFifth.prompt).toContain('Em');
    expect(minorFifth.answer).toBe('v');
    expect(minorFifth.explanation).toContain('자연단조의 v는 단화음');
  });

  it('첫 철자 문제는 G♭ IV의 C♭ E♭ G♭와 이명동음 함정을 구분한다', () => {
    const q = generateChallengeQuestions('spelling', 'spell', 10)[0];
    expect(q.keyId).toBe('Gb-major');
    expect(q.degree).toBe(4);
    expect(q.answer).toBe('C♭ E♭ G♭');
    expect(q.options).toContain('B D♯ F♯');
    expect(q.options).toHaveLength(4);
  });

  it('철자 정답만 해당 조성의 1·3·5 표기를 따른다', () => {
    for (const q of generateChallengeQuestions('spelling', 'all-spellings', 1000)) {
      const triad = buildDiatonicTriad(getKey(q.keyId), q.degree);
      expect(q.answer).toBe(triad.notes.map(n => n.display).join(' '));
      expect(validateSpelling(q.answer.split(' ').map(parseNote), getKey(q.keyId)).valid).toBe(true);
      for (const distractor of q.options.filter(option => option !== q.answer)) {
        expect(validateSpelling(distractor.split(' ').map(parseNote), getKey(q.keyId)).valid).toBe(false);
      }
    }
  });

  it('청음은 실제 품질에 맞고 같은 소리의 화음을 같은 세션에서 반복하지 않는다', () => {
    const questions = generateChallengeQuestions('aural', 'ear', 1000);
    const labels = { major: '장 · M', minor: '단 · m', diminished: '감 · °', augmented: '증 · +' };
    expect(questions).toHaveLength(36);
    const fingerprints = questions.map(q => q.notes.map(n => n.midiClass).join(','));
    expect(new Set(fingerprints).size).toBe(questions.length);
    for (const q of questions) expect(q.answer).toBe(labels[identifyTriadQuality(q.notes)]);
  });

  it('5도권은 열두 중심을 순서대로 연결하고 F♯→D♭ 이명동음 연결을 설명한다', () => {
    const questions = generateChallengeQuestions('fifths', 'fifths', 1000);
    expect(questions).toHaveLength(12);
    expect(questions.map(q => q.keyId)).toEqual([...FIFTHS_CYCLE]);
    questions.forEach((q, index) => {
      const current = getKey(q.keyId);
      const next = getKey(FIFTHS_CYCLE[(index + 1) % 12]);
      expect(q.answer).toBe(next.koreanName);
      expect((next.tonic.midiClass - current.tonic.midiClass + 12) % 12).toBe(7);
    });
    expect(questions[6].explanation).toContain('C♯는 D♭과 이명동음');
    expect(questions[11].answer).toBe('C 장조');
  });

  it('빈 세션과 잘못된 문항 수를 명시적으로 처리한다', () => {
    expect(generateChallengeQuestions('signature', 'zero', 0)).toEqual([]);
    for (const count of [-1, 1.5, 1001, Number.NaN]) expect(() => generateChallengeQuestions('roman', 'bad', count)).toThrow(RangeError);
  });
});
