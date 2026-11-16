import { describe, expect, it } from 'vitest';
import { buildAllDiatonicTriads, buildDiatonicTriad, buildScale, getHarmonicFunction, getRomanNumeral, getTriadIntervals, identifyTriadQuality, parseNote, transposeProgression, validateSpelling } from '../src/domain/theory';
import { CORE_LEVELS, KEYS, LEVELS, WORLDS, getKey, templates } from '../src/data/worlds';
import { createSeededQuestionSet, seededRandom, shuffleSeeded } from '../src/domain/questions';
const notes = (names: string) => names.split(' ').map(parseNote);
const scaleNames = (id: string) => buildScale(getKey(id)).map(note => note.display);
const chordNames = (id: string) => buildAllDiatonicTriads(getKey(id)).map(chord => chord.symbol);

describe('철자를 보존하는 음계와 다이아토닉 3화음', () => {
  it('C 장조 음계는 C D E F G A B', () => expect(scaleNames('C-major')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']));
  it('C 장조 일곱 3화음', () => expect(chordNames('C-major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']));
  it('C 장조 vii°는 B D F', () => expect(buildDiatonicTriad(getKey('C-major'), 7).notes.map(n => n.display)).toEqual(['B', 'D', 'F']));
  it('G 장조 vii°는 F♯ A C', () => expect(buildDiatonicTriad(getKey('G-major'), 7).notes.map(n => n.display)).toEqual(['F♯', 'A', 'C']));
  it('F 장조 IV는 B♭ D F', () => expect(buildDiatonicTriad(getKey('F-major'), 4).notes.map(n => n.display)).toEqual(['B♭', 'D', 'F']));
  it('A 자연단조의 일곱 3화음', () => expect(chordNames('A-naturalMinor')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']));
  it('A 자연단조 v는 Em이며 V로 바꾸지 않는다', () => {
    const triad = buildDiatonicTriad(getKey('A-naturalMinor'), 5);
    expect(triad.symbol).toBe('Em'); expect(triad.romanNumeral).toBe('v');
    expect(triad.notes.map(n => n.display)).toEqual(['E', 'G', 'B']);
  });
  it('G♭ 장조 음계에 C♭가 포함된다', () => expect(scaleNames('Gb-major')).toEqual(['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']));
  it('G♭ 장조 IV를 B D♯ F♯로 바꾸지 않는다', () => expect(buildDiatonicTriad(getKey('Gb-major'), 4).notes.map(n => n.display)).toEqual(['C♭', 'E♭', 'G♭']));
  it('장3화음 간격은 4+3', () => { expect(getTriadIntervals(notes('C E G'))).toEqual([4, 3]); expect(identifyTriadQuality(notes('C E G'))).toBe('major'); });
  it('단3화음 간격은 3+4', () => { expect(getTriadIntervals(notes('D F A'))).toEqual([3, 4]); expect(identifyTriadQuality(notes('D F A'))).toBe('minor'); });
  it('감3화음 간격은 3+3', () => { expect(getTriadIntervals(notes('B D F'))).toEqual([3, 3]); expect(identifyTriadQuality(notes('B D F'))).toBe('diminished'); });
  it('증3화음 간격은 4+4', () => { expect(getTriadIntervals(notes('C E G#'))).toEqual([4, 4]); expect(identifyTriadQuality(notes('C E G#'))).toBe('augmented'); });
  it('F♯ 장조의 7음은 E♯', () => expect(scaleNames('F#-major')[6]).toBe('E♯'));
  it('C♯ 장조의 7음은 B♯', () => expect(scaleNames('C#-major')[6]).toBe('B♯'));
  it('C♭ 장조의 4음은 F♭', () => expect(scaleNames('Cb-major')[3]).toBe('F♭'));
  it('A♭ 자연단조에 C♭와 F♭', () => expect(scaleNames('Ab-naturalMinor')).toEqual(['A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F♭', 'G♭']));
  it('자연단조와 분리된 화성단음계는 7음만 높인다', () => {
    const source = { tonic: parseNote('A'), mode: 'harmonicMinor' as const };
    expect(buildScale(source).map(n => n.display)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G♯']);
    expect(buildAllDiatonicTriads(source).map(c => c.romanNumeral)).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']);
    expect(buildDiatonicTriad(source, 5).symbol).toBe('E');
  });
  it('화성단음계의 겹샤프를 철자대로 계산한다', () => {
    const source = { tonic: parseNote('D#'), mode: 'harmonicMinor' as const };
    expect(buildScale(source)[6].display).toBe('C##');
    expect(buildDiatonicTriad(source, 7).notes.map(n => n.display)).toEqual(['C##', 'E♯', 'G♯']);
  });
});

describe('음계 전체의 불변 규칙', () => {
  for (const key of KEYS) {
    it(`${key.id}: 글자·품질·기능·상대조를 보존한다`, () => {
      const scale = buildScale(key);
      expect(new Set(scale.map(n => n.letter)).size).toBe(7);
      expect(new Set(scale.map(n => n.midiClass)).size).toBe(7);
      expect(validateSpelling(scale, key)).toEqual({ valid: true, errors: [] });
      const triads = buildAllDiatonicTriads(key);
      const pattern = key.mode === 'major' ? ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'] : ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
      expect(triads.map(c => c.quality)).toEqual(pattern);
      const relative = getKey(key.relativeKeyId!);
      expect(relative.relativeKeyId).toBe(key.id);
      expect([...relative.scale.map(n => n.display)].sort()).toEqual([...scale.map(n => n.display)].sort());
      expect(relative.keySignature).toEqual(key.keySignature);
      expect(triads.map(c => c.function)).toEqual(['tonic', 'predominant', 'tonic', 'predominant', 'dominant', 'tonic', 'dominant']);
      for (const triad of triads) expect(validateSpelling(triad.notes, key).valid).toBe(true);
    });
  }
  it('이명동음도 틀린 철자는 거부한다', () => {
    const result = validateSpelling(notes('B D# F#'), getKey('Gb-major'));
    expect(result.valid).toBe(false); expect(result.errors).toHaveLength(3);
  });
  it('위조한 음높이 또는 표시도 거부한다', () => {
    const key = getKey('C-major');
    expect(validateSpelling([{ ...parseNote('C'), midiClass: 5 }], key).valid).toBe(false);
    expect(validateSpelling([{ ...parseNote('C'), display: 'C♯' }], key).valid).toBe(false);
  });
  it('도수를 따라 진행을 이조하며 잘못된 품질은 거부한다', () => {
    expect(transposeProgression(['I', 'vi', 'IV', 'V'], getKey('G-major')).map(c => c.symbol)).toEqual(['G', 'Em', 'C', 'D']);
    expect(transposeProgression(['i', 'VI', 'III', 'VII'], getKey('A-naturalMinor')).map(c => c.symbol)).toEqual(['Am', 'F', 'C', 'G']);
    expect(() => transposeProgression(['V'], getKey('A-naturalMinor'))).toThrow();
  });
  it('대문자·소문자·감·증 기호를 품질에 맞춘다', () => {
    expect(getRomanNumeral('major', 7)).toBe('vii°');
    expect(getRomanNumeral('naturalMinor', 5)).toBe('v');
    expect(getRomanNumeral('harmonicMinor', 3)).toBe('III+');
    expect(getRomanNumeral('major', 1, 'minor')).toBe('i');
    expect(getHarmonicFunction('naturalMinor', 5)).toBe('dominant');
  });
  it('잘못된 도수와 화음은 명시적으로 거부한다', () => {
    for (const degree of [0, 8, 1.5, NaN]) {
      expect(() => buildDiatonicTriad(getKey('C-major'), degree)).toThrow();
      expect(() => getRomanNumeral('major', degree)).toThrow();
      expect(() => getHarmonicFunction('major', degree)).toThrow();
    }
    expect(() => identifyTriadQuality(notes('C D E'))).toThrow();
    expect(() => getTriadIntervals(notes('C E'))).toThrow();
    expect(() => getKey('unknown')).toThrow();
  });
  it('ASCII·유니코드·겹임시표 입력과 옥타브 감산을 지원한다', () => {
    expect(parseNote('Gb')).toEqual(parseNote('G♭'));
    expect(parseNote('f♯').display).toBe('F♯');
    expect(parseNote('C♮').display).toBe('C');
    expect(parseNote('C𝄪')).toEqual(parseNote('C##'));
    expect(parseNote('B𝄫')).toEqual(parseNote('Bbb'));
    expect(parseNote('Cb').midiClass).toBe(11);
    expect(parseNote('B#').midiClass).toBe(0);
    expect(() => parseNote('H')).toThrow();
    expect(() => parseNote('C###')).toThrow();
    expect(() => buildScale({ tonic: parseNote('G##'), mode: 'major' })).toThrow();
  });
});

describe('데이터와 시드 기반 캠페인', () => {
  it('12개 핵심·3개 거울 지역, 24+6개 조성, 156+39 스테이지', () => {
    expect(WORLDS).toHaveLength(15); expect(WORLDS.filter(w => !w.advanced)).toHaveLength(12);
    expect(KEYS).toHaveLength(30); expect(CORE_LEVELS).toHaveLength(156); expect(LEVELS).toHaveLength(195);
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(195);
    expect(LEVELS.map(l => l.order)).toEqual(Array.from({ length: 195 }, (_, i) => i + 1));
    for (const world of WORLDS) {
      const levels = LEVELS.filter(l => l.worldId === world.id);
      expect(levels).toHaveLength(13);
      expect(levels.filter(l => l.templateId === 'relative')).toHaveLength(1);
      expect(levels.every(l => templates.some(t => t.id === l.templateId))).toBe(true);
    }
  });
  it('같은 시드는 같은 문제 순서이며 원본은 변형하지 않는다', () => {
    const source = [1, 2, 3, 4, 5, 6, 7];
    expect(shuffleSeeded(source, 'same')).toEqual(shuffleSeeded(source, 'same'));
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(shuffleSeeded(source, 'same')).not.toEqual(shuffleSeeded(source, 'other'));
    const level = LEVELS.find(l => l.keyId === 'G-major' && l.templateId === 'stack')!;
    expect(createSeededQuestionSet(level)).toEqual(createSeededQuestionSet(level));
    expect(new Set(createSeededQuestionSet(level).map(q => q.degree)).size).toBe(7);
    expect(createSeededQuestionSet(level).every(q => q.keyId === level.keyId && q.degree >= 1 && q.degree <= 7)).toBe(true);
    expect(createSeededQuestionSet(level, 9)).toHaveLength(9);
    expect(createSeededQuestionSet(level, 0)).toEqual([]);
    expect(() => createSeededQuestionSet(level, -1)).toThrow();
    expect(() => createSeededQuestionSet(level, 1.5)).toThrow();
    const random = seededRandom('seed');
    expect(Array.from({ length: 30 }, random).every(n => n >= 0 && n < 1)).toBe(true);
  });
  it('C 장조 안내는 장·단·감 순서로 먼저 발견한다', () => {
    const level = LEVELS.find(l => l.keyId === 'C-major' && l.templateId === 'stack')!;
    expect(createSeededQuestionSet(level).slice(0, 3).map(q => q.degree)).toEqual([1, 2, 7]);
  });
});
