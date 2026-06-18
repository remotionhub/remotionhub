import { expect, test } from '@playwright/test'

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
      page.getByRole('heading', { name: /动态组件目录/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()

    await page.getByRole('link', { name: /Kinetic Title Pack/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Kinetic Title Pack' }),
    ).toBeVisible()
    await expect(page.locator('textarea')).toHaveValue(
      /Add the Kinetic Title Pack/,
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
      page.getByRole('heading', { name: /动态组件目录/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'EN' }).click()
    await expect(
      page.getByRole('heading', { name: /Motion component catalog/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('heading', { name: /Motion component catalog/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: '中文' }).click()
    await expect(
      page.getByRole('heading', { name: /动态组件目录/ }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('remotionhub.locale')))
      .toBe('zh')
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()
  })

  test('runtime catalog pages render independently', async ({ page }) => {
    await page.goto('/remotion')
    await expect(
      page.getByRole('heading', { name: /Remotion 组件/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()

    await page.goto('/hyperframes')
    await expect(
      page.getByRole('heading', { name: /HyperFrames 组件/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Lower Third Pack/ }),
    ).toBeVisible()
  })

  test('mobile catalog keeps cards readable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only smoke')

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /动态组件目录/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Kinetic Title Pack/ }),
    ).toBeVisible()
  })
})
