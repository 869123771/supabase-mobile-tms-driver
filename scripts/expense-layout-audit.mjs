import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const account = process.env.TMS_AUDIT_ACCOUNT || process.argv[2]
const password = process.env.TMS_AUDIT_PASSWORD || process.argv[3]
const width = Number(process.env.TMS_AUDIT_WIDTH || process.argv[4] || 393)
const waybillId = process.env.TMS_AUDIT_WAYBILL_ID || '9ca1a6d0-a3f9-45fb-adea-53ffbddf3715'
const output = resolve('artifacts/visual-audit')

if (!account || !password) throw new Error('Provide account and password as arguments or environment variables.')
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width, height: 852 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
})
const page = await context.newPage()
try {
  await page.goto('http://127.0.0.1:5173/#/pages/login/index')
  await page.locator('input').nth(0).fill(account)
  await page.locator('input').nth(1).fill(password)
  await page.locator('.login-form__button').click()
  await page.waitForURL(/#\/pages\/home\/index/, { timeout: 20000 })
  await page.goto(`http://127.0.0.1:5173/#/pages/waybill/expense?id=${encodeURIComponent(waybillId)}&create=1`)
  await page.locator('.expense-sheet__body .expense-field__input-grid').waitFor({ timeout: 20000 })
  await page.locator('.expense-field__picker').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const topScreenshot = resolve(output, `${width}-expense-controls.png`)
  await page.screenshot({ path: topScreenshot })
  const selectorMeasurements = await page.locator('.expense-field__picker, .expense-field--split .tms-date-trigger').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect()
    const arrow = element.querySelector('.wd-cell__arrow-right')?.getBoundingClientRect()
    return {
      className: element.className,
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      arrowRightInset: arrow ? rect.right - arrow.right : null,
      arrowCenterOffset: arrow ? Math.abs(rect.y + rect.height / 2 - (arrow.y + arrow.height / 2)) : null,
    }
  }))
  const dateBefore = await page.locator('.expense-field--split .tms-date-trigger .wd-cell__value').innerText()
  await page.locator('.expense-field--split .tms-date-trigger').click()
  await page.waitForTimeout(1600)
  const datePickerScreenshot = resolve(output, `${width}-expense-date-picker-settled.png`)
  await page.screenshot({ path: datePickerScreenshot })
  await page.locator('.wd-calendar__confirm .wd-button:visible').click()
  await page.waitForTimeout(350)
  const dateAfter = await page.locator('.expense-field--split .tms-date-trigger .wd-cell__value').innerText()
  await page.locator('.expense-field__input-grid').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const screenshot = resolve(output, `${width}-expense-supplemental.png`)
  await page.screenshot({ path: screenshot })
  const measurements = await page.locator('.expense-field__input-grid uni-label, .expense-field__input-grid .wd-input, .expense-field__input-grid .wd-cell, .expense-field__input-grid .wd-cell__arrow-right, .expense-field__input-grid .wd-cell__value, .expense-field__location-row').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      tag: element.tagName,
      className: typeof element.className === 'string' ? element.className : '',
      text: (element.textContent || '').trim().slice(0, 45),
      x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right,
      padding: style.padding,
      background: style.backgroundColor,
      boxSizing: style.boxSizing,
      display: style.display,
    }
  }))
  const formControlHeights = measurements.filter(item => item.className.includes('tms-form-input--small') || item.className.includes('tms-select-trigger--small') || item.className === 'expense-field__location-row').map(item => item.height)
  const heightDelta = Math.max(...formControlHeights) - Math.min(...formControlHeights)
  const arrowsRightAligned = selectorMeasurements.every(item => item.arrowRightInset !== null && item.arrowRightInset <= 18 && item.arrowCenterOffset !== null && item.arrowCenterOffset <= 2)
  const report = { screenshot, topScreenshot, datePickerScreenshot, dateBefore, dateAfter, heightDelta, arrowsRightAligned, selectorMeasurements, measurements }
  await writeFile(resolve(output, `${width}-expense-supplemental.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ screenshot, topScreenshot, datePickerScreenshot, dateBefore, dateAfter, heightDelta, arrowsRightAligned, selectorMeasurements }, null, 2))
  if (heightDelta > 1 || !arrowsRightAligned || dateBefore !== dateAfter) process.exitCode = 1
} finally {
  await browser.close()
}
