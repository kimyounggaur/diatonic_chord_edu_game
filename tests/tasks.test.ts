import { describe, expect, it } from 'vitest';
import { KEYS, LEVELS, getKey } from '../src/data/worlds';
import { buildAllDiatonicTriads, getTriadIntervals, SCALE_PATTERNS, validateSpelling, type LevelDefinition, type TemplateId } from '../src/domain/theory';
import { makeTasks, qualityNames, functionNames, type Kind } from '../src/domain/tasks';

const levelFor = (keyId: string, templateId: TemplateId): LevelDefinition => LEVELS.find(level => level.keyId === keyId && level.templateId === templateId)!;
const allKinds: Kind[] = ['scale', 'halfsteps', 'tower', 'quality', 'roman', 'function', 'timeline', 'playback', 'resolution', 'relative'];

describe('독립적인 학습 과제 생성기', () => {
  it('195개 스테이지가 모두 빈 과제나 중복 문항 ID 없이 생성된다', () => {
    expect(LEVELS).toHaveLength(195);
    for (const level of LEVELS) {
      const tasks = makeTasks(level);
      expect(tasks.length, level.id).toBeGreaterThan(0);
      expect(new Set(tasks.map(task => task.id)).size, level.id).toBe(tasks.length);
      for (const task of tasks) {
        expect(task.title.trim(), `${level.id}/${task.id}`).not.toBe('');
        expect(task.rule.trim(), `${level.id}/${task.id}`).not.toBe('');
        expect(task.explanation.trim(), `${level.id}/${task.id}`).not.toBe('');
        expect(task.correct.length, `${level.id}/${task.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('캠페인의 열 가지 과제 화면을 모두 생성한다', () => {
    const kinds = new Set(LEVELS.flatMap(level => makeTasks(level).map(task => task.kind)));
    expect([...kinds].sort()).toEqual([...allKinds].sort());
  });

  it('30개 조성의 음계 배열·반음 정답을 실제 음계와 일치시킨다', () => {
    for (const key of KEYS) {
      const [scale, halfsteps] = makeTasks(levelFor(key.id, 'scale'));
      expect(scale.correct, key.id).toEqual(key.scale.map(note => note.display));
      expect(scale.prefill, key.id).toEqual([key.tonic.display]);
      expect(halfsteps.correct, key.id).toEqual(SCALE_PATTERNS[key.mode].flatMap((gap, i) => gap === 1 ? [String(i)] : []));
      expect(halfsteps.correct, key.id).toHaveLength(2);
      expect(new Set(scale.options).size, key.id).toBe(scale.options.length);
    }
  });

  it('쌓기 과제는 각 조성의 1~7도를 한 번씩 생성하고 1·3·5 철자를 지킨다', () => {
    for (const key of KEYS) {
      const tasks = makeTasks(levelFor(key.id, 'stack'));
      const triads = buildAllDiatonicTriads(key);
      expect(tasks.map(task => task.degree).sort(), key.id).toEqual([1, 2, 3, 4, 5, 6, 7]);
      for (const task of tasks) {
        const triad = triads[task.degree! - 1];
        expect(task.correct, `${key.id}/${task.id}`).toEqual(triad.notes.map(note => note.display));
        expect(task.prefill).toEqual([triad.notes[0].display]);
        expect(validateSpelling(task.notes!, key).valid).toBe(true);
      }
    }
  });

  it('G♭ 장조 IV의 C♭–E♭–G♭를 이명동음으로 바꾸지 않는다', () => {
    const task = makeTasks(levelFor('Gb-major', 'stack')).find(task => task.degree === 4)!;
    expect(task.correct).toEqual(['C♭', 'E♭', 'G♭']);
    expect(task.options).toContain('C♭');
    expect(task.options).not.toContain('B');
  });

  it('거울 조성에서 E♯·B♯·F♭ 표기를 그대로 사용한다', () => {
    expect(makeTasks(levelFor('F#-major', 'scale'))[0].correct).toContain('E♯');
    expect(makeTasks(levelFor('C#-major', 'scale'))[0].correct).toContain('B♯');
    expect(makeTasks(levelFor('Cb-major', 'scale'))[0].correct).toContain('F♭');
  });

  it('품질 과제 정답은 실제 두 3도의 반음 간격으로 판정된다', () => {
    for (const key of KEYS) {
      for (const task of makeTasks(levelFor(key.id, 'quality'))) {
        const [lower, upper] = getTriadIntervals(task.notes!);
        const expected = ({ '4,3': 'major', '3,4': 'minor', '3,3': 'diminished', '4,4': 'augmented' } as const)[`${lower},${upper}` as '4,3'];
        expect(task.correct, `${key.id}/${task.id}`).toEqual([qualityNames[expected]]);
      }
    }
  });

  it('로마 숫자는 일곱 도수 연결·4도 구축·6도 청음으로 구성된다', () => {
    for (const key of KEYS) {
      const tasks = makeTasks(levelFor(key.id, 'roman'));
      expect(tasks).toHaveLength(9);
      for (const task of tasks.filter(task => task.id.startsWith('roman-') && task.kind === 'roman' && !task.audioOnly)) {
        expect(task.correct).toEqual([buildAllDiatonicTriads(key)[task.degree! - 1].romanNumeral]);
      }
      expect(tasks.find(task => task.id === 'roman-build')!.correct).toEqual(buildAllDiatonicTriads(key)[3].notes.map(note => note.display));
      expect(tasks.find(task => task.id === 'roman-ear')!.degree).toBe(6);
      expect(tasks.find(task => task.id === 'roman-ear')!.audioOnly).toBe(true);
    }
  });

  it('자연단조 v를 Em으로 유지하고 기능 해결 정답은 Am이다', () => {
    const tasks = makeTasks(levelFor('A-naturalMinor', 'function'));
    expect(tasks).toHaveLength(8);
    expect(tasks.find(task => task.degree === 5)!.notes!.map(note => note.display)).toEqual(['E', 'G', 'B']);
    expect(tasks.find(task => task.degree === 5)!.correct).toEqual([functionNames.dominant]);
    expect(tasks.find(task => task.kind === 'resolution')!.correct).toEqual(['Am']);
  });

  it('보스는 네 화음의 구축·품질, 순서 배열, 듣기와 해결 과제로 구성된다', () => {
    for (const key of KEYS) {
      const tasks = makeTasks(levelFor(key.id, 'progression'));
      expect(tasks).toHaveLength(11);
      expect(tasks.filter(task => task.kind === 'tower').map(task => task.degree)).toEqual(key.progression);
      expect(tasks.filter(task => task.kind === 'quality').map(task => task.degree)).toEqual(key.progression);
      const triads = buildAllDiatonicTriads(key);
      expect(tasks.find(task => task.kind === 'timeline')!.correct).toEqual(key.progression.map(degree => triads[degree - 1].symbol));
      expect(tasks.find(task => task.kind === 'playback')!.correct).toEqual(['listened']);
      expect(tasks.at(-1)!.correct).toEqual([triads[0].symbol]);
    }
  });

  it('상대조 과제는 같은 화음을 다른 으뜸음의 도수로 읽는다', () => {
    for (const level of LEVELS.filter(level => level.templateId === 'relative')) {
      const tasks = makeTasks(level);
      const key = getKey(level.keyId);
      const shared = buildAllDiatonicTriads(key)[0];
      const relative = getKey(key.relativeKeyId!);
      const match = buildAllDiatonicTriads(relative).find(triad => triad.symbol === shared.symbol)!;
      expect(tasks).toHaveLength(3);
      expect(tasks[0].correct).toEqual(['같은 음 · 다른 으뜸음']);
      expect(tasks[1].correct).toEqual([match.romanNumeral]);
    }
  });

  it('듣기 완료 과제를 제외하면 모든 정답이 선택지에서 실제로 선택 가능하다', () => {
    for (const level of LEVELS) {
      for (const task of makeTasks(level)) {
        if (task.kind === 'playback') continue;
        for (const answer of task.correct) expect(task.options, `${level.id}/${task.id}/${answer}`).toContain(answer);
      }
    }
  });

  it('같은 시드는 동일한 과제이며 다른 시드는 도수·선택지 순서를 바꾼다', () => {
    const level = levelFor('G-major', 'stack');
    expect(makeTasks(level)).toEqual(makeTasks(level));
    expect(makeTasks(level).map(task => task.degree)).not.toEqual(makeTasks({ ...level, seed: 'another-seed' }).map(task => task.degree));
    const scale = levelFor('G-major', 'scale');
    expect(makeTasks(scale)[0].options).not.toEqual(makeTasks({ ...scale, seed: 'another-seed' })[0].options);
  });

  it('생성 결과를 편집해도 조성 데이터와 다음 정답은 변형되지 않는다', () => {
    const level = levelFor('C-major', 'stack');
    const before = JSON.stringify(getKey(level.keyId));
    const tasks = makeTasks(level);
    tasks[0].correct[0] = 'wrong';
    tasks[0].options.push('wrong');
    expect(JSON.stringify(getKey(level.keyId))).toBe(before);
    expect(makeTasks(level)[0].correct).toEqual(['C', 'E', 'G']);
    expect(makeTasks(level)[0].options).not.toContain('wrong');
  });
});
