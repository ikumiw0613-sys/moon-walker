import { useSyncExternalStore } from 'react'
import { INITIAL_UPDATE_SNAPSHOT, serviceWorkerUpdates } from './serviceWorkerUpdates'
import './PWAUpdateNotice.css'

export function PWAUpdateNotice({ pathname, updates = serviceWorkerUpdates }: {
  pathname: string
  updates?: typeof serviceWorkerUpdates
}) {
  const snapshot = useSyncExternalStore(updates.subscribe, updates.getSnapshot, () => INITIAL_UPDATE_SNAPSHOT)
  // Keep the notice out of AR, calibration and diagnostic work; show it on the next suitable screen.
  if (!['/', '/moon-info'].includes(pathname) || ['idle', 'deferred'].includes(snapshot.status)) return null
  const updating = snapshot.status === 'updating'

  return <aside className="pwa-update-notice" aria-label="アプリの更新">
    <p className="pwa-update-title" role="status" aria-live="polite">
      {updating ? '更新しています…' : '新しいバージョンを利用できます'}
    </p>
    <p>更新すると画面を開き直します。現在地と向きの設定は再取得・再調整が必要です。</p>
    {snapshot.error && <p role="alert">{snapshot.error}</p>}
    <div className="pwa-update-actions">
      <button type="button" disabled={updating} onClick={updates.apply}>{updating ? '更新中…' : '更新する'}</button>
      <button type="button" disabled={updating} onClick={updates.defer}>後で</button>
    </div>
  </aside>
}
