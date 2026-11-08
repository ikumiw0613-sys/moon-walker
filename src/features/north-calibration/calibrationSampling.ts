import { normalizeAzimuth, normalizeSignedAngle } from '../../shared/math/angles'
import type { RawOrientationEvent } from '../device-orientation/useDeviceOrientation'
import { getHorizontalCalibration } from './horizontalCalibration'

export const CALIBRATION_SAMPLING_LIMITS = {
  durationMs: 2500,
  maximumDurationMs: 3000,
  minimumSamples: 20,
  sampleIntervalMs: 100,
  maximumGapMs: 500,
  settlingMs: 500,
  jumpDegrees: 8,
  candidateRangeDegrees: 6,
  headingRangeDegrees: 6,
  tiltRangeDegrees: 6,
  maximumAccuracyDegrees: 20,
} as const

type Sample = { at: number; heading: number; beta: number; gamma: number; candidate: number }
export type CalibrationMeasurement = {
  phase: 'waiting' | 'settling' | 'collecting' | 'unstable' | 'accuracy' | 'complete'
  message: string
  progress: number
  northCorrection: number | null
}
export type CalibrationCollection = CalibrationMeasurement & {
  samples: Sample[]
  lastValid: Sample | null
  lastEventAt: number | null
  sourceKey: string | null
  screenAngle: number | null
  notBefore: number
}

/** Median on an unwrapped occupied arc; only a narrow arc can pass calibration. */
export function circularMedianAndRange(values: number[]) {
  if (!values.length || !values.every(Number.isFinite)) return null
  const angles = values.map(normalizeAzimuth).sort((a, b) => a - b)
  let largestGap = -1
  let start = angles[0]
  for (let i = 0; i < angles.length; i++) {
    const next = angles[(i + 1) % angles.length]
    const gap = (i === angles.length - 1 ? next + 360 : next) - angles[i]
    if (gap > largestGap) { largestGap = gap; start = next }
  }
  const unwrapped = angles.map(angle => normalizeAzimuth(angle - start)).sort((a, b) => a - b)
  const mid = Math.floor(unwrapped.length / 2)
  const median = unwrapped.length % 2 ? unwrapped[mid] : (unwrapped[mid - 1] + unwrapped[mid]) / 2
  return { median: normalizeSignedAngle(start + median), range: 360 - largestGap }
}

export function createCalibrationCollection(now: number, message = '向きを保ってください。測定の準備をしています。'): CalibrationCollection {
  return { phase: 'settling', message, progress: 0, northCorrection: null, samples: [],
    lastValid: null, lastEventAt: null, sourceKey: null, screenAngle: null,
    notBefore: now + CALIBRATION_SAMPLING_LIMITS.settlingMs }
}

function clearSamples(state: CalibrationCollection, phase: CalibrationMeasurement['phase'], message: string): CalibrationCollection {
  return { ...state, phase, message, progress: 0, northCorrection: null, samples: [], lastValid: null }
}

/** One candidate from ONE accepted event. Never pair a current heading with an old pose. */
export function collectCalibrationEvent(
  previous: CalibrationCollection, event: RawOrientationEvent, now: number, screenAngle: number | null,
): CalibrationCollection {
  const limits = CALIBRATION_SAMPLING_LIMITS
  const sourceKey = `${event.eventType}:${event.absolute}`
  if (previous.sourceKey !== null && (previous.sourceKey !== sourceKey || previous.screenAngle !== screenAngle)) {
    return { ...createCalibrationCollection(now, '取得条件が変わりました。向きを保って、もう一度測定します。'),
      sourceKey, screenAngle, lastEventAt: event.receivedAt }
  }
  if (previous.phase === 'complete') return previous
  if (!Number.isFinite(event.receivedAt) || now - event.receivedAt < 0 || now - event.receivedAt > limits.maximumGapMs) {
    return { ...createCalibrationCollection(now, '新しいセンサー値を待っています。向きを保ってください。'), sourceKey, screenAngle }
  }
  if (previous.lastEventAt !== null && event.receivedAt < previous.lastEventAt) {
    return { ...createCalibrationCollection(now, '測定時刻が変わりました。もう一度測定します。'), sourceKey, screenAngle }
  }
  if (event.receivedAt === previous.lastEventAt) return previous
  let state = { ...previous, sourceKey, screenAngle, lastEventAt: event.receivedAt }
  if (previous.lastValid && event.receivedAt - previous.lastValid.at > limits.maximumGapMs) {
    return { ...createCalibrationCollection(now, '測定が途切れました。向きを保って、もう一度測定します。'),
      sourceKey, screenAngle, lastEventAt: event.receivedAt }
  }
  if (event.receivedAt < state.notBefore) return state

  const horizontal = getHorizontalCalibration(event)
  if (!horizontal.canCalibrate || horizontal.northCorrection === null || horizontal.compassHeading === null) {
    return clearSamples(state, 'waiting', !horizontal.isHorizontal
      ? 'スマホをまっすぐ前に向けてください。向きを保つと測定を始めます。'
      : 'コンパスの方位を待っています。向きを保ってください。')
  }
  const accuracy = event.webkitCompassAccuracy
  // Missing accuracy is unsupported, not "uncalibrated". Do not block such devices.
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > limits.maximumAccuracyDegrees)) {
    return clearSamples(state, 'accuracy', accuracy < 0
      ? 'コンパスが未校正です。端末をゆっくり動かしてから、向きを保ってください。'
      : 'コンパスの精度が低下しています。場所を変えて、もう一度測定してください。')
  }
  const sample: Sample = { at: event.receivedAt, heading: horizontal.compassHeading,
    beta: event.beta!, gamma: event.gamma!, candidate: horizontal.northCorrection }
  const last = previous.lastValid
  if (last && (['heading', 'beta', 'gamma', 'candidate'] as const).some(
    key => Math.abs(normalizeSignedAngle(sample[key] - last[key])) > limits.jumpDegrees,
  )) {
    // An isolated spike is excluded without making it the next comparison baseline.
    return { ...state, phase: 'unstable', message: 'もう少し静止してください。急な変化を除いて測定しています。' }
  }
  state = { ...state, lastValid: sample }
  const lastTaken = state.samples.at(-1)
  if (lastTaken && sample.at - lastTaken.at < limits.sampleIntervalMs) return state
  const samples = [...state.samples, sample]
  const elapsed = sample.at - samples[0].at
  const candidate = circularMedianAndRange(samples.map(value => value.candidate))!
  const stable = candidate.range <= limits.candidateRangeDegrees
    && circularMedianAndRange(samples.map(value => value.heading))!.range <= limits.headingRangeDegrees
    && (['beta', 'gamma'] as const).every(key => circularMedianAndRange(samples.map(value => value[key]))!.range <= limits.tiltRangeDegrees)
  if (!stable) {
    // Restart the whole interval; a narrow tail cannot borrow time from an unstable prefix.
    return clearSamples(state, 'unstable', 'もう少し静止してください。向きのばらつきがあるため測り直します。')
  }
  if (elapsed >= limits.durationMs && samples.length >= limits.minimumSamples) {
    return { ...state, samples, phase: 'complete', message: 'センサーの準備完了', progress: 1,
      northCorrection: candidate.median }
  }
  if (elapsed >= limits.maximumDurationMs) {
    return clearSamples(state, 'waiting', '測定値が足りません。向きを保って、もう一度測定します。')
  }
  return { ...state, samples, phase: 'collecting', progress: Math.min(0.99, elapsed / limits.durationMs),
    message: '測定しています。約3秒、向きを保ってください。' }
}
