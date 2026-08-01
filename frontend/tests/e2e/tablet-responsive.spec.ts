import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  benchmarkAnalysisResult,
  benchmarkDataset,
} from '../features/benchmark/support';

const VIEWPORTS = [
  { name: 'minimum', width: 320, height: 720 },
  { name: 'tablet-744', width: 744, height: 1_024 },
  { name: 'tablet-768', width: 768, height: 1_024 },
  { name: 'tablet-820', width: 820, height: 1_180 },
  { name: 'tablet-834', width: 834, height: 1_194 },
  { name: 'landscape-1133', width: 1_133, height: 744 },
  { name: 'landscape-1366', width: 1_366, height: 768 },
  { name: 'desktop-1024', width: 1_024, height: 900 },
  { name: 'desktop-1280', width: 1_280, height: 900 },
  {
    name: 'zoom-200-equivalent-at-1280',
    width: 640,
    height: 900,
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { authentication_required: false },
    });
  });
  await page.route('**/api/v1/benchmarks/datasets', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        datasets: [
          {
            ...benchmarkDataset,
            name: `${benchmarkDataset.name} with an intentionally long responsive label`,
          },
        ],
        default_dataset_id: 'quick',
      },
    });
  });
  await page.route('**/api/v1/benchmarks/run', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: benchmarkAnalysisResult,
    });
  });
});

test('evaluation controls and projections remain usable at required viewports', async ({
  page,
}) => {
  test.setTimeout(60_000);

  for (const viewport of VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.goto('/evaluations');
      await expect(
        page.getByRole('heading', { name: 'Evaluation laboratory' }),
      ).toBeVisible();
      await expect(page.getByLabel('Benchmark dataset')).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      if (
        [744, 768, 820, 834].includes(viewport.width)
      ) {
        const columns = await page
          .locator('[data-benchmark-controls] > label')
          .evaluateAll((labels) => {
            const positions = labels.map((label) =>
              Math.round(label.getBoundingClientRect().left),
            );
            return new Set(positions).size;
          });
        expect(columns).toBeLessThanOrEqual(2);
      }

      const disclosure = page.getByRole('button', {
        name: 'Advanced frozen-candidate sweep',
      });
      await disclosure.focus();
      await page.keyboard.press('Enter');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByLabel('Threshold sweep start')).toBeVisible();
    });
  }

  await test.step('increased text size', async () => {
    await page.setViewportSize({ width: 1_280, height: 900 });
    await page.goto('/evaluations');
    await page.locator('html').evaluate((element) => {
      element.style.fontSize = '200%';
    });
    await expect(page.getByLabel('Benchmark dataset')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review benchmark run' }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  await page.setViewportSize({ width: 820, height: 1_180 });
  await page.goto('/evaluations');
  await page.getByRole('button', { name: 'Review benchmark run' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'may make at most',
  );
  await page.getByRole('button', { name: 'Run benchmark now' }).click();
  await expect(
    page.getByText('Measured run', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Run identity and safe reproducibility metadata'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Hit rate vs. threshold (frozen-candidate projection)',
      { exact: true },
    ),
  ).toBeVisible();

  const chartTables = page.getByRole('table', {
    name: /frozen-candidate projection.*data/i,
  });
  await expect(chartTables).toHaveCount(4);

  const falsePositiveFilter = page.getByRole('button', {
    name: 'False positive: 1 case',
  });
  await falsePositiveFilter.focus();
  await page.keyboard.press('Enter');
  await expect(falsePositiveFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Showing 1 of 4 cases/)).toBeVisible();

  const detailTrigger = page.getByRole('button', {
    name: 'View details for case shared-miss, repetition 2',
  });
  await detailTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Case shared-miss' }),
  ).toBeVisible();
  await expect(
    page.getByText(/run-local evaluation cache/),
  ).toBeVisible();
  await expect(
    page.locator('#benchmark-case-detail a'),
  ).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'Close case details' }).click();
  await expect(detailTrigger).toBeFocused();

  for (const viewport of VIEWPORTS) {
    await test.step(`analysis-${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole('group', {
          name: 'Measured run confusion matrix',
        }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      const overflowSources = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter(
            (element) =>
              element.getBoundingClientRect().right >
              document.documentElement.clientWidth + 1,
          )
          .slice(0, 10)
          .map((element) => ({
            className: element.className,
            right: Math.round(element.getBoundingClientRect().right),
            tag: element.tagName,
            text: element.textContent?.trim().slice(0, 80),
          })),
      );
      expect(
        overflow,
        JSON.stringify(overflowSources),
      ).toBeLessThanOrEqual(1);

      if ([744, 768, 820, 834].includes(viewport.width)) {
        const columns = await page
          .locator('[data-confusion-matrix] > button')
          .evaluateAll((buttons) => {
            const positions = buttons.map((button) =>
              Math.round(button.getBoundingClientRect().left),
            );
            return new Set(positions).size;
          });
        expect(columns).toBeLessThanOrEqual(2);
      }
    });
  }

  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('button', {
    name: 'View details for case shared-miss, repetition 2',
  }).click();
  await expect(
    page.getByRole('heading', { name: 'Case shared-miss' }),
  ).toBeVisible();
  const detailOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(detailOverflow).toBeLessThanOrEqual(1);
});
