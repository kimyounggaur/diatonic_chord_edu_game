import { buildScale, parseNote, type Accidental, type KeyDefinition, type Letter, type LevelDefinition, type TemplateId } from '../domain/theory';
export interface WorldDefinition {
  id: string;
  name: string;
  majorKeyId: string;
  minorKeyId: string;
  advanced: boolean;
  order: number;
  description: string;
}
interface WorldSeed { major: string; minor: string; name: string; description: string; advanced?: boolean }
const worldSeeds: WorldSeed[] = [
  { major: 'C', minor: 'A', name: '무조표의 정원', description: '일곱 음과 첫 번째 화음 탑을 발견해요.' },
  { major: 'G', minor: 'E', name: '한 개의 빛나는 문', description: '첫 샤프 F♯가 열어 주는 길.' },
  { major: 'F', minor: 'D', name: '한 개의 그림자 문', description: 'B♭의 부드러운 빛을 따라가요.' },
  { major: 'D', minor: 'B', name: '두 개의 톱니섬', description: 'F♯와 C♯, 두 톱니가 맞물려요.' },
  { major: 'Bb', minor: 'G', name: '두 개의 안개섬', description: '두 플랫 속에서도 1·3·5 규칙은 같아요.' },
  { major: 'A', minor: 'F#', name: '세 개의 번개탑', description: '세 샤프 위로 화음의 빛을 쌓아요.' },
  { major: 'Eb', minor: 'C', name: '세 개의 수정동굴', description: '같은 조표, 서로 다른 중심을 들어 봐요.' },
  { major: 'E', minor: 'C#', name: '네 개의 전류도시', description: '품질과 기능을 연결해 도시를 밝혀요.' },
  { major: 'Ab', minor: 'F', name: '네 개의 구름성', description: '음이름의 글자 순서를 지키며 구름을 건너요.' },
  { major: 'B', minor: 'G#', name: '다섯 개의 태양관문', description: '다섯 샤프의 원리를 다른 조성으로 옮겨요.' },
  { major: 'Db', minor: 'Bb', name: '다섯 개의 달관문', description: '플랫의 철자를 지키며 코어를 복원해요.' },
  { major: 'Gb', minor: 'Eb', name: '여섯 개의 거울왕국', description: 'C♭도 온전한 음계의 일원이에요.' },
  { major: 'F#', minor: 'D#', name: '거울 Ⅰ · 샤프 수정원', description: 'G♭과 같은 소리, E♯를 쓰는 다른 철자.', advanced: true },
  { major: 'C#', minor: 'A#', name: '거울 Ⅱ · 일곱 빛의 탑', description: '일곱 샤프와 B♯의 표기를 발견해요.', advanced: true },
  { major: 'Cb', minor: 'Ab', name: '거울 Ⅲ · 구름의 이면', description: 'C♭과 F♭의 글자를 지켜 마지막 거울을 밝혀요.', advanced: true },
];
export const WORLDS: WorldDefinition[] = worldSeeds.map((item, index) => ({
  id: `world-${String(index + 1).padStart(2, '0')}`, name: item.name, majorKeyId: `${item.major}-major`, minorKeyId: `${item.minor}-naturalMinor`, advanced: Boolean(item.advanced), order: index + 1, description: item.description,
}));
const aliases: Record<string, string> = { 'Gb-major': 'F#-major', 'F#-major': 'Gb-major', 'Db-major': 'C#-major', 'C#-major': 'Db-major', 'B-major': 'Cb-major', 'Cb-major': 'B-major', 'Eb-naturalMinor': 'D#-naturalMinor', 'D#-naturalMinor': 'Eb-naturalMinor', 'Bb-naturalMinor': 'A#-naturalMinor', 'A#-naturalMinor': 'Bb-naturalMinor', 'G#-naturalMinor': 'Ab-naturalMinor', 'Ab-naturalMinor': 'G#-naturalMinor' };
export const KEYS: KeyDefinition[] = WORLDS.flatMap((world, index) => {
  const seed = worldSeeds[index];
  return ([['major', seed.major], ['naturalMinor', seed.minor]] as const).map(([mode, tonicName]) => {
    const tonic = parseNote(tonicName);
    const scale = buildScale({ tonic, mode });
    const signature: Partial<Record<Letter, Accidental>> = {};
    for (const note of scale) if (note.accidental !== 'natural') signature[note.letter] = note.accidental;
    const id = `${tonicName}-${mode}`;
    const previous = index > 0 ? WORLDS[index - 1] : undefined;
    return {
      id, tonic, mode, koreanName: `${tonic.display} ${mode === 'major' ? '장조' : '자연단조'}`,
      keySignature: signature, scale, relativeKeyId: mode === 'major' ? world.minorKeyId : world.majorKeyId,
      enharmonicAliasIds: aliases[id] ? [aliases[id]] : [],
      progression: mode === 'naturalMinor' ? [1, 6, 3, 7] : index === 0 ? [1, 6, 4, 5] : [1, 5, 6, 4],
      signatureCount: Object.keys(signature).length, worldId: world.id, mapOrder: index + 1,
      themeId: `${world.advanced ? 'mirror' : tonicName.includes('b') ? 'cloud' : tonicName === 'C' ? 'garden' : 'crystal'}-${mode === 'major' ? 'sun' : 'moon'}`,
      unlockPrerequisite: mode === 'naturalMinor' ? `${world.majorKeyId}-progression` : previous ? `${previous.id}-relative` : undefined,
    };
  });
});
export const KEY_BY_ID: Record<string, KeyDefinition> = Object.fromEntries(KEYS.map(key => [key.id, key]));
export function getKey(id: string): KeyDefinition {
  const result = KEY_BY_ID[id];
  if (!result) throw new Error(`알 수 없는 조성: ${id}`);
  return result;
}
export interface LevelTemplate { id: TemplateId; title: string; learningObjectives: string[]; npc: string; instruction: string }
export const templates: LevelTemplate[] = [
  { id: 'scale', title: '조표 문 열기', learningObjectives: ['scaleSpelling', 'keySignature'], npc: '루미', instruction: '으뜸음부터 글자 순서와 조표를 지켜 일곱 음을 배열해요.' },
  { id: 'stack', title: '3도 계단 오르기', learningObjectives: ['stackedThirds'], npc: '테르티', instruction: '음계에서 하나 건너뛰고, 또 하나 건너뛰어 1·3·5를 쌓아요.' },
  { id: 'quality', title: '화음 품질 감정소', learningObjectives: ['triadQuality', 'auralQuality'], npc: '센토', instruction: '두 3도의 반음 수를 세어 장·단·감·증을 구별해요.' },
  { id: 'roman', title: '로마 숫자 도서관', learningObjectives: ['romanNumeral'], npc: '로마', instruction: '도수와 화음 품질을 로마 숫자로 연결해요.' },
  { id: 'function', title: '기능 다리 복원', learningObjectives: ['harmonicFunction'], npc: '도미나', instruction: '토닉은 집, 프리도미넌트는 길, 도미넌트는 귀환을 부르는 문이에요.' },
  { id: 'progression', title: '진행 코어 보스전', learningObjectives: ['stackedThirds', 'triadQuality', 'harmonicFunction'], npc: '도미나', instruction: '네 화음을 쌓고 순서대로 이어, 마지막에 으뜸화음으로 해결해요.' },
  { id: 'relative', title: '태양과 달의 비교', learningObjectives: ['relativeKey'], npc: '루미', instruction: '같은 음을 사용해도 중심음이 달라지면 도수와 역할이 달라져요.' },
];
export const LEVEL_TEMPLATES = templates;
export const LEVELS: LevelDefinition[] = WORLDS.flatMap(world => {
  const levels: LevelDefinition[] = [world.majorKeyId, world.minorKeyId].flatMap(keyId => {
    const key = getKey(keyId);
    return templates.filter(template => template.id !== 'relative').map((template, localIndex) => ({
      id: `${keyId}-${template.id}`, keyId, worldId: world.id, templateId: template.id, title: template.title,
      difficulty: 1 + key.signatureCount + (key.mode === 'naturalMinor' ? 1 : 0) + (world.advanced ? 2 : 0),
      seed: `tonterra:v1:${keyId}:${template.id}`, learningObjectives: [...template.learningObjectives],
      order: (world.order - 1) * 13 + (key.mode === 'major' ? 0 : 6) + localIndex + 1,
    }));
  });
  const relative = templates.find(template => template.id === 'relative')!;
  levels.push({ id: `${world.id}-relative`, keyId: world.majorKeyId, worldId: world.id, templateId: 'relative', title: relative.title, difficulty: 2 + getKey(world.majorKeyId).signatureCount, seed: `tonterra:v1:${world.id}:relative`, learningObjectives: [...relative.learningObjectives], order: world.order * 13 });
  return levels;
});
export const CORE_LEVELS = LEVELS.filter(level => WORLDS.some(world => world.id === level.worldId && !world.advanced));
