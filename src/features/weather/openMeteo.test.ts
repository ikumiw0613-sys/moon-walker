import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeWeather, getCurrentWeather } from './openMeteo'

afterEach(() => vi.unstubAllGlobals())

describe('Open-Meteo current weather', () => {
  it('現在地の天気と雲量を要求し、対象時刻をUTCとして扱う', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      current: { time: 1794207600, weather_code: 3, cloud_cover: 86 },
    })))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const weather = await getCurrentWeather(35.68, 139.76, signal)
    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.origin).toBe('https://api.open-meteo.com')
    expect(url.searchParams.get('latitude')).toBe('35.68')
    expect(url.searchParams.get('longitude')).toBe('139.76')
    expect(url.searchParams.get('current')).toBe('weather_code,cloud_cover')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    expect(fetchMock.mock.calls[0]![1]).toEqual({ signal })
    expect(weather).toEqual({ time: new Date(1794207600 * 1000), weatherCode: 3, cloudCover: 86 })
  })

  it('天気コードと雲量の欠測値を0に変換しない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      current: { time: 1794207600, weather_code: null },
    }))))
    expect(await getCurrentWeather(35, 139, new AbortController().signal)).toMatchObject({ weatherCode: null, cloudCover: null })
    expect(describeWeather(null)).toBe('天気の情報なし')
    expect(describeWeather(999)).toBe('天気の情報なし')
    expect(describeWeather(95)).toBe('雷雨')
    expect(describeWeather(2)).toBe('晴れ')
    expect(describeWeather(3)).toBe('曇り')
    expect(describeWeather(61)).toBe('雨')
  })

  it.each([
    { status: 429, data: { error: true } },
    { status: 200, data: {} },
    { status: 200, data: { current: { time: null } } },
  ])('HTTPエラー・不正な応答を拒否する ($status / $data)', async ({ status, data }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status })))
    await expect(getCurrentWeather(35, 139, new AbortController().signal)).rejects.toThrow()
  })
})
