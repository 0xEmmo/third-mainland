import { expect, test } from '@playwright/test'
import { APP, expectNoAxeViolations, open } from './helpers'

test('the table view lists every corridor and passes axe', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Show as a table' }).click()
  const table = page.getByRole('region', { name: /Every corridor at/ })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(18)
  await table.getByRole('button', { name: 'Eko Bridge' }).click()
  await expect(table.getByRole('button', { name: 'Eko Bridge' })).toHaveAttribute('aria-pressed', 'true')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Show the map' }).click()
  await expect(table).toBeHidden()
})

test('the about dialog explains the model and closes with Escape', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /Illustrative, not live traffic/ }).click()
  const dialog = page.getByRole('dialog', { name: 'About this map' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('BPR curve')
  await expectNoAxeViolations(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('a failed data download can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/data/lagos.json', (route) => (fail ? route.fulfill({ status: 503, body: '' }) : route.fallback()))
  await page.goto(APP)
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('HTTP 503')
  fail = false
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('WebGL 2', { exact: true })).toBeVisible({ timeout: 20_000 })
})

test('without a GPU the table takes over', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined })
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null
      return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('can’t be drawn here')
  await expect(page.getByRole('region', { name: /Every corridor at/ })).toBeVisible()
})

test('works offline once loaded', async ({ page, context }) => {
  await open(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The first load is not controlled by the worker yet; the second one is.
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Third Mainland', level: 1 })).toBeVisible()
  await expect(page.getByText(/Offline · saved copy/)).toBeVisible()
  await expect(page.getByText('WebGL 2', { exact: true })).toBeVisible({ timeout: 20_000 })
})

test('picks a renderer by itself, falling back to WebGL 2 when WebGPU fails', async ({ page }) => {
  await page.goto('/?particles=2000')
  await expect(page.getByText(/^(WebGPU|WebGL 2)$/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
