// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
import DetailPage from './DetailPage'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

const detail = {
  publisher: { handle: 'terence', displayName: 'Terence' },
  component: {
    runtime: 'remotion' as const,
    slug: 'kinetic-title-pack',
    displayName: 'Kinetic Title Pack',
    summary: 'Reusable title animations.',
    tags: ['remotion', 'text', 'intro'],
    categories: ['title'],
    latestIsPrerelease: false,
  },
  selectedVersion: {
    version: '1.0.0',
    changelog: 'Initial release.',
    preview: {
      thumbnailUrl: 'https://example.com/thumb.jpg',
      previewVideoUrl: 'https://example.com/preview.mp4',
    },
    metadata: {
      runtime: 'remotion' as const,
      entryPoint: 'src/KineticTitlePack.tsx',
      aspectRatios: ['16:9'],
      durationFrames: 180,
      fps: 30,
    },
    createdAt: 1_781_570_933_000,
  },
  versions: [{ version: '1.0.0' }],
  artifact: {
    githubSource: {
      repo: 'tangwz/remotionhub-assets',
      ref: 'v1.0.0',
      commit: 'abc123',
      path: 'remotion/kinetic-title-pack',
      pinned: true,
    },
    license: 'MIT',
    usageMarkdown: 'Copy the component folder into your Remotion project.',
    agentPrompt: 'Add the Kinetic Title Pack.',
  },
}

describe('DetailPage', () => {
  afterEach(() => {
    cleanup()
  })

  function renderDetailPage() {
    render(
      <I18nProvider>
        <DetailPage detail={detail} />
      </I18nProvider>,
    )
  }

  it('renders preview before title and exposes unchanged catalog data', () => {
    renderDetailPage()

    const video = screen.getByLabelText('Kinetic Title Pack 预览')
    const title = screen.getByRole('heading', { name: 'Kinetic Title Pack' })

    expect(
      video.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByDisplayValue(/Add the Kinetic Title Pack/)).toBeTruthy()
    expect(screen.getByText('tangwz/remotionhub-assets')).toBeTruthy()
    expect(screen.getByText('Reusable title animations.')).toBeTruthy()
    expect(screen.getByText('text')).toBeTruthy()
    expect(screen.getByText('intro')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: '使用说明' }))
    expect(
      screen.getByText('Copy the component folder into your Remotion project.'),
    ).toBeTruthy()
  })

  it('renders Chinese UI labels by default', () => {
    renderDetailPage()

    expect(screen.getByRole('link', { name: '返回 Remotion 目录' })).toBeTruthy()
    expect(screen.getByText('版本 1.0.0，作者 Terence')).toBeTruthy()
    expect(screen.getByText('Remotion')).toBeTruthy()
    expect(screen.getByText('入口')).toBeTruthy()
    expect(screen.getByText('画幅')).toBeTruthy()
    expect(screen.getByText('时长')).toBeTruthy()
    expect(screen.getByText('180 帧 / 30 帧每秒')).toBeTruthy()
    expect(screen.getByText('许可证')).toBeTruthy()
    expect(screen.getByText('来源')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Agent 提示词' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'GitHub 源码' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '使用说明' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '复制提示词' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'GitHub 源码' }))
    expect(screen.getByText('Ref: v1.0.0')).toBeTruthy()
    expect(screen.getByText('Commit: abc123')).toBeTruthy()
    expect(screen.getByText('Path: remotion/kinetic-title-pack')).toBeTruthy()
    expect(screen.getByRole('link', { name: '打开源码' })).toBeTruthy()
  })

  it('renders localized preview fallback accessible text', () => {
    render(
      <I18nProvider>
        <DetailPage
          detail={{
            ...detail,
            selectedVersion: {
              ...detail.selectedVersion,
              preview: {},
            },
          }}
        />
      </I18nProvider>,
    )

    expect(
      screen.getByRole('img', {
        name: 'Kinetic Title Pack 预览不可用',
      }),
    ).toBeTruthy()
  })
})
