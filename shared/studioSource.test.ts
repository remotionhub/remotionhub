import { describe, expect, it } from 'vitest'
import {
  assertStudioMyAnimationExport,
  validateAndStripStudioImports,
} from './studioSource'

describe('validateAndStripStudioImports', () => {
  it('removes allowlisted static imports', () => {
    expect(
      validateAndStripStudioImports(
        [
          "import React from 'react'",
          "import { AbsoluteFill } from 'remotion'",
          '',
          'export const MyAnimation = () => <AbsoluteFill />',
        ].join('\n'),
      ),
    ).toBe(
      '\nvar AbsoluteFill = __studioRemotion.AbsoluteFill;\n\nexport const MyAnimation = () => <AbsoluteFill />',
    )
  })

  it('accepts every supported runtime package', () => {
    const source = [
      "import React from 'react'",
      "import { AbsoluteFill } from 'remotion'",
      "import { Circle } from '@remotion/shapes'",
      "import { TransitionSeries } from '@remotion/transitions'",
      "import { Lottie } from '@remotion/lottie'",
      "import { ThreeCanvas } from '@remotion/three'",
      "import { Canvas } from '@react-three/fiber'",
      "import { Scene } from 'three'",
      'export const MyAnimation = () => null',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(
      [
        '',
        'var AbsoluteFill = __studioRemotion.AbsoluteFill;',
        'var Circle = __studioRemotionShapes.Circle;',
        'var TransitionSeries = __studioRemotionTransitions.TransitionSeries;',
        'var Lottie = __studioRemotionLottie.Lottie;',
        'var ThreeCanvas = __studioRemotionThree.ThreeCanvas;',
        'var Canvas = __studioReactThreeFiber.Canvas;',
        'var Scene = __studioThree.Scene;',
        'export const MyAnimation = () => null',
      ].join('\n'),
    )
  })

  it('injects the supported transition presentation subpaths', () => {
    const source = [
      "import { fade } from '@remotion/transitions/fade'",
      "import { slide } from '@remotion/transitions/slide'",
      "import { wipe } from '@remotion/transitions/wipe'",
      'export const MyAnimation = () => null',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(
      [
        'var fade = __studioRemotionTransitionsFade.fade;',
        'var slide = __studioRemotionTransitionsSlide.slide;',
        'var wipe = __studioRemotionTransitionsWipe.wipe;',
        'export const MyAnimation = () => null',
      ].join('\n'),
    )
  })

  it('removes multiline static imports without shifting source lines', () => {
    const source = [
      'import React, {',
      '  type ReactNode,',
      "} from 'react'",
      'const label: ReactNode = null',
      'export const MyAnimation = () => label',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(
      '\n\n\nconst label: ReactNode = null\nexport const MyAnimation = () => label',
    )
  })

  it('accepts line breaks between every multiline import clause', () => {
    const source = [
      'import React,',
      '{',
      '  type ReactNode,',
      '}',
      "from 'react'",
      'export const MyAnimation = (): ReactNode => null',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(
      '\n'.repeat(5) + 'export const MyAnimation = (): ReactNode => null',
    )
  })

  it('preserves named aliases after stripping imports', () => {
    expect(
      validateAndStripStudioImports(
        [
          "import { AbsoluteFill as Fill } from 'remotion'",
          "import { MathUtils as ThreeMath } from 'three'",
          'export const MyAnimation = () => <Fill>{ThreeMath.clamp(2, 0, 1)}</Fill>',
        ].join('\n'),
      ),
    ).toBe(
      [
        'var Fill = __studioRemotion.AbsoluteFill;',
        'var ThreeMath = __studioThree.MathUtils;',
        'export const MyAnimation = () => <Fill>{ThreeMath.clamp(2, 0, 1)}</Fill>',
      ].join('\n'),
    )
  })

  it('binds every named import from its package namespace', () => {
    expect(
      validateAndStripStudioImports(
        "import { Triangle } from 'three'\nexport const MyAnimation = () => Triangle",
      ),
    ).toBe(
      'var Triangle = __studioThree.Triangle;\nexport const MyAnimation = () => Triangle',
    )
  })

  it.each([
    "import { delayRender } from 'remotion'",
    "import { Img } from 'remotion'",
    "import * as Remotion from 'remotion'",
  ])('rejects unsupported runtime APIs: %s', (moduleSyntax) => {
    expect(() =>
      validateAndStripStudioImports(
        `${moduleSyntax}\nexport const MyAnimation = () => null`,
      ),
    ).toThrow('Unsupported Studio API')
  })

  it('does not treat import-like text in strings, templates, or comments as modules', () => {
    const source = [
      "const stringValue = \"import { nope } from 'left-pad'\"",
      'const templateValue = `',
      "import { alsoNope } from 'left-pad'",
      '`',
      "// import { stillNope } from 'left-pad'",
      'export const MyAnimation = () => stringValue + templateValue',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(source)
  })

  it('rejects packages outside the allowlist', () => {
    expect(() =>
      validateAndStripStudioImports(
        "import leftPad from 'left-pad'\nexport const MyAnimation = () => null",
      ),
    ).toThrow('Unsupported Studio dependency')
  })

  it.each([
    "import './local'",
    "import 'react'",
    "export { AbsoluteFill } from 'remotion'",
    "export type { ComponentType } from 'react'",
    "export * as THREE from 'three'",
  ])('rejects unsupported module syntax: %s', (moduleSyntax) => {
    expect(() =>
      validateAndStripStudioImports(
        `${moduleSyntax}\nexport const MyAnimation = () => null`,
      ),
    ).toThrow('Unsupported Studio dependency')
  })

  it('requires imports to be declared when dependencies are provided', () => {
    expect(() =>
      validateAndStripStudioImports(
        "import { AbsoluteFill } from 'remotion'\nexport const MyAnimation = () => null",
        ['react'],
      ),
    ).toThrow('Undeclared Studio dependency')
  })

  it.each([
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'import(',
    'require(',
    'eval(',
    'Function(',
    'setTimeout(',
    'setInterval(',
    'requestAnimationFrame(',
    'Date.now(',
    'new Date(',
    'performance.now(',
    'Math.random(',
    'crypto.randomUUID(',
    'crypto.getRandomValues(',
  ])('rejects forbidden source token %s', (token) => {
    expect(() =>
      validateAndStripStudioImports(
        `export const MyAnimation = () => { ${token}; return null }`,
      ),
    ).toThrow('Unsupported Studio API')
  })

  it('requires MyAnimation to be backed by a function component', () => {
    expect(() =>
      assertStudioMyAnimationExport('export const MyAnimation = 1'),
    ).toThrow('MyAnimation export is required')
    expect(() =>
      assertStudioMyAnimationExport(
        'const Animation = 1\nexport { Animation as MyAnimation }',
      ),
    ).toThrow('MyAnimation export is required')
  })

  it.each([
    'export async function MyAnimation() { return null }',
    'export function* MyAnimation() { yield null }',
    'export const MyAnimation = async () => null',
    'const Animation = async function () { return null }; export { Animation as MyAnimation }',
  ])('rejects asynchronous or generator component exports: %s', (source) => {
    expect(() => assertStudioMyAnimationExport(source)).toThrow(
      'MyAnimation export is required',
    )
  })

  it.each([
    'export const MyAnimation = () => <img src="https://example.com/a.png" />',
    'export const MyAnimation = () => <video />',
    'export const MyAnimation = () => <iframe />',
    'export const MyAnimation = () => <svg><image href="https://example.com/a.svg" /></svg>',
    "export const MyAnimation = () => <div style={{backgroundImage: 'url(https://example.com/a.png)'}} />",
    "export const MyAnimation = () => <div style={{animation: 'spin 2s infinite'}} />",
    "export const MyAnimation = () => <div style={{transition: 'opacity 1s'}} />",
    'export const MyAnimation = () => <style>{`@keyframes spin {}`}</style>',
  ])('rejects browser asset loads and CSS time-based animation: %s', (source) => {
    expect(() => validateAndStripStudioImports(source)).toThrow(
      'Unsupported Studio API',
    )
  })
})
