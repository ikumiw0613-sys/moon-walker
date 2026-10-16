import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { NorthCalibration } from './horizontalCalibration'
import { NorthCalibrationContext } from './NorthCalibrationContext'

export function NorthCalibrationProvider({ children }: { children: ReactNode }) {
  // 画面遷移では保持するが、バックグラウンド移行時には古い方位基準を無効にする。
  const [state, setState] = useState<{ calibration: NorthCalibration | null; needsRecalibration: boolean }>({ calibration: null, needsRecalibration: false })
  const { calibration, needsRecalibration } = state
  const saveNorthCalibration = useCallback((value: NorthCalibration) => {
    if (document.visibilityState === 'hidden') return
    setState({ calibration: value, needsRecalibration: false })
  }, [])

  useEffect(() => {
    const invalidate = () => setState(previous => previous.calibration
      ? { calibration: null, needsRecalibration: true }
      : previous)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') invalidate()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // ページキャッシュから戻る場合も、保存前の補正を使い続けない。
    window.addEventListener('pagehide', invalidate)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', invalidate)
    }
  }, [])

  return (
    <NorthCalibrationContext.Provider value={{
      northCorrection: calibration?.northCorrection ?? null,
      calibrated: calibration !== null,
      calibratedAt: calibration?.calibratedAt ?? null,
      needsRecalibration,
      saveNorthCalibration,
    }}>
      {children}
    </NorthCalibrationContext.Provider>
  )
}

