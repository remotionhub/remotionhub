const FENCED_SOURCE = /^```(?:tsx|ts|jsx|javascript)?\s*\n([\s\S]*?)\n```$/
const SOURCE_PREFIX =
  /^(?:import|export|const|let|var|function|class|type|interface|enum|namespace)\b|^(?:\/\/|\/\*)/
const REQUIRED_EXPORT =
  /\bexport\s+(?:const\s+MyAnimation\b|function\s+MyAnimation\b)/

export function sanitizeGeneratedSource(raw: string) {
  const normalized = raw.replace(/\r\n?/g, '\n').trim()
  const fenceMatch = normalized.match(FENCED_SOURCE)
  const source = (fenceMatch ? fenceMatch[1] : normalized).trim()

  if (!source || source.includes('```') || !SOURCE_PREFIX.test(source)) {
    throw new Error('Generated response must contain source only')
  }
  if (!REQUIRED_EXPORT.test(source)) {
    throw new Error('MyAnimation export is required')
  }

  return source
}
