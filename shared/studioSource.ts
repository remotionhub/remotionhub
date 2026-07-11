import { packages as BabelPackages } from '@babel/standalone'
import type {
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportSpecifier,
  Statement,
} from '@babel/types'

const ALLOWED_IMPORTS = new Set([
  'react',
  'remotion',
  '@remotion/player',
  '@remotion/shapes',
  '@remotion/transitions',
  '@remotion/transitions/fade',
  '@remotion/transitions/slide',
  '@remotion/transitions/wipe',
  '@remotion/lottie',
  '@remotion/three',
  '@react-three/fiber',
  'three',
])

const FORBIDDEN_PATTERNS = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
]

export const STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE = {
  react: '__studioReact',
  remotion: '__studioRemotion',
  '@remotion/player': '__studioRemotionPlayer',
  '@remotion/shapes': '__studioRemotionShapes',
  '@remotion/transitions': '__studioRemotionTransitions',
  '@remotion/transitions/fade': '__studioRemotionTransitionsFade',
  '@remotion/transitions/slide': '__studioRemotionTransitionsSlide',
  '@remotion/transitions/wipe': '__studioRemotionTransitionsWipe',
  '@remotion/lottie': '__studioRemotionLottie',
  '@remotion/three': '__studioRemotionThree',
  '@react-three/fiber': '__studioReactThreeFiber',
  three: '__studioThree',
} as const

function preserveLineBreaks(value: string) {
  return value.replace(/[^\r\n]/g, '')
}

function parseStudioSource(source: string) {
  return BabelPackages.parser.parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    ranges: true,
  })
}

function getExportedName(
  specifier: ExportNamedDeclaration['specifiers'][number],
) {
  if (specifier.type !== 'ExportSpecifier') return undefined
  return specifier.exported.type === 'Identifier'
    ? specifier.exported.name
    : specifier.exported.value
}

function collectStudioComponentBindings(statements: Statement[]) {
  const bindings = new Set<string>()
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      bindings.add(declaration.id.name)
      continue
    }
    if (
      declaration?.type !== 'VariableDeclaration' ||
      declaration.kind !== 'const' ||
      declaration.declare === true
    ) {
      continue
    }
    for (const variable of declaration.declarations) {
      if (variable.id.type === 'Identifier') bindings.add(variable.id.name)
    }
  }
  return bindings
}

export function assertStudioMyAnimationExport(source: string) {
  const statements = parseStudioSource(source).program.body
  const componentBindings = collectStudioComponentBindings(statements)

  for (const statement of statements) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.source) {
      continue
    }
    const declaration = statement.declaration
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id?.name === 'MyAnimation'
    ) {
      return
    }
    if (
      declaration?.type === 'VariableDeclaration' &&
      declaration.kind === 'const' &&
      declaration.declare !== true &&
      declaration.declarations.some(
        (variable) =>
          variable.id.type === 'Identifier' &&
          variable.id.name === 'MyAnimation',
      )
    ) {
      return
    }
    if (statement.exportKind === 'type') continue
    for (const specifier of statement.specifiers) {
      if (
        getExportedName(specifier) === 'MyAnimation' &&
        specifier.type === 'ExportSpecifier' &&
        specifier.exportKind !== 'type' &&
        specifier.local.type === 'Identifier' &&
        componentBindings.has(specifier.local.name)
      ) {
        return
      }
    }
  }

  throw new Error('MyAnimation export is required')
}

function getImportedAccess(
  runtimeName: string,
  specifier: ImportSpecifier,
) {
  return specifier.imported.type === 'Identifier'
    ? `${runtimeName}.${specifier.imported.name}`
    : `${runtimeName}[${JSON.stringify(specifier.imported.value)}]`
}

function buildInjectedBindings(declaration: ImportDeclaration, pkg: string) {
  if (declaration.importKind === 'type') return ''

  const runtimeName =
    STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE[
      pkg as keyof typeof STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE
    ]
  const bindings: string[] = []
  for (const specifier of declaration.specifiers) {
    if (specifier.type === 'ImportDefaultSpecifier') {
      if (pkg !== 'react' || specifier.local.name !== 'React') {
        bindings.push(
          `${specifier.local.name} = ${runtimeName}.default ?? ${runtimeName}`,
        )
      }
      continue
    }
    if (specifier.type === 'ImportNamespaceSpecifier') {
      bindings.push(`${specifier.local.name} = ${runtimeName}`)
      continue
    }
    if (specifier.importKind !== 'type') {
      bindings.push(
        `${specifier.local.name} = ${getImportedAccess(runtimeName, specifier)}`,
      )
    }
  }

  // `var` may intentionally shadow an injected factory parameter with the
  // package-specific binding while retaining import-like local semantics.
  return bindings.length > 0 ? `var ${bindings.join(', ')};` : ''
}

function getDeclarationRange(declaration: ImportDeclaration) {
  const { start, end } = declaration
  if (
    start === null ||
    start === undefined ||
    end === null ||
    end === undefined
  ) {
    throw new Error('Unsupported Studio dependency')
  }
  return { start, end }
}

export function validateAndStripStudioImports(
  source: string,
  declaredDependencies?: readonly string[],
) {
  // This allowlist reduces accidental misuse; it is not a security boundary.
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(source))) {
    throw new Error('Unsupported Studio API')
  }

  const declared = declaredDependencies
    ? new Set(declaredDependencies)
    : undefined
  const parsed = parseStudioSource(source)
  const imports: ImportDeclaration[] = []
  for (const statement of parsed.program.body) {
    if (statement.type === 'ImportDeclaration') {
      imports.push(statement)
      continue
    }
    if (
      (statement.type === 'ExportNamedDeclaration' && statement.source) ||
      statement.type === 'ExportAllDeclaration'
    ) {
      throw new Error('Unsupported Studio dependency')
    }
  }

  let cursor = 0
  let withoutImports = ''
  for (const declaration of imports) {
    const pkg = declaration.source.value
    if (!ALLOWED_IMPORTS.has(pkg) || declaration.specifiers.length === 0) {
      throw new Error('Unsupported Studio dependency')
    }
    if (declared && !declared.has(pkg)) {
      throw new Error('Undeclared Studio dependency')
    }

    const { start, end } = getDeclarationRange(declaration)
    withoutImports += source.slice(cursor, start)
    withoutImports += buildInjectedBindings(declaration, pkg)
    withoutImports += preserveLineBreaks(source.slice(start, end))
    cursor = end
  }

  return withoutImports + source.slice(cursor)
}
