/** 画像と影が共通で使う座標。表示サイズを変えても中心と半径は変わらない。 */
export const MOON_DISC_GEOMETRY = {
  size: 100,
  centerX: 50,
  centerY: 50,
  radius: 50,
} as const

// public/moon-image.png の実寸と月の円盤の位置。
// アルファ値128以上の領域は (308, 288)〜(941, 917)。
// 淡い縁の影響を避け、この領域の中心と長い辺を円盤の中心・直径として使う。
const SOURCE_MOON_IMAGE = {
  width: 1254,
  height: 1254,
  centerX: 624.5,
  centerY: 602.5,
  diameter: 633,
} as const

const imageScale = MOON_DISC_GEOMETRY.size / SOURCE_MOON_IMAGE.diameter

/** 透明な余白を含む元画像を、共通座標の月の円盤に合わせる配置。 */
export const MOON_IMAGE_PLACEMENT = {
  x: MOON_DISC_GEOMETRY.centerX - SOURCE_MOON_IMAGE.centerX * imageScale,
  y: MOON_DISC_GEOMETRY.centerY - SOURCE_MOON_IMAGE.centerY * imageScale,
  width: SOURCE_MOON_IMAGE.width * imageScale,
  height: SOURCE_MOON_IMAGE.height * imageScale,
} as const
