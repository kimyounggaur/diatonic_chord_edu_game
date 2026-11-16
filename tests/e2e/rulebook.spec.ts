import { expect, test } from '@playwright/test';

test('롤북을 둘러보고 닫아도 진행 중인 음계 배치는 유지된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '모험 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '복원 시작하기', exact: true }).click();
  await page.getByRole('button', { name: 'D 카드 배치', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '2번째 슬롯 D' })).toBeVisible();

  const trigger = page.getByRole('button', { name: '게임 롤북 열기' });
  await trigger.click();
  const guide = page.getByRole('dialog', { name: '코드 크래프터 그림 롤북' });
  await expect(guide).toBeVisible();
  await expect(guide.getByText('한 지역의 모험')).toBeVisible();
  for (let i = 0; i < 4; i++) await guide.getByRole('button', { name: '다음 장' }).click();
  await expect(guide.getByText('네 가지 3화음의 공식')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('checkbox', { name: '2번째 슬롯 D' })).toBeVisible();
});
