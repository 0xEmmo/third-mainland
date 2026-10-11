import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Headless Chromium draws with a software GPU, so tests use WebGL 2 and fewer particles. */
export const APP = '/?renderer=webgl&particles=3000'

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 760

export async function open(page: Page, url = APP) {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Third Mainland', level: 1 })).toBeVisible()
  await expect(page.getByText('WebGL 2', { exact: true })).toBeVisible({ timeout: 20_000 })
  // Stop the clock so assertions about times are stable.
  const pause = page.getByRole('button', { name: 'Pause the clock' })
  if (await pause.isVisible()) await pause.click()
}

/** On phones the corridor list lives in the sheet's first tab. */
export async function showList(page: Page) {
  if (isPhone(page)) await page.getByRole('tab', { name: 'Corridors' }).click()
}

export async function showLayers(page: Page) {
  if (isPhone(page)) await page.getByRole('tab', { name: 'Layers' }).click()
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
