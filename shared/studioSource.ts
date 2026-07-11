import { packages as BabelPackages } from '@babel/standalone'
import type {
  Expression,
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportSpecifier,
  Statement,
} from '@babel/types'

export const STUDIO_ALLOWED_APIS_BY_PACKAGE = {
  react: ['Fragment', 'createElement', 'useMemo'],
  remotion: [
    'AbsoluteFill',
    'Easing',
    'Freeze',
    'Loop',
    'Sequence',
    'Series',
    'interpolate',
    'interpolateColors',
    'measureSpring',
    'spring',
    'useCurrentFrame',
    'useVideoConfig',
  ],
  '@remotion/shapes': ['Circle', 'Ellipse', 'Pie', 'Polygon', 'Rect', 'Star'],
  '@remotion/transitions': [
    'TransitionSeries',
    'linearTiming',
    'springTiming',
  ],
  '@remotion/transitions/fade': ['fade'],
  '@remotion/transitions/slide': ['slide'],
  '@remotion/transitions/wipe': ['wipe'],
  '@remotion/lottie': ['Lottie'],
  '@remotion/three': ['ThreeCanvas'],
  '@react-three/fiber': ['Canvas', 'useThree'],
  three: [
    'AmbientLight',
    'BoxGeometry',
    'Color',
    'DirectionalLight',
    'Euler',
    'Group',
    'MathUtils',
    'Matrix3',
    'Matrix4',
    'Mesh',
    'MeshBasicMaterial',
    'MeshStandardMaterial',
    'PerspectiveCamera',
    'Quaternion',
    'Scene',
    'SphereGeometry',
    'Triangle',
    'Vector2',
    'Vector3',
  ],
} as const

type StudioRuntimePackage = keyof typeof STUDIO_ALLOWED_APIS_BY_PACKAGE

const ALLOWED_IMPORTS = new Set<StudioRuntimePackage>(
  Object.keys(STUDIO_ALLOWED_APIS_BY_PACKAGE) as StudioRuntimePackage[],
)

const ALLOWED_APIS = Object.fromEntries(
  Object.entries(STUDIO_ALLOWED_APIS_BY_PACKAGE).map(([pkg, apis]) => [
    pkg,
    new Set<string>(apis),
  ]),
) as Record<StudioRuntimePackage, Set<string>>

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
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  /\brequestAnimationFrame\s*\(/,
  /\bDate\s*\.\s*now\s*\(/,
  /\bnew\s+Date\s*\(/,
  /\bDate\s*\(/,
  /\bperformance\s*\.\s*now\s*\(/,
  /\bMath\s*\.\s*random\s*\(/,
  /\bcrypto\s*\.\s*(?:randomUUID|getRandomValues)\s*\(/,
  /<\s*(?:audio|embed|iframe|image|img|link|object|picture|source|style|video)\b/i,
  /@keyframes\b/i,
  /\burl\s*\(/i,
  /\b(?:animation|animationDelay|animationDirection|animationDuration|animationFillMode|animationIterationCount|animationName|animationPlayState|animationTimingFunction|transition|transitionDelay|transitionDuration|transitionProperty|transitionTimingFunction)\s*:/,
]

const FENCED_SOURCE = /^```(?:tsx|ts|jsx|javascript)?\s*\n([\s\S]*?)\n```$/
const SOURCE_PREFIX =
  /^(?:import|export|const|let|var|function|class|type|interface|enum|namespace)\b|^(?:\/\/|\/\*)/

export const STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE = {
  react: '__studioReact',
  remotion: '__studioRemotion',
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

function isComponentInitializer(initializer: Expression | null | undefined) {
  return (
    (initializer?.type === 'ArrowFunctionExpression' ||
      initializer?.type === 'FunctionExpression') &&
    initializer.async !== true &&
    ('generator' in initializer ? initializer.generator !== true : true)
  )
}

function collectStudioComponentBindings(statements: Statement[]) {
  const bindings = new Set<string>()
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id &&
      declaration.async !== true &&
      declaration.generator !== true
    ) {
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
      if (
        variable.id.type === 'Identifier' &&
        isComponentInitializer(variable.init)
      ) {
        bindings.add(variable.id.name)
      }
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
      declaration.id?.name === 'MyAnimation' &&
      declaration.async !== true &&
      declaration.generator !== true
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
          variable.id.name === 'MyAnimation' &&
          isComponentInitializer(variable.init),
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

export function sanitizeGeneratedSource(raw: string) {
  const normalized = raw.replace(/\r\n?/g, '\n').trim()
  const fenceMatch = normalized.match(FENCED_SOURCE)
  const source = (fenceMatch ? fenceMatch[1] : normalized).trim()

  if (!source || source.includes('```') || !SOURCE_PREFIX.test(source)) {
    throw new Error('Generated response must contain source only')
  }
  assertStudioMyAnimationExport(source)

  return source
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
      if (pkg !== 'react') {
        throw new Error('Unsupported Studio API')
      }
      if (specifier.local.name !== 'React') {
        bindings.push(`${specifier.local.name} = ${runtimeName}`)
      }
      continue
    }
    if (specifier.type === 'ImportNamespaceSpecifier') {
      throw new Error('Unsupported Studio API')
    }
    if (specifier.importKind !== 'type') {
      const importedName =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value
      if (!ALLOWED_APIS[pkg as StudioRuntimePackage].has(importedName)) {
        throw new Error('Unsupported Studio API')
      }
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
    if (
      !ALLOWED_IMPORTS.has(pkg as StudioRuntimePackage) ||
      declaration.specifiers.length === 0
    ) {
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
