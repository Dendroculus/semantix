import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  benchmarkAnalysisResult,
  benchmarkDataset,
  persistedDataset,
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
  await page.route('**/api/v1/evaluations/datasets', async (route) => {
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
  await page.route('**/api/v1/evaluations/runs', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: benchmarkAnalysisResult,
    });
  });
  await page.route(
    `**/api/v1/evaluations/datasets/persisted/${persistedDataset.dataset_id}`,
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          ...persistedDataset,
          name: `${persistedDataset.name} with an intentionally long responsive label`,
          description:
            '<script>alert("catalog")</script> remains inert dataset text.',
        },
      });
    },
  );
  await page.route(
    '**/api/v1/evaluations/datasets/persisted?*',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          storage_mode: 'postgres',
          persistence_enabled: true,
          items: [
            {
              ...persistedDataset,
              name: `${persistedDataset.name} with an intentionally long responsive label`,
              description:
                '<script>alert("catalog")</script> remains inert dataset text.',
              cases: undefined,
            },
          ],
          total: 1,
          offset: 0,
          limit: 12,
          has_more: false,
          limits: {
            default_retention_days: 30,
            max_retention_days: 365,
            max_persisted_per_namespace: 100,
          },
        },
      });
    },
  );
  await page.route(
    '**/api/v1/evaluations/datasets/validate',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          schema_version: 1,
          dataset_id: 'custom:1234567890abcdef',
          digest: '9'.repeat(64),
          name: 'Imported responsive dataset with a long readable name',
          description: 'Synthetic session-local dataset.',
          case_count: 1,
          expected_hits: 0,
          expected_misses: 1,
          categories: ['uncategorized'],
          decoded_bytes: 180,
          warnings: [
            {
              code: 'uncategorized_cases',
              detail:
                'Cases without a category are grouped as uncategorized.',
              count: 1,
            },
          ],
          query_executions: 1,
          threshold_projection_evaluations: 7,
          maximum_provider_calls: 1,
          provider_calls_made: 0,
          limits: {
            max_cases: 50,
            max_decoded_bytes: 49_152,
            max_workload_queries: 250,
          },
        },
      });
    },
  );
});

test('persistent catalog remains readable and bounded at required widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1_180 });
  await page.goto('/evaluations');

  const datasetsView = page.getByRole('button', { name: 'Datasets' });
  await datasetsView.focus();
  await page.keyboard.press('Enter');
  await expect(datasetsView).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: 'Evaluation datasets' }),
  ).toBeVisible();
  await expect(page.getByText('<script>alert("catalog")</script>', {
    exact: false,
  })).toBeVisible();
  await expect(
    page.locator('script').filter({ hasText: 'alert("catalog")' }),
  ).toHaveCount(0);

  for (const width of [320, 744, 768, 820, 834, 1_024, 1_280]) {
    await test.step(`catalog-${width}`, async () => {
      await page.setViewportSize({ width, height: 1_180 });
      await expect(
        page.getByRole('heading', { name: 'Persisted catalog' }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  const detailTrigger = page.getByRole('button', { name: 'View details' });
  await detailTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Dataset detail' }),
  ).toBeVisible();
  await expect(
    page.getByText('Expected repeat.', { exact: true }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('session-local import remains readable and bounded at required widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1_180 });
  await page.goto('/evaluations');
  await page.getByLabel('Custom JSON dataset').check();
  const fileInput = page.getByLabel('JSON dataset file');
  await fileInput.setInputFiles({
    name: 'responsive.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schema_version: 1,
        name: 'Imported responsive dataset with a long readable name',
        cases: [
          {
            case_id: 'synthetic',
            prompt: '<strong>=SUM(A1:A2)</strong>',
            expected_cache_hit: false,
          },
        ],
      }),
    ),
  });

  await expect(page.getByText('Validated preview')).toBeVisible();
  await expect(page.getByText(/Validation made 0 provider calls/)).toBeVisible();

  for (const width of [320, 744, 768, 820, 834, 1_024, 1_280]) {
    await test.step(`import-${width}`, async () => {
      await page.setViewportSize({ width, height: 1_180 });
      await expect(fileInput).toBeVisible();
      await expect(page.getByText('Validated preview')).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  await page.getByRole('button', { name: 'Review benchmark run' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Imported prompts may leave this system',
  );
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Remove imported dataset' }).click();
  await expect(fileInput).toBeFocused();
  await expect(page.getByText('Validated preview')).toHaveCount(0);
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
