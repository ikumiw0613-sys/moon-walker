// MapFan「東京スカイツリー」の世界測地系の施設代表座標。
// https://mapfan.com/spots/SCCC5,J,YT （2026-10-05確認）
// 方位検証用の地上位置。塔頂の高度や敷地境界を表すものではない。
export const TOKYO_SKYTREE = {
  latitude: 35.7100152,
  longitude: 139.8107594,
} as const

// Debug only. Sky-Go-LAND (new Ferris wheel), not the retired 大観覧車.
// Facility-supervised page's geographic/map pin, checked 2026-11-08:
// https://www.gltjp.com/en/directory/item/19105/
// Official identification: https://www.yomiuriland.com/attraction/sky-go-land/
// A map representative point, not a surveyed axle coordinate. Aim at the fixed
// wheel centre, not a moving gondola. Replace this one constant if surveyed.
export const YOMIURILAND_REFERENCE = {
  name: 'よみうりランド Sky-Go-LAND（観覧車中心）',
  latitude: 35.6257422,
  longitude: 139.5167327,
  sourceUrl: 'https://www.gltjp.com/en/directory/item/19105/',
} as const
