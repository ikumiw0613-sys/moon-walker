// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createServiceWorkerUpdates, UPDATE_ACTIVATION_TIMEOUT_MS } from './serviceWorkerUpdates'

class WorkerDouble extends EventTarget {
  state: ServiceWorkerState
  postMessage = vi.fn()
  constructor(state: ServiceWorkerState) { super(); this.state = state }
  change(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event('statechange')) }
  asWorker() { return this as unknown as ServiceWorker }
}

const cleanups: (() => void)[] = []
function fixture({ firstInstall = false, waiting = true } = {}) {
  const previous = new WorkerDouble('activated')
  const candidate = new WorkerDouble(waiting ? 'installed' : 'installing')
  const container = Object.assign(new EventTarget(), { controller: firstInstall ? null : previous.asWorker() })
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? candidate.asWorker() : null,
    installing: waiting ? null : candidate.asWorker(),
    update: vi.fn().mockResolvedValue(undefined),
  })
  const reload = vi.fn()
  const updates = createServiceWorkerUpdates(() => container as unknown as ServiceWorkerContainer, reload)
  cleanups.push(updates.observe(registration as unknown as ServiceWorkerRegistration))
  const reply = (type: string) => container.dispatchEvent(new MessageEvent('message', {
    data: { type }, source: candidate.asWorker(),
  }))
  return { previous, candidate, container, registration, reload, updates, reply }
}

afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('offers an already waiting update without sending activation or reloading', () => {
  const { updates, candidate, reload } = fixture()
  expect(updates.getSnapshot().status).toBe('available')
  expect(candidate.postMessage).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

it('only offers a completed update and does not mistake first installation for an update', () => {
  const first = fixture({ firstInstall: true, waiting: false })
  first.candidate.change('installed')
  expect(first.updates.getSnapshot().status).toBe('idle')
  const update = fixture({ waiting: false })
  expect(update.updates.getSnapshot().status).toBe('idle')
  update.candidate.change('installed')
  expect(update.updates.getSnapshot().status).toBe('available')
})

it('does not offer an update whose asset installation failed', () => {
  const { updates, candidate } = fixture({ waiting: false })
  candidate.change('redundant')
  expect(updates.getSnapshot().status).toBe('idle')
})

it('defers the current update but offers a newer completed worker', () => {
  const { updates, registration, candidate, reload } = fixture()
  updates.defer()
  expect(updates.getSnapshot().status).toBe('deferred')
  candidate.change('installed')
  expect(updates.getSnapshot().status).toBe('deferred')
  const newer = new WorkerDouble('installing')
  registration.installing = newer.asWorker()
  registration.dispatchEvent(new Event('updatefound'))
  newer.change('installed')
  expect(updates.getSnapshot().status).toBe('available')
  expect(reload).not.toHaveBeenCalled()
})

it('activates only on apply and reloads once after the controller actually changes', () => {
  const { updates, candidate, container, reload } = fixture()
  updates.apply()
  updates.apply()
  expect(updates.getSnapshot().status).toBe('updating')
  expect(candidate.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'ACTIVATE_UPDATE' })
  expect(reload).not.toHaveBeenCalled()
  container.dispatchEvent(new Event('controllerchange'))
  expect(reload).not.toHaveBeenCalled()
  container.controller = candidate.asWorker()
  container.dispatchEvent(new Event('controllerchange'))
  container.dispatchEvent(new Event('controllerchange'))
  expect(reload).toHaveBeenCalledOnce()
})

it('never reloads for a controller change without this page requesting an update', () => {
  const { candidate, container, reload } = fixture()
  container.controller = candidate.asWorker()
  container.dispatchEvent(new Event('controllerchange'))
  expect(reload).not.toHaveBeenCalled()
})

it('explains other open sessions and permits retry after they are closed', () => {
  const { updates, reply, candidate, container, reload } = fixture()
  updates.apply()
  reply('UPDATE_BLOCKED')
  expect(updates.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('ほかのタブ') })
  expect(reload).not.toHaveBeenCalled()
  updates.apply()
  container.controller = candidate.asWorker()
  container.dispatchEvent(new Event('controllerchange'))
  expect(reload).toHaveBeenCalledOnce()
})

it('reports a worker activation error and a timeout without reloading', () => {
  vi.useFakeTimers()
  const { updates, reply, reload } = fixture()
  updates.apply()
  reply('UPDATE_FAILED')
  expect(updates.getSnapshot().status).toBe('error')
  updates.apply()
  vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS)
  expect(updates.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('切り替え') })
  expect(reload).not.toHaveBeenCalled()
})

it('handles an already activated worker only when the user clicks update', () => {
  const { updates, candidate, reload } = fixture()
  candidate.change('activated')
  expect(reload).not.toHaveBeenCalled()
  updates.apply()
  expect(reload).toHaveBeenCalledOnce()
})

it('checks again on foreground/online events and contains update-check errors', async () => {
  const { registration } = fixture()
  registration.update.mockRejectedValue(new Error('Offline'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  window.dispatchEvent(new Event('online'))
  document.dispatchEvent(new Event('visibilitychange'))
  await Promise.resolve()
  expect(registration.update).toHaveBeenCalledTimes(2)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  window.dispatchEvent(new Event('online'))
  expect(registration.update).toHaveBeenCalledTimes(2)
})
