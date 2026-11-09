// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocationState } from '../geolocation/types'
import { WeatherCard } from './WeatherCard'

const location: LocationState = { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 55, timestamp: 0 } }
const response = (weatherCode = 3) => new Response(JSON.stringify({
  current: { time: 1794207600, weather_code: weatherCode, cloud_cover: 86 },
}))
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => response())
  vi.stubGlobal('fetch', fetchMock)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function show(state: LocationState = location, fixedObservationTime = false) {
  await act(async () => root.render(<WeatherCard locationState={state} fixedObservationTime={fixedObservationTime} />))
}

describe('WeatherCard', () => {
  it('現在地が取得できるまで通信せず、取得後に現在の天気だけを表示する', async () => {
    await show({ status: 'idle' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('現在地を取得すると天気を表示します')
    await show()
    expect(container.textContent).toContain('曇り')
    expect(container.textContent).not.toContain('気温')
    expect(container.textContent).toContain('雲量 86%')
    expect(container.textContent).not.toContain('晴れ時々曇り')
    expect(container.querySelector('time')!.dateTime).toBe(new Date(1794207600 * 1000).toISOString())
    expect(container.querySelector('a')!.href).toBe('https://open-meteo.com/')
    await show(location, true)
    expect(container.textContent).toContain('天気はテスト日時ではなく、現在の情報です。')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('曇りを含むWMOコードも「晴れ」と簡潔に表示し、雲量を残す', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({
      current: { time: 1794207600, weather_code: 2, cloud_cover: 42 },
    })))
    await show()
    expect(container.querySelector('.mw-weather-condition')?.textContent).toBe('晴れ')
    expect(container.textContent).toContain('雲量 42%')
    expect(container.textContent).not.toContain('晴れ時々曇り')
  })

  it('通信失敗後にボタンから再取得できる', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await show()
    expect(container.textContent).toContain('天気を取得できませんでした')
    await act(async () => container.querySelector('button')!.click())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('曇り')
    expect(container.textContent).not.toContain('天気を取得できませんでした')
  })

  it('現在地が変わると古い通信を中止し、遅れた応答で新しい天気を上書きしない', async () => {
    let finishOld!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    await show()
    const oldSignal = fetchMock.mock.calls[0]![1]!.signal!
    expect(container.textContent).toContain('天気を取得しています')
    expect(container.querySelector('button')!.disabled).toBe(true)
    await show({ status: 'success', location: { latitude: 43, longitude: 141, accuracy: 20, timestamp: 0 } })
    expect(oldSignal.aborted).toBe(true)
    expect(new URL(String(fetchMock.mock.calls[1]![0])).searchParams.get('latitude')).toBe('43')
    await act(async () => finishOld(response(30)))
    expect(container.textContent).toContain('曇り')
    expect(container.textContent).not.toContain('快晴')
  })

  it('12秒でタイムアウトし、取得中の表示を解除する', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    await show()
    await act(async () => vi.advanceTimersByTimeAsync(12_000))
    expect(container.textContent).toContain('天気を取得できませんでした')
    expect(container.querySelector('button')!.disabled).toBe(false)
  })

  it('再描画ごとに取得せず15分ごとに更新し、現在地が失われたら古い天気を消す', async () => {
    vi.useFakeTimers()
    await show()
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    await show()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(15 * 60_000 - 10_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await show({ status: 'error', message: '位置情報を取得できません' })
    expect(container.textContent).not.toContain('曇り')
    await act(async () => vi.advanceTimersByTimeAsync(15 * 60_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
