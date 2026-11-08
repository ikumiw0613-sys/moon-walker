import { AppLink } from '../../../app/navigation/AppNavigation'
import type { Navigate } from '../../../app/navigation/AppNavigation'
import type { RecalibrationRecommendationReason } from '../../../features/north-calibration/recalibrationPolicy'

export function RecalibrationNotice({ reasons, navigate, onDismiss }: {
  reasons: RecalibrationRecommendationReason[]
  navigate: Navigate
  onDismiss: () => void
}) {
  return <aside className="mw-ar-recalibration-notice" aria-label="向きの再調整" data-recalibration-reasons={reasons.join(',')}>
    <p role="status">{reasons.includes('stale-calibration')
      ? 'しばらく使用しています。必要に応じて向きを再調整してください。'
      : '向きの精度を保つため、必要に応じて再調整できます。'}</p>
    <AppLink to="/calibration" navigate={navigate}>向きを再調整</AppLink>
    <button type="button" onClick={onDismiss} aria-label="再調整の案内を閉じる">×</button>
  </aside>
}
