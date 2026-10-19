export function diagnosticValue(value: number | boolean | null | undefined): string {
  if (value === undefined) return 'unavailable'
  if (value === null) return 'null'
  if (typeof value === 'boolean') return String(value)
  return Number.isFinite(value) ? value.toFixed(2) : 'unavailable (non-finite)'
}

export function eventTime(value: number | undefined): string {
  return value === undefined ? 'null (未受信)' : new Date(value).toLocaleTimeString('ja-JP', { hour12: false }) + `.${String(value % 1000).padStart(3, '0')} (端末時刻)`
}

export const diagnosticDegrees = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}°`

export const diagnosticSignedDegrees = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'unavailable'
  const rounded = Number(value.toFixed(1))
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}°`
}

