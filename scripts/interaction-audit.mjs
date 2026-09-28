import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const account = process.env.TMS_AUDIT_ACCOUNT || process.argv[2]
const password = process.env.TMS_AUDIT_PASSWORD || process.argv[3]
const waybillId = process.env.TMS_AUDIT_WAYBILL_ID || '9ca1a6d0-a3f9-45fb-adea-53ffbddf3715'
const output = resolve(process.env.TMS_AUDIT_OUTPUT || 'artifacts/interaction-audit')
const base = process.env.TMS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const phase = process.env.TMS_AUDIT_PHASE || process.argv[4] || 'all'
const width = Number(process.env.TMS_AUDIT_WIDTH || 393)
const results = []
const dialogs = []
const pageErrors = []

if (!account || !password) throw new Error('Provide the driver account and password for this local audit.')
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width, height: 852 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
})
await context.route('https://apis.map.qq.com/**', route => route.abort())
const page = await context.newPage()
await page.addInitScript(() => {
  window.__auditGlobalEvents = []
  document.addEventListener('click', event => {
    const target = event.target
    window.__auditGlobalEvents.push({ type: 'click', tag: target?.tagName, className: String(target?.className || '').slice(0, 120), text: target?.textContent?.trim().slice(0, 40), hash: location.hash })
  }, true)
  window.addEventListener('hashchange', () => window.__auditGlobalEvents.push({ type: 'hashchange', hash: location.hash }))
  const open = window.open.bind(window)
  window.open = (url, target, features) => {
    if (typeof url === 'string' && url.startsWith('https://apis.map.qq.com/')) {
      window.__auditNavigationCount = (window.__auditNavigationCount || 0) + 1
      return window
    }
    return open(url, target, features)
  }
})
page.on('dialog', async dialog => {
  dialogs.push({ type: dialog.type(), message: dialog.message() })
  await dialog.dismiss()
})
page.on('pageerror', error => pageErrors.push(error.message))

async function visit(path, ready) {
  if (page.url().startsWith(base) && page.url().includes('#/')) {
    await page.evaluate(async () => {
      try { await uni.closePreviewImage() } catch { /* No preview is open. */ }
    })
    await page.evaluate(target => new Promise((resolve, reject) => {
      uni.reLaunch({ url: target, success: resolve, fail: reject })
    }), path)
  } else {
    await page.goto(new URL(`#${path}`, base).href, { waitUntil: 'domcontentloaded' })
  }
  if (ready) await page.waitForSelector(ready, { timeout: 25000 })
  await page.waitForTimeout(180)
  if (path.startsWith('/pages/waybill/detail')) {
    await page.evaluate(() => {
      window.__auditDomEvents = []
      for (const selector of ['.proof-card__image', '.detail-actions__receipt', '.detail-actions__expense', '.route-card__nav-button', '.station-list__call']) {
        const element = document.querySelector(selector)
        for (const type of ['click', 'tap']) {
          element?.addEventListener(type, () => window.__auditDomEvents.push(`${selector}:${type}`))
        }
      }
    })
  }
}

async function step(name, action, options = {}) {
  const before = page.url()
  let error = ''
  try {
    await action()
    await page.waitForTimeout(options.delay ?? 450)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause)
  }
  const screenshot = join(output, `${name}.png`)
  await page.screenshot({ path: screenshot }).catch(() => {})
  const after = page.url()
  const toast = await page.locator('.uni-toast, .wd-toast, uni-modal, .uni-modal').allTextContents().catch(() => [])
  const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth })).catch(() => null)
  const openPages = context.pages().map(tab => tab.url())
  const previewCount = await page.locator('#u-a-p > *, #u-a-p div[style*="position: fixed"]').count().catch(() => 0)
  const apiCalls = await page.evaluate(() => window.__auditApiCalls || null).catch(() => null)
  const domEvents = await page.evaluate(() => window.__auditDomEvents || null).catch(() => null)
  const globalEvents = await page.evaluate(() => window.__auditGlobalEvents || null).catch(() => null)
  const previewDom = await page.evaluate(() => {
    const root = document.getElementById('u-a-p')
    const child = root?.firstElementChild
    const style = child && getComputedStyle(child)
    return child ? { html: child.outerHTML.slice(0, 350), display: style.display, position: style.position, zIndex: style.zIndex, opacity: style.opacity } : null
  }).catch(() => null)
  results.push({ name, before, after, error, toast: toast.map(text => text.trim()).filter(Boolean), layout, screenshot, openPages, previewCount, apiCalls, domEvents, globalEvents, previewDom })
  console.log(`${error ? 'FAIL' : 'PASS'} ${name} ${new URL(after).hash}`)
}

