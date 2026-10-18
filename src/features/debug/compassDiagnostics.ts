import { normalizeAzimuth, normalizeSignedAngle } from '../../shared/math/angles'

// Debug-only limits. None of these values participate in calibration or AR guidance.
export const COMPASS_WINDOW_MS = 3000
export const COMPASS_SAMPLE_INTERVAL_MS = 100
export const COMPASS_MAX_SAMPLES = 30
export const COMPASS_STALE_MS = 1000
export const COMPASS_MIN_SAMPLES = 10
export const COMPASS_QUALITY_LIMITS = {
  goodAccuracy: 10, poorAccuracy: 20, goodRange: 3, poorRange: 8,
} as const

export type Statistics = { count: number; median: number; min: number; max: number; range: number; deviation: number }
export type CompassSample = {
  at: number; heading: number | null; accuracy: number | null; candidate: number | null
}
export type CompassQuality = { status: 'good' | 'caution' | 'poor' | 'unavailable'; reasons: string[] }

export function linearStatistics(samples: number[]): Statistics | null {
  const values = samples.filter(Number.isFinite).sort((a, b) => a - b)
  if (!values.length) return null
  const count = values.length
  const mean = values.reduce((sum, value) => sum + value, 0) / count
  return { count, median: (values[Math.floor((count - 1) / 2)] + values[Math.floor(count / 2)]) / 2,
    min: values[0], max: values[count - 1], range: values[count - 1] - values[0],
    deviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count) }
}

/** Cut at the largest empty arc, then measure differences around the occupied arc's midpoint.
 * min/max are endpoints along that arc, so e.g. min=359, max=1, range=2 is intentional.
 * This also avoids a false narrow range for samples distributed around the whole circle.
 */
export function angularStatistics(samples: number[]): Statistics | null {
  const angles = samples.filter(Number.isFinite).map(normalizeAzimuth).sort((a, b) => a - b)
  if (!angles.length) return null
  let gap = -1
  let start = angles[0]
  for (let i = 0; i < angles.length; i++) {
    const next = angles[(i + 1) % angles.length]
    const size = (i === angles.length - 1 ? next + 360 : next) - angles[i]
    if (size > gap) { gap = size; start = next }
  }
  const reference = normalizeAzimuth(start + (360 - gap) / 2)
  const stats = linearStatistics(angles.map(angle => normalizeSignedAngle(angle - reference)))!
  return { ...stats, median: normalizeAzimuth(reference + stats.median),
    min: normalizeAzimuth(reference + stats.min), max: normalizeAzimuth(reference + stats.max) }
}

export function appendCompassSample(samples: CompassSample[], sample: CompassSample): CompassSample[] {
  const recent = samples.filter(value => sample.at - value.at <= COMPASS_WINDOW_MS && value.at <= sample.at)
  const previous = recent.at(-1)
  if (previous && sample.at - previous.at < COMPASS_SAMPLE_INTERVAL_MS) return recent.length === samples.length ? samples : recent
  return [...recent, sample].slice(-COMPASS_MAX_SAMPLES)
}

export function getCompassStatistics(samples: CompassSample[]) {
  return {
    candidate: angularStatistics(samples.flatMap(sample => sample.candidate === null ? [] : [sample.candidate])),
    heading: angularStatistics(samples.flatMap(sample => sample.heading === null ? [] : [sample.heading])),
    accuracy: linearStatistics(samples.flatMap(sample => sample.accuracy === null ? [] : [sample.accuracy])),
  }
}

export function getCompassQuality(stats: ReturnType<typeof getCompassStatistics>, current: CompassSample | null,
  unavailableReason: string | null = null): CompassQuality {
  if (unavailableReason) return { status: 'unavailable', reasons: [unavailableReason] }
  if (!current || current.heading === null || current.candidate === null || current.accuracy === null) {
    return { status: 'unavailable', reasons: ['有効な heading / candidate / accuracy が揃っていません（未対応・負の精度を含む）'] }
  }
  if ([stats.heading, stats.candidate, stats.accuracy].some(value => !value || value.count < COMPASS_MIN_SAMPLES)) {
    return { status: 'unavailable', reasons: [`有効サンプル不足（各 ${COMPASS_MIN_SAMPLES} 件以上必要）`] }
  }
  const accuracy = Math.max(current.accuracy, stats.accuracy!.median)
  const candidate = stats.candidate!.range
  const heading = stats.heading!.range
  const limits = COMPASS_QUALITY_LIMITS
  const reasons = [
    accuracy > limits.goodAccuracy ? `コンパス精度が低下（現在値・中央値の悪い方 ${accuracy.toFixed(1)}°）` : 'コンパス精度は良好',
    candidate > limits.goodRange ? `北補正候補が変動（range ${candidate.toFixed(1)}°）` : '北補正候補は安定',
    heading > limits.goodRange ? `heading が変動（range ${heading.toFixed(1)}°・端末の動きも含む）` : 'heading は安定',
  ]
  const status = accuracy > limits.poorAccuracy || candidate > limits.poorRange || heading > limits.poorRange ? 'poor'
    : accuracy > limits.goodAccuracy || candidate > limits.goodRange || heading > limits.goodRange ? 'caution' : 'good'
  return { status, reasons }
}
