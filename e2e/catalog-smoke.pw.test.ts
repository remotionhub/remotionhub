import { expect, test, type Page, type Locator } from '@playwright/test'

const TEST_REMOTION_NAME = 'Title Kinetic Bounce'
const TEST_REMOTION_PROMPT_REGEX = /Add the Title Kinetic Bounce/

async function scrollToElement(page: Page, locator: Locator) {
  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(locator).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
}

test.describe('catalog smoke', () => {
  test('desktop catalog and detail pages render core content', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /动画模板库/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: /文字特效|Text Effect/ }).click()

    const link = page.getByRole('link', { name: TEST_REMOTION_NAME })
    await scrollToElement(page, link)

    await link.click()
    await expect(
      page.getByRole('heading', { name: TEST_REMOTION_NAME }),
    ).toBeVisible()
    await expect(page.locator('textarea')).toHaveValue(
      TEST_REMOTION_PROMPT_REGEX,
    )
    await page.getByRole('tab', { name: /GitHub 源码/ }).click()
    await expect(page.getByRole('link', { name: /打开源码/ })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('language toggle switches platform UI without translating catalog data', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /动画模板库/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: /文字特效|Text Effect/ }).click()

    const link = page.getByRole('link', { name: TEST_REMOTION_NAME })
    await scrollToElement(page, link)

    await page.getByRole('button', { name: 'EN' }).click()
    await expect(
      page.getByRole('heading', { name: /Motion template library/ }),
    ).toBeVisible()
    await expect(link).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('heading', { name: /Motion template library/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: /文字特效|Text Effect/ }).click()
    await scrollToElement(page, link)

    await page.getByRole('button', { name: '中文' }).click()
    await expect(
      page.getByRole('heading', { name: /动画模板库/ }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('remotionhub.locale')))
      .toBe('zh')
    await expect(link).toBeVisible()
  })

  test('runtime catalog pages render independently', async ({ page }) => {
    await page.goto('/remotion')
    await expect(
      page.getByRole('heading', { name: /Remotion 组件/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: /文字特效|Text Effect/ }).click()

    const link = page.getByRole('link', { name: TEST_REMOTION_NAME })
    await scrollToElement(page, link)

    await page.goto('/hyperframes')
    await expect(
      page.getByRole('heading', { name: /HyperFrames 组件/ }),
    ).toBeVisible()
    await expect(link).not.toBeVisible()
    await expect(
      page.getByText(/未找到组件|No components found/),
    ).toBeVisible()
  })

  test('mobile catalog keeps cards readable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only smoke')

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /动画模板库/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: /文字特效|Text Effect/ }).click()

    const link = page.getByRole('link', { name: TEST_REMOTION_NAME })
    await scrollToElement(page, link)
  })
})
