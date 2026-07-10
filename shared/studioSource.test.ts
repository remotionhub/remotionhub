import { describe, expect, it } from 'vitest'
import { validateAndStripStudioImports } from './studioSource'

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
      '\n\n\nexport const MyAnimation = () => <AbsoluteFill />',
    )
  })

  it('accepts every supported runtime package', () => {
    const source = [
      "import React from 'react'",
      "import { AbsoluteFill } from 'remotion'",
      "import { Player } from '@remotion/player'",
      "import { Circle } from '@remotion/shapes'",
      "import { TransitionSeries } from '@remotion/transitions'",
      "import { Lottie } from '@remotion/lottie'",
      "import { ThreeCanvas } from '@remotion/three'",
      "import { Canvas } from '@react-three/fiber'",
      "import { Scene } from 'three'",
      'export const MyAnimation = () => null',
    ].join('\n')

    expect(validateAndStripStudioImports(source)).toBe(
      '\n'.repeat(9) + 'export const MyAnimation = () => null',
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

  it('preserves named aliases and namespace bindings after stripping imports', () => {
    expect(
      validateAndStripStudioImports(
        [
          "import { AbsoluteFill as Fill } from 'remotion'",
          "import * as THREE from 'three'",
          'export const MyAnimation = () => <Fill>{THREE.REVISION}</Fill>',
        ].join('\n'),
      ),
    ).toBe(
      [
        'const Fill = AbsoluteFill',
        'const THREE = __studioThree',
        'export const MyAnimation = () => <Fill>{THREE.REVISION}</Fill>',
      ].join('\n'),
    )
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
  ])('rejects forbidden source token %s', (token) => {
    expect(() =>
      validateAndStripStudioImports(
        `export const MyAnimation = () => { ${token}; return null }`,
      ),
    ).toThrow('Unsupported Studio API')
  })
})
