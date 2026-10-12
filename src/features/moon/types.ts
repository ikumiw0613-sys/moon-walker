export type MoonPosition = {
  azimuth:number
  altitude: number
  isAboveHorizon: boolean
}

/** 指定した観測時刻の、地球の中心を基準とした月相情報。 */
export type MoonPhaseInfo = {
  /** 直前の新月からの経過日数。表示用の丸めは行わない。 */
  ageDays: number
  /** 太陽と月の黄経差。0°以上360°未満で、新月は0°、満月は180°。 */
  cycleAngle: number
  /** 見えている月の円盤のうち、太陽に照らされている割合。0以上1以下。 */
  illuminatedFraction: number
}
