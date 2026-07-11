import {
  expect,
  test,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'

type StorageState = Exclude<
  BrowserContextOptions['storageState'],
  string | undefined
>

const EMPTY_STORAGE_STATE: StorageState = { cookies: [], origins: [] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStorageState(value: unknown): value is StorageState {
  if (!isRecord(value) || !Array.isArray(value.cookies) || !Array.isArray(value.origins)) {
    return false
  }

  const cookiesAreValid = value.cookies.every(
    (cookie) =>
      isRecord(cookie) &&
      typeof cookie.name === 'string' &&
      typeof cookie.value === 'string' &&
      typeof cookie.domain === 'string' &&
      typeof cookie.path === 'string' &&
      typeof cookie.expires === 'number' &&
      typeof cookie.httpOnly === 'boolean' &&
      typeof cookie.secure === 'boolean' &&
      ['Strict', 'Lax', 'None'].includes(String(cookie.sameSite)),
  )
  const originsAreValid = value.origins.every(
    (origin) =>
      isRecord(origin) &&
      typeof origin.origin === 'string' &&
      Array.isArray(origin.localStorage) &&
      origin.localStorage.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === 'string' &&
          typeof entry.value === 'string',
      ),
  )
  return cookiesAreValid && originsAreValid
}

function readAuthStorageState(): StorageState | undefined {
  const value = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE_JSON
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)
    return isStorageState(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const authStorageState = readAuthStorageState()

async function showPreviewOnMobile(page: Page, isMobile: boolean) {
  if (!isMobile) return
  await page.getByRole('tab', { name: /预览|Preview/i }).click()
}

async function showChatOnMobile(page: Page, isMobile: boolean) {
  if (!isMobile) return
  await page.getByRole('tab', { name: /对话|Chat/i }).click()
}

async function expectRunnablePreview(page: Page) {
  const preview = page.getByLabel('Video preview', { exact: true })
  await expect(preview.locator('.__remotion-player')).toBeVisible({
    timeout: 45_000,
  })
}

test.describe('signed-out Studio', () => {
  test.use({ storageState: EMPTY_STORAGE_STATE })

  test('shows the focused composer without project data', async ({ page }) => {
    await page.goto('/studio')

    await expect(
      page.getByRole('heading', { name: /描述画面|Describe the scene/i }),
    ).toBeVisible()
    await expect(page.getByRole('textbox')).toBeVisible()
    await expect(page.getByRole('contentinfo')).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Studio' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /最近项目|Recent projects/i }),
    ).not.toBeVisible()
  })

  test('landing has no horizontal overflow on mobile', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile-only smoke')
    await page.goto('/studio')

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(hasOverflow).toBe(false)
  })
})

test.describe('authenticated Studio', () => {
  test.skip(
    !authStorageState,
    'valid PLAYWRIGHT_AUTH_STORAGE_STATE_JSON is required',
  )
  test.use({ storageState: authStorageState ?? EMPTY_STORAGE_STATE })

  test('generates, previews, follows up, refreshes, and rolls back', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/studio')
    await page.getByRole('textbox').fill('Animate a cyan product title')
    await page.getByRole('button', { name: /生成|Generate/i }).click()

    await expect(page).toHaveURL(/\/studio\/[^/]+$/)
    await showPreviewOnMobile(page, isMobile)
    await expect(page.getByText(/已就绪|Ready/i)).toBeVisible({
      timeout: 45_000,
    })
    await expectRunnablePreview(page)

    await showChatOnMobile(page, isMobile)
    await page.getByRole('textbox').fill('Make the title feel softer')
    await page.getByRole('button', { name: /发送|Send/i }).click()
    await expect(page.getByText('Make the title feel softer')).toBeVisible()
    await expect(page.getByText(/已就绪|Ready/i)).toBeVisible({
      timeout: 45_000,
    })

    await page.reload()
    await showPreviewOnMobile(page, isMobile)
    await expectRunnablePreview(page)
    await page.getByRole('button', { name: /版本历史|Version history/i }).click()

    const history = page.getByRole('dialog', {
      name: /版本历史|Version history/i,
    })
    await expect(history).toBeVisible()
    await history
      .getByRole('button', { name: /恢复此版本|Restore this version/i })
      .first()
      .click()
    await history
      .getByRole('button', { name: /确认恢复|Confirm restore/i })
      .click()
    await expect(history).not.toBeVisible()

    await page.getByRole('button', { name: /版本历史|Version history/i }).click()
    await expect(
      page.getByText(/恢复版本|Restored version/i).last(),
    ).toBeVisible()
  })

  test('remixes the compatible Card Avatar into an initial preview', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/remotion/terence/card-avatar')
    await expect(
      page.getByRole('heading', { name: 'Card Avatar' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: /在 Studio 中再创作|Remix in Studio/i })
      .click()

    await expect(page).toHaveURL(/\/studio\/[^/]+$/)
    await showPreviewOnMobile(page, isMobile)
    await expectRunnablePreview(page)
    await expect(page.getByText(/由再创作创建|Created from remix/i)).toBeVisible()
  })
})
