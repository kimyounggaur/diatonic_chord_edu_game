import { test, expect, type Page } from '@playwright/test';

const C_SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const C_CHORDS: Record<string, { notes: string[]; roman: string; symbol: string; function: string }> = {
  C: { notes: ['C', 'E', 'G'], roman: 'I', symbol: 'C', function: '집 · 토닉' },
  D: { notes: ['D', 'F', 'A'], roman: 'ii', symbol: 'Dm', function: '길 · 프리도미넌트' },
  E: { notes: ['E', 'G', 'B'], roman: 'iii', symbol: 'Em', function: '집 · 토닉' },
  F: { notes: ['F', 'A', 'C'], roman: 'IV', symbol: 'F', function: '길 · 프리도미넌트' },
  G: { notes: ['G', 'B', 'D'], roman: 'V', symbol: 'G', function: '문 · 도미넌트' },
  A: { notes: ['A', 'C', 'E'], roman: 'vi', symbol: 'Am', function: '집 · 토닉' },
  B: { notes: ['B', 'D', 'F'], roman: 'vii°', symbol: 'Bdim', function: '문 · 도미넌트' },
};

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth })))
    .toEqual(expect.objectContaining({ viewport: test.info().project.use.viewport!.width }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function startFirstStage(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '모험 시작하기', exact: true }).tap();
  await expect(page.getByRole('heading', { name: '조표 문 열기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '복원 시작하기', exact: true }).tap();
  await expect(page.getByRole('heading', { name: '흩어진 음계 조각을 모아요', exact: true })).toBeVisible();
}

async function placeCard(page: Page, note: string) {
  await page.getByRole('button', { name: `${note} 카드 배치`, exact: true }).tap();
}

async function confirmAndAdvance(page: Page) {
  await page.getByRole('button', { name: '완성 확인하기', exact: true }).tap();
  await expect(page.getByRole('status')).toContainText('원리를 발견했어요');
  const last = page.getByRole('button', { name: '복원 결과 보기', exact: true });
  if (await last.isVisible()) await last.tap();
  else await page.getByRole('button', { name: '다음 발견으로', exact: true }).tap();
}

async function finishScale(page: Page, fromDegree = 1) {
  for (const note of C_SCALE.slice(fromDegree)) await placeCard(page, note);
  await confirmAndAdvance(page);
  await expect(page.getByRole('heading', { name: '반음 발판 두 곳을 찾아요' })).toBeVisible();
  await page.getByRole('button', { name: /^E → F/ }).tap();
  await page.getByRole('button', { name: /^B → C/ }).tap();
  await confirmAndAdvance(page);
  await expect(page.getByRole('heading', { name: '빛이 다시 연결됐어요!' })).toBeVisible();
}

async function readSavedProgress(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('chord-crafter-save') || '{}').progress);
}

/** Read-only UI evidence determines which musical task is being solved. No store injection. */
async function solveCurrentCTask(page: Page) {
  const title = (await page.locator('.puzzle-title h1').textContent()) || '';
  if (await page.locator('.chord-tower').isVisible()) {
    const root = (await page.locator('.chord-tower .note-slot').first().locator('strong').textContent())!.trim();
    const chord = C_CHORDS[root];
    expect(chord, `C major triad for root ${root}`).toBeTruthy();
    for (const note of chord.notes.slice(1)) await placeCard(page, note);
  } else if (await page.locator('.interval-meter').isVisible()) {
    const gaps = await page.locator('.interval-meter > div > strong').allTextContents();
    const seal = ({ '4반음|3반음': '장 · M', '3반음|4반음': '단 · m', '3반음|3반음': '감 · °', '4반음|4반음': '증 · +' } as Record<string, string>)[gaps.join('|')];
    expect(seal).toBeTruthy();
    await page.getByRole('button', { name: seal, exact: true }).tap();
  } else if (await page.locator('.timeline-slots').isVisible()) {
    for (const symbol of ['C', 'Am', 'F', 'G']) await placeCard(page, symbol);
  } else if (await page.locator('.playback-panel').isVisible()) {
    await page.getByRole('button', { name: '진행 연주하기', exact: true }).tap();
    await expect(page.getByText('전체 진행을 들었어요.', { exact: true })).toBeVisible({ timeout: 20_000 });
  } else if (title === '화음을 로마 숫자로 기록해요') {
    const prompt = await page.locator('.puzzle-title > p').textContent();
    const degree = Number(prompt?.match(/(\d)번째/)?.[1]);
    expect(degree).toBeGreaterThan(0);
    await page.getByRole('button', { name: C_CHORDS[C_SCALE[degree - 1]].roman, exact: true }).tap();
  } else if (title === '듣고 로마 숫자를 연결해요') {
    await page.getByRole('button', { name: '현재 음 듣기', exact: true }).tap();
    await page.getByRole('button', { name: 'vi', exact: true }).tap();
  } else if (title === '화음이 머무를 섬을 찾아요') {
    const prompt = (await page.locator('.puzzle-title > p').textContent()) || '';
    const chord = Object.values(C_CHORDS).find(chord => prompt.startsWith(`${chord.symbol} (`));
    expect(chord).toBeTruthy();
    await page.locator('.choice-grid').getByRole('button').filter({ hasText: chord!.function }).tap();
  } else if (title === '긴장을 집으로 돌려보내요' || title === '마지막 코어를 중심에 맞춰요') {
    await page.getByRole('button', { name: 'C', exact: true }).tap();
  } else {
    throw new Error(`Unexpected C-major task: ${title}`);
  }
  await expectNoHorizontalOverflow(page);
  await confirmAndAdvance(page);
}

async function completeNextCStage(page: Page, expectedTitle: string) {
  await page.getByRole('button', { name: '다음 임무', exact: true }).tap();
  await expect(page.locator('.level-intro h1')).toHaveText(expectedTitle);
  await page.getByRole('button', { name: '복원 시작하기', exact: true }).tap();
  for (let i = 0; i < 15; i++) {
    if (await page.locator('.result-panel').isVisible()) return;
    await solveCurrentCTask(page);
  }
  throw new Error(`Stage ${expectedTitle} did not finish within its expected task count`);
}

test('C 음계 배열과 반음 발견 후 별이 새로고침에도 유지된다', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await startFirstStage(page);
  await expectNoHorizontalOverflow(page);
  await finishScale(page);
  await expect(page.getByLabel('별 3개', { exact: true })).toBeVisible();
  const saved = await readSavedProgress(page);
  expect(saved.completedLevelIds).toContain('C-major-scale');
  expect(saved.starsByLevel['C-major-scale']).toBe(3);
  await page.reload();
  await expect(page.getByRole('button', { name: '이어서 모험하기', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect((await readSavedProgress(page)).starsByLevel['C-major-scale']).toBe(3);
  await page.getByRole('button', { name: '이어서 모험하기', exact: true }).tap();
  await expect(page.locator('.level-intro h1')).toHaveText('3도 계단 오르기');
  expect(pageErrors).toEqual([]);
});

test('세 번의 오답 뒤 자동완성은 직접 재현해야 통과한다', async ({ page }) => {
  await startFirstStage(page);
  for (let wrong = 0; wrong < 3; wrong++) await page.getByRole('button', { name: '완성 확인하기', exact: true }).tap();
  await expect(page.getByRole('status')).toContainText('완성 경로');
  await expect(page.getByRole('button', { name: '다음 발견으로', exact: true })).toHaveCount(0);
  expect((await readSavedProgress(page)).completedLevelIds).not.toContain('C-major-scale');
  await page.getByRole('button', { name: '직접 다시 만들기', exact: true }).tap();
  await expect(page.getByRole('button', { name: '2번째 슬롯 비어 있음', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 발견으로', exact: true })).toHaveCount(0);
  await finishScale(page);
  await expect(page.getByLabel('별 1개', { exact: true })).toBeVisible();
  expect((await readSavedProgress(page)).starsByLevel['C-major-scale']).toBe(1);
});

test('포인터 드래그와 터치 탭으로 같은 음계 슬롯을 배치한다', async ({ page }) => {
  await startFirstStage(page);
  const card = page.getByRole('button', { name: 'D 카드 배치', exact: true });
  const slot = page.getByRole('button', { name: '2번째 슬롯 비어 있음', exact: true });
  await card.scrollIntoViewIfNeeded();
  await slot.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await slot.boundingBox();
  expect(from).toBeTruthy();
  expect(to).toBeTruthy();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '2번째 슬롯 D', exact: true })).toBeVisible();
  await finishScale(page, 2);
  await expect(page.getByLabel('별 3개', { exact: true })).toBeVisible();
});

test('음소거와 모션 감소를 켜고 설정을 유지한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '음소거', exact: true }).tap();
  await expect(page.getByRole('button', { name: '음소거 해제', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '환경 설정 열기', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: '나에게 맞게 설정하기', exact: true });
  await expect(dialog.getByRole('switch', { name: /^음소거/ })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('switch', { name: /^모션 감소/ }).tap();
  await expect(dialog.getByRole('switch', { name: /^모션 감소/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await expectNoHorizontalOverflow(page);
  await dialog.getByRole('button', { name: '닫기', exact: true }).tap();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await expect(page.getByRole('button', { name: '음소거 해제', exact: true })).toBeVisible();
});

test('모든 주요 화면에 가로 스크롤과 치명 오류가 없다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of ['/', '/#map', '/#codex', '/#practice', '/#challenge']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto('/#codex');
  await page.getByLabel('조성 선택', { exact: true }).selectOption('Gb-major');
  await expect(page.locator('.codex-chords')).toContainText('C♭');
  await page.getByLabel('조성 선택', { exact: true }).selectOption('A-naturalMinor');
  const fifth = page.locator('.chord-record').filter({ has: page.locator('.roman-badge', { hasText: /^v$/ }) });
  await expect(fifth).toContainText('Em');
  expect(errors).toEqual([]);
});

test('C 장조 6개 임무를 실제 조작으로 복원하고 A 자연단조를 연다', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startFirstStage(page);
  await finishScale(page);
  for (const title of ['3도 계단 오르기', '화음 품질 감정소', '로마 숫자 도서관', '기능 다리 복원', '진행 코어 보스전']) {
    await completeNextCStage(page, title);
    await expect(page.getByLabel('별 3개', { exact: true })).toBeVisible();
  }
  const saved = await readSavedProgress(page);
  expect(saved.completedLevelIds.filter((id: string) => id.startsWith('C-major-'))).toHaveLength(6);
  expect(saved.unlockedKeyIds).toContain('A-naturalMinor');
  await page.getByRole('button', { name: '다음 임무', exact: true }).tap();
  await expect(page.locator('.level-intro h1')).toHaveText('조표 문 열기');
  await expect(page.locator('.intro-card > p')).toContainText('A 자연단조');
  expect(errors).toEqual([]);
});
