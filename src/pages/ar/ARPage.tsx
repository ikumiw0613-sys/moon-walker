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
import '../../shared/styles/frontend.css'
import './ARPage.css'

export function ARPage({ navigate, state: location, requestLocation }: { navigate: Navigate } & GeolocationAccess) {
  const { now, moonPhase, moonPosition, timeMode, ready, needsRecalibration, isBelowHorizon, orientation, requestPermission, retryConnection, deviceState,
    guidance, isNear, isCentered, parallax, moonScreen, moonEdge, moonBehind, poseStability, isPoseChecking,
    motion, requestMotionPermission, canCheckMotion } = useARView(location)
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
            timeMode={timeMode} orientationStatus={orientation.status} poseStatus={poseStability.status}
            initialPlacement={projectionDebug.placement} /> : guidance && moonScreen && (
            <MoonSprite x={moonScreen.x} y={moonScreen.y} visible={moonScreen.visible} phase={moonPhase} />
          )}
          {guidance && moonEdge && (
            <div className="mw-ar-moon-marker" style={{ left: `${moonEdge.x * 100}%`, top: `${moonEdge.y * 100}%` }}>
              <span className="mw-ar-moon-thumbnail"><MoonDisc phase={moonPhase} /></span>
              <span>{moonBehind ? '反対側に月' : '画面外に月'}</span>
              <span className="mw-ar-moon-marker-arrow">{guidance.arrow}</span>
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
            <p className="mw-ar-guide-label">{isCentered ? 'リングの周辺の空を探してください' : 'スマホをゆっくり動かして'}</p>
            {moonEdge && <p className="mw-ar-visibility-note">{moonBehind ? '月はスマホの反対側にあります' : '月は画面の外にあります'}。矢印の方向へ向けてください。</p>}
            <div className="mw-ar-guidance-row">
              <span className="mw-ar-arrow" aria-hidden="true">
                {guidance.arrow}
              </span>
              <p className="mw-ar-message" role="status" aria-live="polite" aria-atomic="true">
                {isCentered ? 'このあたりに月があります' : guidance.message}
              </p>
            </div>
            <div className="mw-ar-guide-footer">
              <span className="mw-ar-distance">
                月まで
                <strong>
                  {guidance.angleToMoon.toFixed(1)}°
                </strong>
              </span>
              <AppLink to="/calibration" navigate={navigate} className="mw-ar-recalibrate">向きを調整</AppLink>
              {canCheckMotion && ['idle', 'denied', 'error'].includes(motion.status) && (
                <button type="button" className="mw-ar-motion-enable" onClick={() => void requestMotionPermission()}>
                  動きの補助確認を有効にする
                </button>
              )}
            </div>
          </section>
        )}

        {isBelowHorizon && !needsRecalibration && (
          <section className="mw-ar-state mw-ar-below-horizon" role="status" aria-labelledby="below-horizon-title">
            <h1 id="below-horizon-title">月は地平線の<br />下にあります</h1>
            <p>今は空に月を見ることができません。</p>
            <AppLink to="/moon-info" navigate={navigate} className="mw-primary">月の情報を見る</AppLink>
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
          </div>
        )}

        {(!isBelowHorizon || needsRecalibration) && !ready && (
          <div className="mw-ar-state">
            <h2>{needsRecalibration ? '向きを再確認してください' : 'まずは向きを合わせましょう'}</h2>
            <p>{needsRecalibration ? 'バックグラウンドから復帰したため、北補正をやり直してください。' : '月を探す準備ができていません'}</p>
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
          </div>
        )}

      </main>
    </SkyBackground>
  )
}
