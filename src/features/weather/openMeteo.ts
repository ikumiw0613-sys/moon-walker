export type CurrentWeather = {
  time: Date
  weatherCode: number | null
  cloudCover: number | null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function getCurrentWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<CurrentWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: 'weather_code,cloud_cover', timeformat: 'unixtime',
  }).toString()
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('天気を取得できませんでした。通信状態を確認して再取得してください。')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('current' in data)
    || !data.current || typeof data.current !== 'object') {
    throw new Error('天気データを読み取れませんでした。しばらくしてから再取得してください。')
  }
  const current = data.current as Record<string, unknown>
  const time = finiteNumber(current.time)
  if (time === null || !Number.isFinite(new Date(time * 1000).getTime())) {
    throw new Error('天気の対象時刻を読み取れませんでした。再取得してください。')
  }
  const cloudCover = finiteNumber(current.cloud_cover)
  return {
    time: new Date(time * 1000),
    weatherCode: finiteNumber(current.weather_code),
    cloudCover: cloudCover !== null && cloudCover >= 0 && cloudCover <= 100 ? cloudCover : null,
  }
}

// WMO interpretation codes: https://open-meteo.com/en/docs
export function describeWeather(code: number | null): string {
  if (code === null) return '天気の情報なし'
  if (code >= 0 && code <= 2) return '晴れ'
  if (code === 3) return '曇り'
  if (code === 45 || code === 48) return '霧'
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return '雨'
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return '雪'
  if (code >= 95 && code <= 99) return '雷雨'
  return '天気の情報なし'
}
