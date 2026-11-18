import { expect, test, type Page } from '@playwright/test';

const C = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const A = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const MAJOR_SYMBOL = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'];
const MINOR_SYMBOL = ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'];
const MAJOR_QUALITY = ['장 · M', '단 · m', '단 · m', '장 · M', '장 · M', '단 · m', '감 · °'];
const MINOR_QUALITY = ['단 · m', '감 · °', '장 · M', '단 · m', '단 · m', '장 · M', '장 · M'];

async function fixedScreen(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  const bounds = await page.evaluate(() => ({
    width: window.innerWidth, height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    controls: Array.from(document.querySelectorAll<HTMLElement>('button,input,select')).flatMap(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return [];
      return [{ label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
    }),
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.height + 1);
  for (const control of bounds.controls) {
    expect(control.left, `${control.label}: left edge`).toBeGreaterThanOrEqual(-1);
    expect(control.top, `${control.label}: top edge`).toBeGreaterThanOrEqual(-1);
    expect(control.right, `${control.label}: right edge`).toBeLessThanOrEqual(bounds.width + 1);
    expect(control.bottom, `${control.label}: bottom edge`).toBeLessThanOrEqual(bounds.height + 1);
  }
  const feedback = page.getByTestId('feedback');
  if (await feedback.isVisible()) {
    const message = await feedback.boundingBox();
    const actions = await page.locator('.rp-actions').boundingBox();
    expect(message!.y + message!.height, '오답 설명을 하단 버튼이 가리지 않는다').toBeLessThanOrEqual(actions!.y + 1);
  }
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('chord-crafter-save') || '{}'));
}

async function begin(page: Page) {
  await page.goto('/remaster.html');
  await page.getByRole('button', { name: '모험 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '복원 시작하기', exact: true }).click();
  await expect(page.getByTestId('remaster-task')).toHaveAttribute('data-kind', 'scale');
}

async function card(page: Page, note: string) {
  await page.getByRole('button', { name: `${note} 카드 배치`, exact: true }).click();
}

async function advance(page: Page) {
  await page.getByRole('button', { name: '완성 확인하기', exact: true }).click();
  await expect(page.getByTestId('feedback')).toContainText('원리를 발견');
  await fixedScreen(page);
  const result = page.getByRole('button', { name: '복원 결과 보기', exact: true });
  if (await result.isVisible()) await result.click();
  else await page.getByRole('button', { name: '다음 발견으로', exact: true }).click();
}

/** Expected music is independent of the app's question generator. No progress injection. */
async function solveTask(page: Page, minor: boolean, seen: Set<string>) {
  const task = page.getByTestId('remaster-task');
  const kind = (await task.getAttribute('data-kind'))!;
  const id = (await task.getAttribute('data-task-id'))!;
  const degree = Number(await task.getAttribute('data-degree')) || 1;
  const notes = minor ? A : C;
  const romans = minor ? MINOR_ROMAN : MAJOR_ROMAN;
  const symbols = minor ? MINOR_SYMBOL : MAJOR_SYMBOL;
  seen.add(kind);
  if (kind === 'scale') {
    for (const note of notes.slice(1)) await card(page, note);
  } else if (kind === 'halfsteps') {
    await page.getByRole('button', { name: 'E에서 F 구간 선택', exact: true }).click();
    await page.getByRole('button', { name: 'B에서 C 구간 선택', exact: true }).click();
  } else if (kind === 'tower') {
    await card(page, notes[(degree + 1) % 7]);
    await card(page, notes[(degree + 3) % 7]);
  } else if (kind === 'quality') {
    await page.getByRole('button', { name: (minor ? MINOR_QUALITY : MAJOR_QUALITY)[degree - 1], exact: true }).click();
  } else if (kind === 'roman') {
    await page.getByRole('button', { name: romans[degree - 1], exact: true }).click();
  } else if (kind === 'function') {
    const role = [1, 3, 6].includes(degree) ? '집 · 토닉' : [2, 4].includes(degree) ? '길 · 프리도미넌트' : '문 · 도미넌트';
    await page.getByRole('button', { name: role, exact: true }).click();
  } else if (kind === 'resolution') {
    await page.getByRole('button', { name: symbols[0], exact: true }).click();
  } else if (kind === 'timeline') {
    for (const note of minor ? ['Am', 'F', 'C', 'G'] : ['C', 'Am', 'F', 'G']) await card(page, note);
  } else if (kind === 'playback') {
    await page.getByRole('button', { name: '진행 연주하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '완성 확인하기', exact: true })).toBeEnabled({ timeout: 20_000 });
  } else if (kind === 'relative') {
    const answer = id === 'relative-notes' ? '같은 음 · 다른 으뜸음' : id === 'relative-roman' ? 'III' : '시작·해결·베이스를 함께';
    await page.getByRole('button', { name: answer, exact: true }).click();
  } else throw new Error(`Unsupported visible task: ${kind}`);
  await advance(page);
}

test('홈·지도·도감·연습·도전이 스크롤 없는 한 화면에 들어온다', async ({ page }) => {
  await page.goto('/remaster.html');
  await expect(page.getByRole('heading', { name: '코드 크래프터', exact: true })).toBeVisible();
  await fixedScreen(page);
  for (const name of ['지도', '도감', '연습', '도전', '홈']) {
    await page.getByRole('button', { name, exact: true }).click();
    await fixedScreen(page);
  }
  await page.getByRole('button', { name: '게임 롤북 열기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('음계 정답 띠를 숨기고 세 번 오답 뒤 직접 재현해야 통과한다', async ({ page }) => {
  await begin(page);
  await expect(page.getByTestId('scale-ring')).toHaveAccessibleName('음계 배치 고리');
  for (let i = 1; i < 7; i++) await expect(page.getByTestId('note-slot').nth(i)).toHaveAccessibleName(`${i + 1}번째 슬롯 비어 있음`);
  for (let n = 0; n < 3; n++) await page.getByRole('button', { name: '완성 확인하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '직접 다시 만들기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 발견으로', exact: true })).toBeHidden();
  await fixedScreen(page);
  await page.getByRole('button', { name: '직접 다시 만들기', exact: true }).click();
  for (const note of C.slice(1)) await card(page, note);
  await advance(page);
  await page.getByRole('button', { name: 'E에서 F 구간 선택', exact: true }).click();
  await page.getByRole('button', { name: 'B에서 C 구간 선택', exact: true }).click();
  await advance(page);
  const state = await saved(page);
  expect(state.progress.completedLevelIds).toContain('C-major-scale');
  expect(state.progress.starsByLevel['C-major-scale']).toBe(1);
  await page.reload();
  expect((await saved(page)).progress.starsByLevel['C-major-scale']).toBe(1);
});

test('드래그·탭 배치와 롤북 닫기에서 답을 유지하고 힌트 감점을 적용한다', async ({ page }) => {
  await begin(page);
  const source = await page.getByRole('button', { name: 'D 카드 배치', exact: true }).boundingBox();
  const target = await page.getByTestId('note-slot').nth(1).boundingBox();
  expect(source).toBeTruthy(); expect(target).toBeTruthy();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('note-slot').nth(1)).toHaveAccessibleName('2번째 슬롯 D');
  await page.getByRole('button', { name: '게임 롤북 열기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('note-slot').nth(1)).toHaveAccessibleName('2번째 슬롯 D');
  await page.getByRole('button', { name: '힌트 15점 차감', exact: true }).click();
  for (const note of C.slice(2)) await card(page, note);
  await advance(page);
  await page.getByRole('button', { name: 'E에서 F 구간 선택', exact: true }).click();
  await page.getByRole('button', { name: 'B에서 C 구간 선택', exact: true }).click();
  await advance(page);
  await expect(page.locator('.rp-result-stats')).toContainText('93');
  expect((await saved(page)).progress.starsByLevel['C-major-scale']).toBe(3);
});

test('첫 지역을 완주하며 10종 과제·장단조 해금·저장 호환성을 검증한다', async ({ page }) => {
  await begin(page);
  const seen = new Set<string>();
  for (let stage = 0; stage < 13; stage++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!(await page.getByTestId('remaster-task').isVisible())) break;
      await solveTask(page, stage >= 6 && stage < 12, seen);
    }
    const state = await saved(page);
    expect(state.progress.completedLevelIds.length).toBe(stage + 1);
    expect(state.schemaVersion).toBe(1);
    if (stage === 5) expect(state.progress.unlockedKeyIds).toContain('A-naturalMinor');
    if (stage < 12) {
      await page.getByRole('button', { name: '다음 임무', exact: true }).click();
      await page.getByRole('button', { name: '복원 시작하기', exact: true }).click();
    }
  }
  expect([...seen].sort()).toEqual(['function', 'halfsteps', 'playback', 'quality', 'relative', 'resolution', 'roman', 'scale', 'timeline', 'tower']);
  expect((await saved(page)).progress.unlockedKeyIds).toContain('G-major');
});
