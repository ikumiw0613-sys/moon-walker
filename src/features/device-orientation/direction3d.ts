/** ENUでは +X=East、+Y=North、+Z=Up。端末では +X=右、+Y=上端、+Z=画面手前。 */
export type Vector3 = Readonly<{ x: number; y: number; z: number }>

/** 行優先の3×3行列。列ベクトルに左から掛ける。 */
export type RotationMatrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]

export type OrientationAngles = Readonly<{
  alpha: number | null
  beta: number | null
  gamma: number | null
}>

const DEG_TO_RAD = Math.PI / 180

/** 真北から東回りの方位角・地平線からの高度（度）をENU単位ベクトルへ変換する。 */
export function azimuthAltitudeToEnu(azimuth: number, altitude: number): Vector3 {
  if (!Number.isFinite(azimuth) || !Number.isFinite(altitude)) {
    throw new RangeError('方位角と高度は有限値である必要があります。')
  }
  if (altitude < -90 || altitude > 90) {
    throw new RangeError('高度は-90度から90度の範囲で指定してください。')
  }
  const a = azimuth * DEG_TO_RAD
  const h = altitude * DEG_TO_RAD
  return { x: Math.cos(h) * Math.sin(a), y: Math.cos(h) * Math.cos(a), z: Math.sin(h) }
}

/**
 * 端末座標→センサー基準座標の完全な回転を返す（角度入力は度）。
 * 右手系、内因性Z-X'-Y''回転: R = Rz(alpha) Rx(beta) Ry(gamma)。
 * deviceView.tsの背面方向は、この行列を (0, 0, -1) に掛けた結果に相当する。
 * 基準座標の軸をENUとして解釈できるのは、北基準が整合している場合だけ。
 * 相対イベントのalphaには真北基準の保証がなく、absoluteも真北補正を保証しない。
 * 欠測・非有限値はnull。天頂・天底でも回転全体は有効なので保持する。
 *
 * TODO: iOS webkitCompassHeading / webkitCompassAccuracyによる基準補正。
 * TODO: 磁気偏角、相対姿勢の手動校正を含む真北基準への整合。
 * TODO: screen.orientation.angleによる端末座標→表示座標の変換。
 * TODO: FOVと表示領域に基づく透視投影、カメラ映像との整合。
 * TODO: Quaternion等による姿勢の平滑化。
 */
export function deviceOrientationToRotationMatrix(
  { alpha, beta, gamma }: OrientationAngles,
): RotationMatrix3 | null {
  if (alpha === null || beta === null || gamma === null
    || ![alpha, beta, gamma].every(Number.isFinite)) return null

  const a = alpha * DEG_TO_RAD
  const b = beta * DEG_TO_RAD
  const g = gamma * DEG_TO_RAD
  const ca = Math.cos(a), sa = Math.sin(a)
  const cb = Math.cos(b), sb = Math.sin(b)
  const cg = Math.cos(g), sg = Math.sin(g)

  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ]
}

/**
 * 真北ENUと整合済みの端末→ENU回転行列の逆変換で、月の方向を端末座標へ移す。
 * 純粋な回転行列は逆行列=転置。生の相対／磁北姿勢との組み合わせは未校正となる。
 * 戻り値は表示座標ではない。背面カメラ前方は -Z（画面手前の +Z と逆）。
 */
export function enuToDevice(enu: Vector3, deviceToEnu: RotationMatrix3): Vector3 {
  return {
    x: deviceToEnu[0][0] * enu.x + deviceToEnu[1][0] * enu.y + deviceToEnu[2][0] * enu.z,
    y: deviceToEnu[0][1] * enu.x + deviceToEnu[1][1] * enu.y + deviceToEnu[2][1] * enu.z,
    z: deviceToEnu[0][2] * enu.x + deviceToEnu[1][2] * enu.y + deviceToEnu[2][2] * enu.z,
  }
}
