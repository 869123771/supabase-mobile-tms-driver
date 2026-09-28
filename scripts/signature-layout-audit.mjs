import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const account = process.env.TMS_AUDIT_ACCOUNT || process.argv[2]
const password = process.env.TMS_AUDIT_PASSWORD || process.argv[3]
const width = Number(process.env.TMS_AUDIT_WIDTH || process.argv[4] || 393)
if (!account || !password) throw new Error('Provide account and password as arguments or environment variables.')

const output = resolve('artifacts/visual-audit')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
const page = await context.newPage()
try {
  await page.goto('http://127.0.0.1:5173/#/pages/login/index')
  await page.locator('input').nth(0).fill(account)
  await page.locator('input').nth(1).fill(password)
  await page.locator('.login-form__button').click()
  await page.waitForURL(/#\/pages\/home\/index/, { timeout: 20000, waitUntil: 'domcontentloaded' })
  console.log('signed in')
  await page.goto('http://127.0.0.1:5173/#/pages/waybill/detail?id=9ca1a6d0-a3f9-45fb-adea-53ffbddf3715', { waitUntil: 'domcontentloaded' })
  await page.locator('.detail-page__content').waitFor({ timeout: 20000 })
  console.log('detail ready')
  const exposure = await page.evaluate(() => {
    const current = getCurrentPages().at(-1)
    const vm = current?.$vm
    const instance = vm?.$
    if (vm && 'signatureVisible' in vm) {
      vm.signatureVisible = true
      return { opened: true, keys: Object.keys(vm).slice(0, 20) }
    }
    if (instance?.setupState && 'signatureVisible' in instance.setupState) {
      instance.setupState.signatureVisible = true
      return { opened: true, keys: Object.keys(instance.setupState).slice(0, 20) }
    }
    return { opened: false, pageKeys: Object.keys(current || {}).slice(0, 20), vmKeys: Object.keys(vm || {}).slice(0, 30), setupKeys: Object.keys(instance?.setupState || {}).slice(0, 30) }
  })
  if (!exposure.opened) throw new Error(`Could not open the signature sheet in a read-only browser fixture: ${JSON.stringify(exposure)}`)
  console.log('sheet opened')
  await page.locator('.signature-sheet__body .sheet-field').first().waitFor({ timeout: 20000 })
  await page.locator('.signature-sheet__body .sheet-field').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(350)
  const screenshot = resolve(output, `${width}-signature-fields.png`)
  await page.screenshot({ path: screenshot })
  const measurements = await page.locator('.signature-sheet__body .sheet-field').first().evaluate(element => {
    const label = element.querySelector('.sheet-field__label')?.getBoundingClientRect()
    const control = element.querySelector('.tms-date-trigger')?.getBoundingClientRect()
    const next = element.nextElementSibling
    const nextLabel = next?.querySelector('.sheet-field__label')?.getBoundingClientRect()
    const nextControl = next?.querySelector('.tms-form-input')?.getBoundingClientRect()
    return {
      dateGap: label && control ? control.top - label.bottom : null,
      signerGap: nextLabel && nextControl ? nextControl.top - nextLabel.bottom : null,
      dateHeight: control?.height,
      signerHeight: nextControl?.height,
      dateArrowRightInset: control && element.querySelector('.wd-cell__arrow-right') ? control.right - element.querySelector('.wd-cell__arrow-right').getBoundingClientRect().right : null,
    }
  })
  const dateBefore = await page.locator('.signature-sheet__body .tms-date-trigger .wd-cell__value').first().innerText()
  await page.locator('.signature-sheet__body .tms-date-trigger').first().click()
  console.log('date picker opened')
  await page.locator('.datetime-sheet__time-field .wd-input').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(200)
  const pickerScreenshot = resolve(output, `${width}-signature-date-picker.png`)
  await page.screenshot({ path: pickerScreenshot })
  await page.locator('.datetime-sheet__footer .wd-button').last().click()
  await page.waitForTimeout(350)
  const dateAfter = await page.locator('.signature-sheet__body .tms-date-trigger .wd-cell__value').first().innerText()
  await page.locator('.signature-sheet__body .tms-date-trigger').first().click()
  await page.locator('.datetime-sheet__date').click()
  await page.locator('.wd-calendar__confirm .wd-button:visible').click()
  await page.locator('.datetime-sheet__time-field input').first().fill('19')
  await page.locator('.datetime-sheet__time-field input').last().fill('35')
  await page.locator('.datetime-sheet__footer .wd-button').last().click()
  const editedDate = await page.locator('.signature-sheet__body .tms-date-trigger .wd-cell__value').first().innerText()
  await page.locator('.signature-sheet__body .tms-date-trigger').first().click()
  await page.locator('.datetime-sheet__footer .wd-button').first().click()
  const afterCancel = await page.locator('.signature-sheet__body .tms-date-trigger .wd-cell__value').first().innerText()
  const report = { screenshot, pickerScreenshot, dateBefore, dateAfter, editedDate, afterCancel, measurements, url: page.url() }
  await writeFile(resolve(output, `${width}-signature-fields.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (measurements.dateGap === null || measurements.signerGap === null || Math.abs(measurements.dateGap - measurements.signerGap) > 1 || Math.abs(measurements.dateHeight - measurements.signerHeight) > 1 || dateBefore !== dateAfter || !editedDate.endsWith('19:35') || editedDate !== afterCancel) process.exitCode = 1
} finally {
  await browser.close()
}
