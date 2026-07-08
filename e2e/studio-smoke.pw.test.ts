import { expect, test } from '@playwright/test'

const USE_RECOMMENDED_TEMPLATE = /确认推荐模板|Use recommended template/
const GENERATE_VIDEO = /生成视频|Generate video/
const DOWNLOAD_MP4 = /下载 MP4|Download MP4/
const STUDIO_PROMPT = /Launch an AI analytics dashboard with a crisp product demo narrative\./
const IN_FLIGHT_OR_DONE_STATUS =
  /Queued|Planning|Rendering|Uploading|Completed|排队|规划|渲染|上传|完成/

test.describe('ai studio p0 smoke', () => {
  test('studio creates a generation job and exposes a downloadable artifact', async ({
    page,
  }) => {
    await page.goto('/studio')

    const promptInput = page.getByRole('textbox', {
      name: /提示词|Prompt/,
    })
    await expect(promptInput).toBeVisible()

    await page.getByRole('button', { name: USE_RECOMMENDED_TEMPLATE }).click()
    await expect(promptInput).toHaveValue(/.+/)

    await promptInput.fill(STUDIO_PROMPT.source)
    await page.getByRole('button', { name: GENERATE_VIDEO }).click()

    await expect(page.getByText(IN_FLIGHT_OR_DONE_STATUS)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: DOWNLOAD_MP4 })).toBeVisible({
      timeout: 60_000,
    })
  })
})
