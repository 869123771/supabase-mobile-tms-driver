import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const account = process.env.TMS_AUDIT_ACCOUNT || process.argv[2]
const password = process.env.TMS_AUDIT_PASSWORD || process.argv[3]
const width = Number(process.env.TMS_AUDIT_WIDTH || process.argv[5] || 393)
const height = Number(process.env.TMS_AUDIT_HEIGHT || 852)
const waybillId = process.env.TMS_AUDIT_WAYBILL_ID || '9ca1a6d0-a3f9-45fb-adea-53ffbddf3715'
const output = resolve(process.env.TMS_AUDIT_OUTPUT || 'artifacts/visual-audit')
const base = process.env.TMS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const only = process.env.TMS_AUDIT_ONLY || process.argv[4]

if (!account || !password) {
  throw new Error('Set TMS_AUDIT_ACCOUNT and TMS_AUDIT_PASSWORD before running the visual audit.')
}

await mkdir(output, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = []
const results = []
const dictionaryResponses = []
const readySelectors = {
  home: '.home-page__content',
  waybill: '.waybill-page__stack, .waybill-page__empty',
  detail: '.detail-page__content',
  'cargo-loading': '.operation-page__content',
  'cargo-unloading': '.operation-page__content',
  'execution-departure': '.execution-page__content',
  'execution-completion': '.execution-page__content',
  expense: '.expense-page__content',
  vehicle: '.vehicle-card',
  mine: '.mine-page__content',
}

page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }))
page.on('console', message => {
  if (message.type() === 'error') errors.push({ type: 'console', message: message.text(), location: message.location() })
})
page.on('response', async response => {
  if (response.status() >= 400) {
    errors.push({ type: 'http', status: response.status(), url: response.url() })
  }
  const pathname = new URL(response.url()).pathname
  if (!/\/(sys_dict_type|sys_dictionary)$/.test(pathname)) return
  const data = await response.json().catch(() => null)
  dictionaryResponses.push({
    table: pathname.split('/').pop(),
    status: response.status(),
    count: Array.isArray(data) ? data.length : null,
  })
})

async function capture(name, path) {
  if (path) {
    await page.goto(new URL(`#${path}`, base).href, { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
  if (readySelectors[name]) {
    await page.waitForSelector(readySelectors[name], { timeout: 20000 }).catch(() => {
      errors.push({ type: 'readiness', page: name, message: 'Page content did not become ready within 20 seconds' })
    })
  }
  await page.waitForTimeout(350)
  await page.evaluate(() => document.fonts?.ready)

  const topImage = join(output, `${width}-${name}-top.png`)
  await page.screenshot({ path: topImage })

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    scrollAreas: Array.from(document.querySelectorAll('*'))
      .filter(element => element.scrollHeight > element.clientHeight + 40 && element.clientHeight > 120)
      .slice(0, 8)
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      })),
  }))
  const buttons = await page.locator('uni-button, button, [role="button"]').evaluateAll(elements =>
    elements.map(element => ({
      text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
      label: element.getAttribute('aria-label') || '',
      disabled: element.hasAttribute('disabled'),
    })),
  )
  const evidence = await page.locator('.tms-evidence-preview, .tms-evidence-remove').evaluateAll(elements =>
    elements.map(element => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const parent = element.parentElement?.getBoundingClientRect()
      return {
        tag: element.tagName.toLowerCase(),
        className: element.className,
        position: style.position,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        parentTop: parent?.top,
        parentRight: parent?.right,
        background: style.backgroundImage,
      }
    }),
  )

  await page.mouse.move(Math.round(width / 2), Math.round(height * 0.65))
  await page.mouse.wheel(0, 1800)
  await page.waitForTimeout(300)
  const bottomImage = join(output, `${width}-${name}-bottom.png`)
  await page.screenshot({ path: bottomImage })

  let settledImage
  let settledVehicleLabels
  if (name === 'vehicle') {
    await page.waitForTimeout(5000)
    settledImage = join(output, `${width}-${name}-settled.png`)
    await page.screenshot({ path: settledImage })
    settledVehicleLabels = await page.locator('.status-card__row').allTextContents()
  }

  results.push({ name, url: page.url(), layout, buttons, evidence, topImage, bottomImage, settledImage, settledVehicleLabels })
  console.log(`${name}: ${layout.documentWidth}/${layout.viewportWidth}px, ${buttons.length} buttons`)
}

try {
  await page.goto(new URL('#/pages/login/index', base).href, { waitUntil: 'domcontentloaded' })
  await capture('login')
  await page.locator('input').nth(0).fill(account)
  await page.locator('input').nth(1).fill(password)
  await page.locator('.login-form__button').click()
  await page.waitForURL(/#\/pages\/home\/index/, { timeout: 20000 })

  const routes = [
    ['home', '/pages/home/index'],
    ['waybill', '/pages/waybill/index'],
    ['detail', `/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`],
    ['cargo-loading', `/pages/waybill/cargo-operation?id=${encodeURIComponent(waybillId)}&type=loading`],
    ['cargo-unloading', `/pages/waybill/cargo-operation?id=${encodeURIComponent(waybillId)}&type=unloading`],
    ['execution-departure', `/pages/waybill/execution-operation?id=${encodeURIComponent(waybillId)}&action=departure`],
    ['execution-completion', `/pages/waybill/execution-operation?id=${encodeURIComponent(waybillId)}&action=completion`],
    ['expense', `/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`],
    ['vehicle', '/pages/vehicle/index'],
    ['mine', '/pages/mine/index'],
  ]

  for (const [name, path] of routes) {
    if (!only || only === 'all' || only.split(',').includes(name)) await capture(name, path)
  }
} finally {
  await writeFile(join(output, `${width}-audit.json`), JSON.stringify({ results, errors, dictionaryResponses }, null, 2))
  await browser.close()
  if (errors.length || results.some(result => result.layout.documentWidth > result.layout.viewportWidth)) process.exitCode = 1
}