try {
  await visit('/pages/login/index', '.login-form')
  await step('login-forgot-password', () => page.locator('.login-form__link').click())
  await step('login-remember-toggle', () => page.locator('.login-form__remember').click())
  await page.locator('input').nth(0).fill(account)
  await page.locator('input').nth(1).fill(password)
  await step('login-submit', async () => {
    await page.locator('.login-form__button').click()
    await page.waitForURL(/#\/pages\/home\/index/, { timeout: 25000 })
  })

  if (phase === 'all' || phase === 'navigation') {
  await visit('/pages/home/index', '.home-page__content')
  await step('home-current-task', () => page.locator('.route-card--task').click())
  await visit('/pages/home/index', '.home-page__content')
  await step('home-primary-action', () => page.locator('.task-card__button').click())
  await visit('/pages/home/index', '.home-page__content')
  await step('home-pending-task', () => page.locator('.todo-card__stack .route-card').first().click())
  await visit('/pages/home/index', '.home-page__content')
  await step('home-all-tasks', () => page.locator('.todo-card__all').click())
  await visit('/pages/home/index', '.home-page__content')
  await step('home-settings', () => page.locator('.home-page__settings').click())
  await visit('/pages/home/index', '.home-page__content')
  await step('home-navigation', () => page.locator('.route-card__nav-button').first().click())
  for (const [label, destination] of [
    ['车辆', 'vehicle'],
    ['我的', 'mine'],
    ['运单', 'waybill'],
    ['首页', 'home'],
  ]) {
    await step(`bottom-nav-${destination}`, async () => {
      await page.locator(`.bottom-nav__item[aria-label="${label}"]`).click()
      await page.waitForURL(new RegExp(`#\\/pages\\/${destination}\\/index`), { timeout: 10000 })
    })
  }

  await visit('/pages/waybill/index', '.waybill-page__stack, .waybill-page__empty')
  for (const group of ['待处理', '进行中', '已完成', '全部']) {
    await step(`waybill-filter-${group}`, async () => {
      await page.locator('.waybill-page__tab').filter({ hasText: group }).click()
      await page.waitForSelector('.waybill-page__stack, .waybill-page__empty', { timeout: 20000 })
    })
  }
  await step('waybill-refresh', async () => {
    await page.locator('.waybill-page__refresh').click()
    await page.waitForSelector('.waybill-page__stack, .waybill-page__empty', { timeout: 20000 })
  })
  await step('waybill-card-open', () => page.locator('.waybill-page__stack .route-card[role="button"]').first().click())
  await visit('/pages/waybill/index', '.waybill-page__stack')
  await step('waybill-expense-open', () => page.locator('.waybill-expense-action uni-button').first().click())
  }

  if (phase === 'all' || phase === 'detail') {
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.detail-page__content')
  await page.evaluate(() => {
    window.__auditApiCalls = { preview: [], navigate: [] }
    const preview = uni.previewImage.bind(uni)
    const navigate = uni.navigateTo.bind(uni)
    uni.previewImage = options => {
      window.__auditApiCalls.preview.push({ count: options.urls?.length, index: options.urls?.indexOf(options.current) })
      return preview(options)
    }
    uni.navigateTo = options => {
      window.__auditApiCalls.navigate.push(options.url)
      return navigate(options)
    }
  })
  const detailControls = await page.evaluate(() =>
    ['.detail-actions__receipt', '.detail-actions__expense', '.proof-card__image', '.route-card__nav-button']
      .map(selector => {
        const element = document.querySelector(selector)
        if (!element) return { selector, found: false }
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return {
          selector,
          found: true,
          tag: element.tagName,
          html: element.outerHTML.slice(0, 750),
          disabled: element.hasAttribute('disabled'),
          pointerEvents: getComputedStyle(element).pointerEvents,
          hitTag: hit?.tagName,
          hitClass: hit?.className,
        }
      }),
  )
  await writeFile(join(output, 'detail-controls.json'), JSON.stringify(detailControls, null, 2))
  await step('detail-trajectory-tab', () => page.locator('.detail-tabs__item').nth(1).click(), { delay: 900 })
  await step('detail-tracking-tab', () => page.locator('.detail-tabs__item').nth(0).click())
  await step('detail-first-proof', () => page.locator('.proof-card__image').first().click())
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.proof-card__image')
  await step('detail-last-proof', () => page.locator('.proof-card__image').last().click())
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.detail-page__content')
  await step('detail-receipt-action', () => page.locator('.detail-actions__receipt').click())
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.detail-page__content')
  await step('detail-expense-action', async () => {
    await page.locator('.detail-actions__expense').click()
    await page.waitForURL(/#\/pages\/waybill\/expense/, { timeout: 10000 })
  })
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.detail-page__content')
  await step('detail-back', async () => {
    await page.locator('.top-bar__icon[aria-label="返回上一页"]').click()
    await page.waitForURL(/#\/pages\/home\/index/, { timeout: 10000 })
  })
  await visit(`/pages/waybill/detail?id=${encodeURIComponent(waybillId)}`, '.detail-page__content')
  await step('detail-navigation', () => page.locator('.route-card__nav-button').click())
  await step('detail-phone-origin', async () => {
    await page.evaluate(() => {
      window.__auditPhoneCount = 0
      uni.makePhoneCall = () => { window.__auditPhoneCount += 1 }
    })
    await page.locator('[aria-label="拨打发货站电话"]').click()
  })
  await step('detail-phone-destination', () => page.locator('[aria-label="拨打到货站电话"]').click())
  }

  if (phase === 'all' || phase === 'forms') {
  for (const mode of ['loading', 'unloading']) {
    for (const kind of ['照片', '磅单']) {
      await visit(`/pages/waybill/cargo-operation?id=${encodeURIComponent(waybillId)}&type=${mode}`, '.operation-page__content')
      await step(`cargo-${mode}-preview-${kind}`, () => page.locator(`uni-button[aria-label*="${kind}"]`).first().click())
    }
  }

  for (const action of ['departure', 'completion']) {
    await visit(`/pages/waybill/execution-operation?id=${encodeURIComponent(waybillId)}&action=${action}`, '.execution-page__content')
    const dateBefore = await page.locator('.field-block .tms-date-trigger .wd-cell__value').first().innerText()
    await step(`execution-${action}-date-picker`, () => page.locator('.field-block').first().getByText(/\d{4}-\d{2}-\d{2}/).click())
    await step(`execution-${action}-date-confirm`, async () => {
      await page.locator('.datetime-sheet__footer .wd-button').last().click()
      const dateAfter = await page.locator('.field-block .tms-date-trigger .wd-cell__value').first().innerText()
      if (dateBefore !== dateAfter) throw new Error(`Date changed without editing: ${dateBefore} -> ${dateAfter}`)
    })
    await visit(`/pages/waybill/execution-operation?id=${encodeURIComponent(waybillId)}&action=${action}`, '.execution-page__content')
    await step(`execution-${action}-preview`, () => page.locator('.tms-evidence-preview').first().click())
    await visit(`/pages/waybill/execution-operation?id=${encodeURIComponent(waybillId)}&action=${action}`, '.execution-page__content')
    await step(`execution-${action}-remove`, () => page.locator('.tms-evidence-remove').first().click())
    await step(`execution-${action}-required-validation`, () => page.locator('.execution-footer uni-button').click())
  }

  await visit(`/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`, '.expense-page__content')
  await step('expense-history-proof', () => page.locator('.expense-record__proofs uni-button').first().click())
  await visit(`/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`, '.expense-page__content')
  await step('expense-open-sheet', async () => {
    await page.locator('.expense-footer uni-button').click()
    await page.waitForSelector('.expense-sheet', { state: 'visible', timeout: 10000 })
  })
  await step('expense-category-picker', () => page.locator('.expense-field__picker').click())
  await step('expense-category-confirm', async () => {
    await page.locator('.wd-picker__action--confirm:visible').click()
    const value = await page.locator('.expense-field__picker .wd-cell__value').innerText()
    if (!value || value.includes('请选择')) throw new Error(`Expense category was not selected: ${value}`)
  })
  await visit(`/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`, '.expense-page__content')
  await page.locator('.expense-footer uni-button').click()
  await step('expense-date-picker', () => page.locator('.expense-field--split .tms-date-trigger').click())
  await step('expense-date-confirm', async () => {
    const before = await page.locator('.expense-field--split .tms-date-trigger .wd-cell__value').innerText()
    await page.locator('.wd-calendar__confirm .wd-button:visible').click()
    const after = await page.locator('.expense-field--split .tms-date-trigger .wd-cell__value').innerText()
    if (before !== after) throw new Error(`Unchanged calendar selection modified the date: ${before} -> ${after}`)
  })
  await visit(`/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`, '.expense-page__content')
  await page.locator('.expense-footer uni-button').click()
  await step('expense-payment-picker', async () => {
    await page.locator('.expense-field__compact-picker').scrollIntoViewIfNeeded()
    await page.locator('.expense-field__compact-picker').click()
  }, { delay: 1200 })
  await step('expense-payment-confirm', async () => {
    await page.locator('.wd-picker__action--confirm:visible').click()
    const value = await page.locator('.expense-field__compact-picker .wd-cell__value').innerText()
    if (!value || value.includes('请选择')) throw new Error(`Payment method was not selected: ${value}`)
  })
  await visit(`/pages/waybill/expense?id=${encodeURIComponent(waybillId)}`, '.expense-page__content')
  await page.locator('.expense-footer uni-button').click()
  await step('expense-sheet-close', () => page.locator('.expense-sheet__close').click())

  for (const document of ['行驶证', '运输证']) {
    await visit('/pages/vehicle/index', '.vehicle-card')
    await step(`vehicle-preview-${document}`, () => page.locator(`uni-button[aria-label="预览${document}"]`).click(), { delay: 1800 })
  }
  }

  if (phase === 'all' || phase === 'forms' || phase === 'mine') {
  await visit('/pages/mine/index', '.mine-page__content')
  await step('mine-refresh', () => page.locator('.mine-page__setting').click(), { delay: 1200 })
  await step('mine-help-open', async () => {
    await page.locator('.feature-grid__item').filter({ hasText: '使用说明' }).click()
    await page.locator('.mine-help__panel').waitFor({ state: 'visible' })
  })
  await step('mine-help-close', () => page.locator('.mine-help__done').click())
  await step('mine-expenses', async () => {
    await page.locator('.feature-grid__item').filter({ hasText: '费用记录' }).click()
    await page.waitForURL(/#\/pages\/waybill\/expense/, { timeout: 15000 })
  })
  await visit('/pages/mine/index', '.mine-page__content')
  await step('mine-receipts', async () => {
    await page.locator('.feature-grid__item').filter({ hasText: '电子回单' }).click()
    await page.waitForURL(/#\/pages\/waybill\/index\?group=completed/, { timeout: 10000 })
    await page.locator('.waybill-page__stack, .waybill-page__empty').first().waitFor({ state: 'visible', timeout: 15000 })
  })
  await visit('/pages/mine/index', '.mine-page__content')
  await step('mine-logout-dialog', async () => {
    await page.locator('.mine-page__logout').click()
    await page.locator('.mine-dialog__body[aria-label="退出登录"]').waitFor({ state: 'visible' })
  })
  await step('mine-logout-cancel', () => page.locator('.mine-dialog__body[aria-label="退出登录"]').getByText('取消', { exact: true }).click())
  await step('mine-logout-confirm', async () => {
    await page.locator('.mine-page__logout').click()
    await page.locator('.mine-dialog__body[aria-label="退出登录"]').getByText('退出登录', { exact: true }).last().click()
    await page.locator('.login-form').waitFor({ state: 'visible', timeout: 10000 })
  })
  await page.locator('input').nth(0).fill(account)
  await page.locator('input').nth(1).fill(password)
  await page.locator('.login-form__button').click()
  await page.waitForURL(/#\/pages\/home\/index/, { timeout: 15000 })
  await visit('/pages/mine/index', '.mine-page__content')
  await step('mine-contact-carrier', () => page.locator('.feature-grid__item').filter({ hasText: '联系车队' }).click())
  }
} finally {
  await writeFile(join(output, `${phase}-audit.json`), JSON.stringify({ results, dialogs, pageErrors }, null, 2))
  await browser.close()
  if (pageErrors.length || results.some(result => result.error || (result.layout && result.layout.documentWidth > result.layout.width))) process.exitCode = 1
}
