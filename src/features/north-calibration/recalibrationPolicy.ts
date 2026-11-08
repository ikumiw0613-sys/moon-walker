export const RECALIBRATION_RECOMMEND_AFTER_MS = 5 * 60_000
export const PROLONGED_POSE_INSTABILITY_MS = 15_000

export type RecalibrationRecommendationReason =
  | 'stale-calibration'
  | 'screen-orientation-changed'
  | 'prolonged-instability'

export type RequiredRecalibrationReason =
  | 'resumed-from-background'
  | 'orientation-recovered'
  | 'sensor-source-changed'
  | 'invalid-calibration'

export function requiredRecalibrationMessage(reason: RequiredRecalibrationReason | null | undefined) {
  switch (reason) {
    case 'resumed-from-background': return 'バックグラウンドから復帰したため、北補正をやり直してください。'
    case 'orientation-recovered': return '向きセンサーが停止後に復帰しました。基準を確認するため、向きを再調整してください。'
    case 'sensor-source-changed': return '向きセンサーの取得元が変わりました。基準を確認するため、向きを再調整してください。'
    default: return '向きの基準を確認できません。向きを再調整してください。'
  }
}
