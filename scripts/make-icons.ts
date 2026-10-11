/**
 * Renders the app icons from the bridge mark used in the title card.
 * Run with: npx tsx scripts/make-icons.ts (needs Playwright's Chromium).
 */
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const mark = (size: number, pad: number, rounded: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="#070b10"/>
  <g transform="translate(${pad} ${pad}) scale(${(32 - pad * 2) / 32})" fill="none" stroke-linecap="round">
    <path d="M3 25.5 C10 24 22 24 29 25.5" stroke="#284a63" stroke-width="1.4"/>
    <path d="M7 23 C11 16 12.5 10 16 5 M16 5 C19 10 21 16 25 23" stroke="#ffb547" stroke-width="2.6"/>
    <path d="M10.5 17.5 H21.5" stroke="#ffd58f" stroke-width="1.6" opacity=".7"/>
    <circle cx="16" cy="5" r="1.8" fill="#ffd58f" stroke="none"/>
  </g>
</svg>`

const icons = [
  { file: 'icon-192.png', size: 192, pad: 2, rounded: true },
  { file: 'icon-512.png', size: 512, pad: 2, rounded: true },
  // Maskable icons get cropped to a circle or squircle: keep the mark inside the safe zone.
  { file: 'maskable-512.png', size: 512, pad: 6, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, pad: 4, rounded: false },
]

writeFileSync('public/icons/favicon.svg', mark(32, 1, true).trim())
const browser = await chromium.launch()
const page = await browser.newPage()
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${mark(icon.size, icon.pad, icon.rounded)}`)
  await page.locator('svg').screenshot({ path: `public/icons/${icon.file}`, omitBackground: true })
}
await browser.close()
