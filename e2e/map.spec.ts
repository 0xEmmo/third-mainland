import { expect, test } from '@playwright/test'
import { APP, expectNoAxeViolations, isPhone, open, showLayers, showList } from './helpers'

test.describe('the map', () => {
  test('opens on the morning peak with the bridge selected and no accessibility violations', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('slider', { name: 'Time of day' })).toHaveAttribute('aria-valuetext', /07:4\d, morning peak/)
    await showList(page)
    await expect(page.getByRole('button', { name: /^Third Mainland Bridge, south/ })).toHaveAttribute('aria-pressed', 'true')
    await expectNoAxeViolations(page)
  })

  test('picking a corridor shows its details', async ({ page }) => {
    await open(page)
    await showList(page)
    await page.getByRole('button', { name: /^BRT Ikorodu to TBS/ }).click()
    const details = page.getByRole('region', { name: 'BRT Ikorodu to TBS' })
    await expect(details).toBeVisible()
    await expect(details.getByText(/Every/)).toBeVisible()
    await expect(details.getByRole('img', { name: 'Outline of the route' })).toBeVisible()
    await details.getByRole('button', { name: 'Close details' }).click()
    await expect(details).toBeHidden()
  })

  test('the time slider moves by keyboard and the presets jump', async ({ page }) => {
    await open(page)
    const slider = page.getByRole('slider', { name: 'Time of day' })
    await page.getByRole('button', { name: /Jump to evening peak/ }).click()
    await expect(slider).toHaveAttribute('aria-valuetext', '18:30, evening peak')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAttribute('aria-valuetext', '18:35, evening peak')
    await page.keyboard.press('PageDown')
    await expect(slider).toHaveAttribute('aria-valuetext', '17:35, evening peak')
    await page.keyboard.press('Home')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  test('dragging the histogram sets the time', async ({ page }) => {
    await open(page)
    const slider = page.getByRole('slider', { name: 'Time of day' })
    const box = (await slider.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(slider).toHaveAttribute('aria-valuetext', /^12:00/)
  })

  test('at night the BRT stops and the list says so', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: /Jump to night/ }).click()
    await showList(page)
    const brt = page.getByRole('button', { name: /^BRT Ikorodu to TBS/ })
    await expect(brt).toContainText('Not running · resumes 05:30')
    await expect(brt).toContainText('Off')
  })

  test('scenarios change the day', async ({ page }) => {
    await open(page)
    await page.getByRole('radio', { name: 'Saturday' }).check({ force: true })
    await expect(page.getByText(/Saturday · /)).toBeVisible()
    await page.getByRole('radio', { name: 'Rain day' }).check({ force: true })
    await expect(page.getByText(/heavy rain · /)).toBeVisible()
  })

  test('playing runs the clock forward', async ({ page }) => {
    await open(page)
    const slider = page.getByRole('slider', { name: 'Time of day' })
    const before = Number(await slider.getAttribute('aria-valuenow'))
    await page.getByRole('button', { name: /Change speed/ }).click()
    await page.getByRole('button', { name: 'Play the day forward' }).click()
    await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 8000 }).toBeGreaterThan(before + 5)
  })

  test('layers hide corridors, down to an empty list', async ({ page }) => {
    await open(page)
    for (const name of ['Road traffic', 'BRT', 'Ferry', 'Rail']) {
      await showLayers(page)
      await page.getByRole('button', { name, exact: true }).click()
    }
    await showList(page)
    await expect(page.getByText('Every layer is switched off')).toBeVisible()
    await page.getByRole('button', { name: 'Show all layers' }).click()
    await expect(page.getByRole('button', { name: /^Third Mainland Bridge/ })).toBeVisible()
  })

  test('sorting the list', async ({ page }) => {
    await open(page)
    await showList(page)
    await page.getByRole('radio', { name: 'A–Z' }).check({ force: true })
    const first = page.locator('.routes-list .route').first()
    await expect(first).toContainText('Agege Motor Road')
  })

  test('the map zooms with buttons and keys', async ({ page }) => {
    await open(page)
    const scale = page.locator('.scale')
    const before = await scale.textContent()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(scale).not.toHaveText(before!)
    await page.getByRole('application', { name: 'Map of Lagos movement' }).focus()
    await page.keyboard.press('0')
    await expect(scale).toHaveText(before!)
  })

  test('tapping a line on the map selects it', async ({ page }) => {
    await open(page)
    // Find the Eko Bridge on screen via the same projection the map uses.
    await showList(page)
    await page.getByRole('button', { name: /^Eko Bridge/ }).click()
    const dot = page.locator('.callout-dot')
    await expect(dot).toBeVisible()
    const box = (await dot.boundingBox())!
    if (isPhone(page)) await page.getByRole('button', { name: 'Collapse panel' }).click()
    // Clear, then tap the line where the callout was pinned.
    await page.getByRole('application', { name: 'Map of Lagos movement' }).focus()
    await page.keyboard.press('Escape')
    await expect(dot).toBeHidden()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.callout-text b')).toContainText('Eko Bridge')
  })

  test('remembers settings across a reload', async ({ page }) => {
    await open(page)
    await page.getByRole('radio', { name: 'Rain day' }).check({ force: true })
    await page.getByRole('button', { name: /Jump to midday/ }).click()
    await page.waitForTimeout(600)
    await open(page)
    await expect(page.getByRole('radio', { name: 'Rain day' })).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Time of day' })).toHaveAttribute('aria-valuetext', /^13:0/)
  })

  test('respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(APP)
    await showLayers(page)
    await expect(page.getByRole('switch', { name: 'Animate flows' })).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Play the day forward' })).toBeVisible()
  })
})
