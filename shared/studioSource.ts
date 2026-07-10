const ALLOWED_IMPORTS = new Set([
  'react',
  'remotion',
  '@remotion/player',
  '@remotion/shapes',
  '@remotion/transitions',
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
  '@remotion/lottie': '__studioRemotionLottie',
  '@remotion/three': '__studioRemotionThree',
  '@react-three/fiber': '__studioReactThreeFiber',
  three: '__studioThree',
} as const

const STATIC_IMPORT =
  /(^|\n)([\t ]*import\s+((?:type\s+)?(?:[$\w]+(?:\s*,\s*(?:\*\s+as\s+[$\w]+|\{[^}]*\}))?|\*\s+as\s+[$\w]+|\{[^}]*\}))\s+from\s*(['"])([^'"\r\n]+)\4[\t ]*;?[\t ]*)(?=\r?\n|$)/g

const UNRESOLVED_MODULE_SYNTAX =
  /\bimport\s+(?:['"]|type\b|[$\w*{])|\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s*['"]/

function preserveLineBreaks(value: string) {
  return value.replace(/[^\r\n]/g, '')
}

function buildInjectedBindings(importClause: string, pkg: string) {
  let clause = importClause.trim()
  if (clause.startsWith('type ')) return ''

  const bindings: string[] = []
  const defaultImport = clause.match(/^([$A-Z_a-z][$\w]*)(?:\s*,|$)/)
  if (defaultImport) {
    const localName = defaultImport[1]
    if (pkg !== 'react' || localName !== 'React') {
      const runtimeName =
        STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE[
          pkg as keyof typeof STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE
        ]
      bindings.push(
        `${localName} = ${runtimeName}.default ?? ${runtimeName}`,
      )
    }
    clause = clause.slice(defaultImport[0].length).trim()
  }

  const namespaceImport = clause.match(/^\*\s+as\s+([$A-Z_a-z][$\w]*)$/)
  if (namespaceImport) {
    const runtimeName =
      STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE[
        pkg as keyof typeof STUDIO_RUNTIME_NAMESPACE_BY_PACKAGE
      ]
    bindings.push(`${namespaceImport[1]} = ${runtimeName}`)
    clause = ''
  }

  if (clause.startsWith('{') && clause.endsWith('}')) {
    for (const rawSpecifier of clause.slice(1, -1).split(',')) {
      const specifier = rawSpecifier.trim()
      if (!specifier || specifier.startsWith('type ')) continue
      const match = specifier.match(
        /^([$A-Z_a-z][$\w]*)(?:\s+as\s+([$A-Z_a-z][$\w]*))?$/,
      )
      if (!match) throw new Error('Unsupported Studio dependency')
      const importedName = match[1]
      const localName = match[2] ?? importedName
      if (localName !== importedName) {
        bindings.push(`${localName} = ${importedName}`)
      }
    }
    clause = ''
  }

  if (clause) throw new Error('Unsupported Studio dependency')
  return bindings.length > 0 ? `const ${bindings.join(', ')}` : ''
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
  const withoutImports = source.replace(
    STATIC_IMPORT,
    (
      _match: string,
      leadingLineBreak: string,
      declaration: string,
      importClause: string,
      _quote: string,
      pkg: string,
    ) => {
      if (!ALLOWED_IMPORTS.has(pkg)) {
        throw new Error('Unsupported Studio dependency')
      }
      if (declared && !declared.has(pkg)) {
        throw new Error('Undeclared Studio dependency')
      }
      return (
        leadingLineBreak +
        buildInjectedBindings(importClause, pkg) +
        preserveLineBreaks(declaration)
      )
    },
  )

  if (UNRESOLVED_MODULE_SYNTAX.test(withoutImports)) {
    throw new Error('Unsupported Studio dependency')
  }

  return withoutImports
}
