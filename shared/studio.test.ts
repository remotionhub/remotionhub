import { describe, expect, it } from 'vitest'
import {
  normalizeStudioComposition,
  serializeStudioCandidate,
} from './studio'

describe('Studio composition contract', () => {
  it('applies the 16:9 eight-second default at 30 fps', () => {
    expect(normalizeStudioComposition({})).toEqual({
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 240,
    })
  })

  it.each([
    ['16:9', 1920, 1080],
    ['9:16', 1080, 1920],
    ['1:1', 1080, 1080],
  ] as const)('normalizes %s', (aspectRatio, width, height) => {
    expect(
      normalizeStudioComposition({ aspectRatio, durationInFrames: 300 }),
    ).toEqual({ aspectRatio, width, height, fps: 30, durationInFrames: 300 })
  })

  it.each([29, 901])('rejects duration %s', (durationInFrames) => {
    expect(() => normalizeStudioComposition({ durationInFrames })).toThrow()
  })

  it('serializes source and composition deterministically', () => {
    const composition = normalizeStudioComposition({
      aspectRatio: '1:1',
      durationInFrames: 120,
    })
    expect(
      serializeStudioCandidate(
        'export const MyAnimation = () => null',
        composition,
      ),
    ).toBe(
      '{"code":"export const MyAnimation = () => null","composition":{"aspectRatio":"1:1","durationInFrames":120,"fps":30,"height":1080,"width":1080}}',
    )
  })
})
