// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PWAUpdateNotice } from './PWAUpdateNotice'
import type { UpdateSnapshot } from './serviceWorkerUpdates'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let snapshot: UpdateSnapshot
let listeners: Set<() => void>
const publish = (status: UpdateSnapshot['status']) => {
  snapshot = { status, error: null }
  for (const listener of listeners) listener()
}
const updates = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  observe: vi.fn(() => () => {}),
  apply: vi.fn(() => publish('updating')),
  defer: vi.fn(() => publish('deferred')),
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  snapshot = { status: 'available', error: null }
  listeners = new Set()
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})
async function show(pathname = '/') {
  await act(async () => root.render(<PWAUpdateNotice pathname={pathname} updates={updates} />))
}

it('presents an explicit update choice and explains that location and calibration will be reacquired', async () => {
  await show('/moon-info')
  expect(container.textContent).toContain('新しいバージョンを利用できます')
  expect(container.textContent).toContain('現在地と向きの設定は再取得・再調整')
  expect(updates.apply).not.toHaveBeenCalled()
  await act(async () => container.querySelector('button')!.click())
  expect(updates.apply).toHaveBeenCalledOnce()
  expect(container.textContent).toContain('更新しています')
  expect([...container.querySelectorAll('button')].every(button => button.disabled)).toBe(true)
})

it('hides a deferred update without requesting activation', async () => {
  await show()
  await act(async () => container.querySelectorAll('button')[1]!.click())
  expect(container.textContent).toBe('')
  expect(updates.defer).toHaveBeenCalledOnce()
  expect(updates.apply).not.toHaveBeenCalled()
})

it.each(['/ar', '/calibration', '/debug'])('defers presentation on %s and shows it on a suitable screen', async path => {
  await show(path)
  expect(container.textContent).toBe('')
  expect(updates.apply).not.toHaveBeenCalled()
  await show('/moon-info')
  expect(container.textContent).toContain('新しいバージョン')
})

it('shows activation errors with retry and defer controls', async () => {
  snapshot = { status: 'error', error: 'ほかのタブを閉じてください。' }
  await show()
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('ほかのタブ')
  expect([...container.querySelectorAll('button')].every(button => !button.disabled)).toBe(true)
})
