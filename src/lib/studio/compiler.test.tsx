// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

let compileStudioComponent: typeof import('./compiler').compileStudioComponent
let StudioCompileError: typeof import('./compiler').StudioCompileError

describe('compileStudioComponent', () => {
  beforeAll(async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: () => undefined,
        getItem: () => null,
        key: () => null,
        length: 0,
        removeItem: () => undefined,
        setItem: () => undefined,
      },
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({ fillRect: () => undefined, fillStyle: '' }),
    })
    const compiler = await import('./compiler')
    compileStudioComponent = compiler.compileStudioComponent
    StudioCompileError = compiler.StudioCompileError
  })

  afterEach(cleanup)

  it('returns the required exported component', () => {
    const Component = compileStudioComponent(
      'export const MyAnimation = () => <AbsoluteFill data-testid="motion" />',
    )

    render(<Component />)

    expect(screen.getByTestId('motion')).toBeTruthy()
  })

  it('injects allowlisted imports and strips TypeScript syntax', () => {
    const Component = compileStudioComponent(
      [
        "import React, { type ReactNode } from 'react'",
        "import { AbsoluteFill } from 'remotion'",
        'const label: ReactNode = React.createElement(\'span\', null, \'Ready\')',
        'export function MyAnimation() {',
        '  return <AbsoluteFill>{label}</AbsoluteFill>',
        '}',
      ].join('\n'),
    )

    render(<Component />)

    expect(screen.getByText('Ready')).toBeTruthy()
  })

  it('preserves named aliases and package namespace imports', () => {
    const Component = compileStudioComponent(
      [
        "import { AbsoluteFill as Fill } from 'remotion'",
        "import * as THREE from 'three'",
        'export const MyAnimation = () => (',
        '  <Fill data-testid="aliased">{THREE.MathUtils.clamp(2, 0, 1)}</Fill>',
        ')',
      ].join('\n'),
    )

    render(<Component />)

    expect(screen.getByTestId('aliased').textContent).toBe('1')
  })

  it('accepts only allowlisted static imports', () => {
    expect(() =>
      compileStudioComponent(
        "import leftPad from 'left-pad'\nexport const MyAnimation = () => null",
      ),
    ).toThrow('Unsupported Studio dependency')
  })

  it.each(['window', 'document', 'localStorage', 'fetch(', 'import(', 'require('])(
    'rejects forbidden source token %s',
    (token) => {
      expect(() =>
        compileStudioComponent(
          `export const MyAnimation = () => { ${token}; return null }`,
        ),
      ).toThrow('Unsupported Studio API')
    },
  )

  it('rejects responses larger than 100 KB', () => {
    expect(() =>
      compileStudioComponent(
        `export const MyAnimation = () => null;/*${'x'.repeat(100_001)}*/`,
      ),
    ).toThrow('Studio source is too large')
  })

  it('requires MyAnimation to be a component export', () => {
    expect(() =>
      compileStudioComponent('export const SomethingElse = () => null'),
    ).toThrow('MyAnimation export is required')

    expect(() =>
      compileStudioComponent('export const MyAnimation = 42'),
    ).toThrow('MyAnimation export is required')
  })

  it('normalizes transform failures without exposing a stack', () => {
    let thrown: unknown
    try {
      compileStudioComponent(
        'export const MyAnimation = () => <AbsoluteFill broken=>',
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(StudioCompileError)
    expect(thrown).toMatchObject({
      code: 'STUDIO_TRANSFORM_FAILED',
      line: 1,
    })
    expect((thrown as InstanceType<typeof StudioCompileError>).stack).toBeUndefined()
  })
})
