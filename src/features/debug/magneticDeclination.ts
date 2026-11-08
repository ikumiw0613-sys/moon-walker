import { model } from 'geomagnetism'
import type { UserLocation } from '../geolocation/types'

export type DebugMagneticDeclination = {
  magneticDeclination: number | null
  modelName: string | null
  modelEpoch: number | null
  modelDate: string | null
  modelValidFrom: string | null
  modelValidTo: string | null
  modelAltitudeMeters: number
  modelUnavailableReason: string | null
}

/** Debug readout only. East-positive degrees; never applied to any heading. */
export function getDebugMagneticDeclination(
  location: Pick<UserLocation, 'latitude' | 'longitude'> | null, date: Date,
): DebugMagneticDeclination {
  const result: DebugMagneticDeclination = {
    magneticDeclination: null, modelName: null, modelEpoch: null,
    modelDate: Number.isFinite(date.getTime()) ? date.toISOString() : null,
    modelValidFrom: null, modelValidTo: null,
    // Fixed WGS84 ellipsoid height for reproducibility; not a measured altitude.
    modelAltitudeMeters: 0, modelUnavailableReason: null,
  }
  if (!location) return { ...result, modelUnavailableReason: '現在地を取得してください。' }
  if (![location.latitude, location.longitude].every(Number.isFinite)
    || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    return { ...result, modelUnavailableReason: '現在地の座標が無効です。' }
  }
  if (result.modelDate === null) return { ...result, modelUnavailableReason: '現在日時が無効です。' }
  try {
    // Strict library validity dates: no extrapolation or fallback to a fixed offset.
    const magneticModel = model(date, { allowOutOfBoundsModel: false })
    result.modelName = magneticModel.name
    result.modelEpoch = magneticModel.epoch
    result.modelValidFrom = magneticModel.start_date.toISOString()
    result.modelValidTo = magneticModel.end_date.toISOString()
    const point = magneticModel.point([location.latitude, location.longitude, 0])
    if (!Number.isFinite(point.decl) || !Number.isFinite(point.h) || point.h < 2000) {
      return { ...result, modelUnavailableReason: '磁場水平成分が弱い、またはモデルの計算結果が無効です。' }
    }
    return { ...result, magneticDeclination: point.decl }
  } catch (error: unknown) {
    return { ...result, modelUnavailableReason: `WMM算出不可（モデル有効期間外など）: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}
