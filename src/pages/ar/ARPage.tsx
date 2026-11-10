import { AppLink } from '../../app/navigation/AppNavigation'
import { useRef, useState } from 'react'
import { readARProjectionFlags } from '../../features/debug/arProjectionDiagnostics'
import { ARProjectionExperiment } from './components/ARProjectionExperiment'
import type { Navigate } from '../../app/navigation/AppNavigation'
import type { GeolocationAccess } from '../../features/geolocation/types'
import { getMoonDeviceDiagnosticAttributes } from '../../features/moon-guide/moonDeviceNavigation'
import { SkyBackground } from '../../features/sky/SkyBackground'
import { MoonSprite } from './components/MoonSprite'
import { MoonDisc } from '../../features/moon/components/MoonDisc'
import { useARView } from './useARView'
import { useARRecalibration } from '../../features/north-calibration/useARRecalibration'
import { RecalibrationNotice } from './components/RecalibrationNotice'
import '../../shared/styles/frontend.css'
import './ARPage.css'

export function ARPage({ navigate, state: location, requestLocation }: { navigate: Navigate } & GeolocationAccess) {
  const { now, moonPhase, moonPosition, timeMode, ready, needsRecalibration, isBelowHorizon, orientation, requestPermission, retryConnection, deviceState,
    guidance, isNear, isCentered, parallax, moonScreen, moonEdge, moonBehind, poseStability, isPoseChecking,
    orientationDiagnostics } = useARView(location)
  const accepted = orientationDiagnostics?.lastAccepted
  const sourceKey = accepted?.eventType && typeof accepted.absolute === 'boolean'
    ? `${accepted.eventType}:${accepted.absolute}` : null
  const recalibration = useARRecalibration({ ready, orientationStatus: orientation.status,
    sourceKey, poseStatus: poseStability.status })
  const recalibrationNotice = recalibration.visible
    ? <RecalibrationNotice reasons={recalibration.reasons} navigate={navigate} onDismiss={recalibration.dismiss} /> : null
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [projectionDebug] = useState(() => readARProjectionFlags(typeof window === 'undefined' ? '' : window.location.search))
  return (
    <SkyBackground
      offsetX={parallax.offsetX}
      offsetY={parallax.offsetY}
    >
      <main className="mw-screen mw-ar" aria-label="月を探す" {...getMoonDeviceDiagnosticAttributes(deviceState, now)}
        data-pose-stability={poseStability.status} data-pose-stability-reason={poseStability.reason}>
        <header className="mw-top">
          <AppLink
            to="/"
            navigate={navigate}
            className="mw-ar-close"
          >
            <span aria-hidden="true">×</span>
            <span className="mw-sr-only">ホームへ戻る</span>
          </AppLink>

          <div className="mw-ar-title">
            <span className="mw-ar-eyebrow">MOON WALKER</span>
            <h1>月を探す</h1>
          </div>

          <AppLink
            to="/moon-info"
            navigate={navigate}
            className="mw-ar-info"
          >
            月の情報
          </AppLink>
        </header>

        {timeMode === 'fixed' && <p className="mw-ar-test-time" role="status">テスト日時で表示中（2026年10月11日 10:00 日本時間）</p>}

        <div ref={viewportRef} className="mw-ar-viewport" aria-hidden="true">
          {projectionDebug.enabled ? <ARProjectionExperiment viewportRef={viewportRef} screen={moonScreen}
            moonPosition={moonPosition} deviceState={deviceState} phase={moonPhase} canRender={Boolean(guidance)} now={now}
            location={location.status === 'success' ? location.location : null}
            timeMode={timeMode} orientationStatus={orientation.status} poseStatus={poseStability.status}
            initialPlacement={projectionDebug.placement} /> : guidance && moonScreen && (
            <MoonSprite x={moonScreen.x} y={moonScreen.y} visible={moonScreen.visible} phase={moonPhase} />
          )}
          {guidance && moonEdge && (
            <div className="mw-ar-moon-marker" style={{ left: `${moonEdge.x * 100}%`, top: `${moonEdge.y * 100}%` }}>
              <span className="mw-ar-moon-thumbnail"><MoonDisc phase={moonPhase} /></span>
              <span>{moonBehind ? '反対側に月' : '画面外に月'}</span>
              <span className="mw-ar-moon-marker-arrow" aria-hidden="true">{guidance.arrow}</span>
            </div>
          )}
          {isNear && (
            <div
              className={[
                'mw-ar-ring',
                isCentered ? 'mw-ar-ring--centered' : 'mw-ar-ring--near',
              ].join(' ')}
            />
          )}
        </div>

        {guidance && (
          <section className={`mw-ar-guide${isCentered ? ' is-centered' : ''}`} aria-label="月への案内">
            {!isCentered && <p className="mw-ar-guide-label">スマホをゆっくり動かして</p>}
            <div className="mw-ar-guidance-row">
              {!isCentered && <span className="mw-ar-arrow" aria-hidden="true">{guidance.arrow}</span>}
              <p className="mw-ar-message" role="status" aria-live="polite" aria-atomic="true">
                {isCentered ? 'このあたりに月があります' : guidance.message}
              </p>
            </div>
            <div className="mw-ar-guide-footer">
              <span className="mw-ar-distance">
                方向のずれ
                <strong>
                  {guidance.angleToMoon.toFixed(1)}°
                </strong>
              </span>
              <AppLink to="/calibration" navigate={navigate} className="mw-ar-recalibrate">向きを調整</AppLink>
            </div>
            {recalibrationNotice}
          </section>
        )}

        {isBelowHorizon && !needsRecalibration && (
          <section className="mw-ar-state mw-ar-below-horizon" role="status" aria-labelledby="below-horizon-title">
            <h1 id="below-horizon-title">月は地平線の<br />下にあります</h1>
            <p>今は空に月を見ることができません。</p>
            <AppLink to="/moon-info" navigate={navigate} className="mw-primary">月の情報を見る</AppLink>
            {recalibrationNotice}
          </section>
        )}

        {!isBelowHorizon && ready && location.status === 'success' && !guidance && (
          <div className="mw-ar-state">
            <h2>{isPoseChecking ? '向きを確認しています…' : 'スマホの向きを確認'}</h2>
            <p role="status">{isPoseChecking ? '姿勢が落ち着くと案内を再開します。リングの周辺も見渡してください。' : orientation.message}</p>
            {orientation.status === 'unavailable' && (
              <button type="button" className="mw-primary" onClick={retryConnection}>向きセンサーに再接続する</button>
            )}
            {['idle', 'denied', 'error'].includes(orientation.status) && (
              <button type="button" className="mw-primary" onClick={() => void requestPermission()}>
                向きセンサーを許可する
              </button>
            )}
            {recalibrationNotice}
          </div>
        )}

        {(!isBelowHorizon || needsRecalibration) && !ready && (
          <div className="mw-ar-state">
            <h2>{needsRecalibration ? '向きを再確認してください' : 'まずは向きを合わせましょう'}</h2>
            <p>{needsRecalibration ? recalibration.requiredMessage : '月を探す準備ができていません'}</p>
            <AppLink
              to="/calibration"
              navigate={navigate}
              className="mw-primary"
            >
              {needsRecalibration ? '北補正をやり直す' : '準備する'}
            </AppLink>
          </div>
        )}

        {ready && location.status !== 'success' && (
          <div className="mw-ar-state">
            <h2>観測する場所を確認</h2>
            <p>現在地が必要です</p>
            <button
              type="button"
              className="mw-primary"
              onClick={() => void requestLocation()}
            >
              現在地を取得
            </button>
            {recalibrationNotice}
          </div>
        )}

      </main>
    </SkyBackground>
  )
}
