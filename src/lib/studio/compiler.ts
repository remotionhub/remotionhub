import * as Babel from '@babel/standalone'
import * as ReactRuntime from 'react'
import * as ReactThreeFiberRuntime from '@react-three/fiber'
import * as RemotionLottieRuntime from '@remotion/lottie'
import * as RemotionPlayerRuntime from '@remotion/player'
import * as RemotionShapesRuntime from '@remotion/shapes'
import * as RemotionThreeRuntime from '@remotion/three'
import * as RemotionTransitionsRuntime from '@remotion/transitions'
import * as RemotionRuntime from 'remotion'
import * as ThreeRuntime from 'three'
import {
  STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE,
  validateAndStripStudioImports,
} from '../../../shared/studioSource'

const MAX_STUDIO_SOURCE_LENGTH = 100_000
const VALID_RUNTIME_NAME = /^[$A-Z_a-z][$\w]*$/
const INVALID_RUNTIME_NAMES = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'exports',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'module',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

const studioRuntime = Object.freeze({
  ...ThreeRuntime,
  ...ReactThreeFiberRuntime,
  ...RemotionThreeRuntime,
  ...RemotionLottieRuntime,
  ...RemotionTransitionsRuntime,
  ...RemotionShapesRuntime,
  ...RemotionPlayerRuntime,
  ...RemotionRuntime,
  ...ReactRuntime,
  React: ReactRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE.react]: ReactRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE.remotion]: RemotionRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@remotion/player']]:
    RemotionPlayerRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@remotion/shapes']]:
    RemotionShapesRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@remotion/transitions']]:
    RemotionTransitionsRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@remotion/lottie']]:
    RemotionLottieRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@remotion/three']]:
    RemotionThreeRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE['@react-three/fiber']]:
    ReactThreeFiberRuntime,
  [STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE.three]: ThreeRuntime,
})

const runtimeEntries = Object.entries(studioRuntime).filter(
  ([name]) =>
    VALID_RUNTIME_NAME.test(name) && !INVALID_RUNTIME_NAMES.has(name),
)
const runtimeNames = runtimeEntries.map(([name]) => name)
const runtimeValues = runtimeEntries.map(([, value]) => value)

export type StudioCompileErrorCode =
  | 'STUDIO_SOURCE_TOO_LARGE'
  | 'STUDIO_UNSUPPORTED_DEPENDENCY'
  | 'STUDIO_UNSUPPORTED_API'
  | 'STUDIO_TRANSFORM_FAILED'
  | 'STUDIO_EVALUATION_FAILED'
  | 'STUDIO_MISSING_EXPORT'

export class StudioCompileError extends Error {
  readonly code: StudioCompileErrorCode
  readonly line?: number
  readonly column?: number

  constructor(
    code: StudioCompileErrorCode,
    message: string,
    location?: { line?: number; column?: number },
  ) {
    super(message)
    this.name = 'StudioCompileError'
    this.code = code
    this.line = location?.line
    this.column = location?.column
    this.stack = undefined
  }
}

type ErrorWithLocation = {
  loc?: { line?: unknown; column?: unknown }
}

function getErrorLocation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const location = (error as ErrorWithLocation).loc
  const line = typeof location?.line === 'number' ? location.line : undefined
  const column =
    typeof location?.column === 'number' ? location.column : undefined
  return line === undefined && column === undefined ? undefined : { line, column }
}

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^studio-candidate\.tsx:\s*/, '').slice(0, 500)
}

function normalizeValidationError(error: unknown): never {
  const message = getSafeErrorMessage(error)
  if (message === 'Unsupported Studio dependency') {
    throw new StudioCompileError('STUDIO_UNSUPPORTED_DEPENDENCY', message)
  }
  if (message === 'Undeclared Studio dependency') {
    throw new StudioCompileError('STUDIO_UNSUPPORTED_DEPENDENCY', message)
  }
  if (message === 'Unsupported Studio API') {
    throw new StudioCompileError('STUDIO_UNSUPPORTED_API', message)
  }
  throw new StudioCompileError(
    'STUDIO_TRANSFORM_FAILED',
    message,
    getErrorLocation(error),
  )
}

export function compileStudioComponent(
  source: string,
): React.ComponentType<Record<string, never>> {
  if (source.length > MAX_STUDIO_SOURCE_LENGTH) {
    throw new StudioCompileError(
      'STUDIO_SOURCE_TOO_LARGE',
      'Studio source is too large',
    )
  }

  let sourceWithoutImports: string
  try {
    sourceWithoutImports = validateAndStripStudioImports(source)
  } catch (error) {
    normalizeValidationError(error)
  }

  let transformed: string
  try {
    const result = Babel.transform(sourceWithoutImports, {
      filename: 'studio-candidate.tsx',
      presets: ['typescript', 'react'],
      plugins: ['transform-modules-commonjs'],
      sourceType: 'module',
    })
    if (!result.code) {
      throw new Error('Studio source could not be transformed')
    }
    transformed = result.code
  } catch (error) {
    throw new StudioCompileError(
      'STUDIO_TRANSFORM_FAILED',
      getSafeErrorMessage(error),
      getErrorLocation(error),
    )
  }

  const studioModule = { exports: {} as Record<string, unknown> }
  try {
    const factory = new Function(
      ...runtimeNames,
      'module',
      'exports',
      `"use strict";\n${transformed}`,
    )
    factory(
      ...runtimeValues,
      studioModule,
      studioModule.exports,
    )
  } catch (error) {
    throw new StudioCompileError(
      'STUDIO_EVALUATION_FAILED',
      getSafeErrorMessage(error),
    )
  }

  const component = studioModule.exports.MyAnimation
  if (typeof component !== 'function') {
    throw new StudioCompileError(
      'STUDIO_MISSING_EXPORT',
      'MyAnimation export is required',
    )
  }

  return component as React.ComponentType<Record<string, never>>
}
