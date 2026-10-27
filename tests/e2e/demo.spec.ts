import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS_DIR

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function next(page: Page) {
  const label = await page.locator('main p.font-mono').first().innerText()
  await page.getByRole('button', { name: /Next step|Skip to next/ }).click()
  // wait for the step transition to finish so only the new step is on screen
  await expect(page.locator('main p.font-mono').first()).not.toHaveText(label)
  await expect(page.locator('main section')).toHaveCount(1)
}

test('public site renders key pages', async ({ page }) => {
  for (const [path, heading] of [
    ['/', 'Connect healthcare systems.'],
    ['/solutions/providers', 'Your healthcare systems stay yours.'],
    ['/solutions/vendors', 'Build healthcare applications.'],
    ['/products/privexa-trust', 'Every request checked.'],
    ['/integrations', 'A curated directory'],
    ['/security', 'Designed for controlled access'],
    ['/about', 'Building the connective layer'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
  }
  await page.goto('/integrations')
  await expect(page.getByText('MetroCare Medical Center')).toBeVisible()
})

test('contact form reports the real delivery state', async ({ page }) => {
  await page.goto('/contact')
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Work email').fill('e2e@example.org')
  await page.getByLabel('Organization').fill('Test Org')
  await page.getByLabel('Message').fill('Testing the contact form end to end.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('heading', { name: /Message received|Message sent/ })).toBeVisible()
})

test('guided demo runs end to end on real services', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Launch Interactive Demo' }).first().click()
  await expect(page).toHaveURL(/\/demo\/workspace/)
  const main = page.locator('main')
  await page.request.post('/api/v1/demo/reset', { headers: { 'X-CSRF-Token': (await page.context().cookies()).find((c) => c.name === 'privexa_csrf')!.value } })

  // 1. hospitals
  await expect(main.getByText('MetroCare Medical Center').first()).toBeVisible()
  await shot(page, 'demo-01')
  await next(page)
  // 2. test connections
  await main.getByRole('button', { name: 'Test both connections' }).click()
  await expect(main.getByText('Response time')).toHaveCount(2)
  await shot(page, 'demo-02')
  await next(page)
  // 3. search
  await main.getByRole('button', { name: 'Search both hospitals' }).click()
  await expect(main.getByText(/synthetic records found/)).toBeVisible()
  await next(page)
  // 4. MRNs differ
  await expect(main.getByText('MC-100200')).toBeVisible()
  await expect(main.getByText('SG-100200')).toBeVisible()
  await next(page)
  // 5. match explanation
  await expect(main.getByText('Why Privexa suggests this').first()).toBeVisible()
  await shot(page, 'demo-05')
  await next(page)
  // 6. confirm
  const confirm = main.getByRole('button', { name: 'Confirm match' })
  if (await confirm.isVisible()) await confirm.click() // already confirmed in an earlier run otherwise
  await expect(main.getByText(/Confirmed by the demo reviewer/)).toBeVisible()
  await next(page)
  // 7-8. request + decisions
  await next(page)
  await main.getByRole('button', { name: 'Send the request through Privexa' }).click()
  await expect(main.getByText('MedicationRequest is outside the application\'s approved scope')).toBeVisible()
  await shot(page, 'demo-08')
  await next(page)
  // 9-10. permitted data + timeline
  await expect(main.getByText('FHIR validation')).toBeVisible()
  await next(page)
  await expect(main.getByText('Source: Sunrise General Hospital').first()).toBeVisible()
  await expect(main.getByText('Source: MetroCare Medical Center').first()).toBeVisible()
  await shot(page, 'demo-10')
  await next(page)
  // 11. audit
  await expect(main.getByText(/ties the audit events/)).toBeVisible()
  await next(page)
  // 12. anchored for real
  await expect(main.getByText(/^Block #\d+/).first()).toBeVisible({ timeout: 40_000 })
  await shot(page, 'demo-12')
  await next(page)
  // 13. verify, tamper, verify, restore
  await main.getByRole('button', { name: 'Verify integrity' }).click()
  await expect(main.getByText('Verified', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Simulate tampering' }).click()
  await main.getByRole('button', { name: 'Restore record' }).waitFor()
  await main.getByRole('button', { name: 'Verify integrity' }).click()
  await expect(main.getByText('Mismatch detected')).toBeVisible()
  await shot(page, 'demo-13')
  await main.getByRole('button', { name: 'Restore record' }).click()
  await main.getByRole('button', { name: 'Simulate tampering' }).waitFor()
  await main.getByRole('button', { name: 'Verify integrity' }).click()
  await expect(main.getByText('Verified', { exact: true })).toBeVisible()
  await next(page)
  // 14. denied
  await main.getByRole('button', { name: 'Send the request' }).click()
  await expect(main.getByText(/has no approved access/).first()).toBeVisible()
  await next(page)
  // 15. outage and recovery
  await main.getByRole('button', { name: 'Make Sunrise time out' }).click()
  await expect(main.getByText('Hospital system did not respond in time')).toBeVisible({ timeout: 30_000 })
  await main.getByRole('button', { name: 'Restore and retest' }).click()
  await expect(main.getByText('Connection restored')).toBeVisible()
  await shot(page, 'demo-15')
})

test('vendor cannot open the provider workspace', async ({ page }) => {
  await page.goto('/signin')
  await page.getByRole('button', { name: 'Vendor' }).click()
  await expect(page).toHaveURL(/\/app\/vendor/)
  await page.goto('/app/provider')
  await expect(page.getByText("This workspace isn't available to your role")).toBeVisible()
  const res = await page.request.get('/api/v1/stats/provider')
  expect(res.status()).toBe(403)
})
