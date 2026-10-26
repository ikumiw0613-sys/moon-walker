export type UpdateStatus = 'idle' | 'available' | 'deferred' | 'updating' | 'error'
export type UpdateSnapshot = { status: UpdateStatus; error: string | null }
export const INITIAL_UPDATE_SNAPSHOT: UpdateSnapshot = { status: 'idle', error: null }
export const UPDATE_ACTIVATION_TIMEOUT_MS = 12000

/** Observe browser lifecycle events; activation and reload require an explicit apply() call. */
export function createServiceWorkerUpdates(getContainer: () => ServiceWorkerContainer, reload: () => void) {
  let snapshot = INITIAL_UPDATE_SNAPSHOT
  let waitingWorker: ServiceWorker | null = null
  let cleanupActivation: (() => void) | null = null
  const listeners = new Set<() => void>()
  const publish = (status: UpdateStatus, error: string | null = null) => {
    snapshot = { status, error }
    for (const listener of listeners) listener()
  }

  function observe(registration: ServiceWorkerRegistration) {
    const tracked = new WeakSet<ServiceWorker>()
    const cleanup: (() => void)[] = []
    const offer = (worker: ServiceWorker) => {
      if (!getContainer().controller || snapshot.status === 'updating' || waitingWorker === worker) return
      waitingWorker = worker
      publish('available')
    }
    const track = (worker: ServiceWorker | null) => {
      if (!worker || tracked.has(worker)) return
      tracked.add(worker)
      const changed = () => {
        if (worker.state === 'installed') offer(worker)
        else if (worker.state === 'redundant' && waitingWorker === worker && snapshot.status !== 'updating') {
          waitingWorker = null
          publish('idle')
        }
      }
      worker.addEventListener('statechange', changed)
      cleanup.push(() => worker.removeEventListener('statechange', changed))
      changed()
    }
    const updateFound = () => track(registration.installing)
    const checkForUpdates = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false || registration.installing) return
      // Offline/update-check failures leave the current saved version usable.
      void registration.update().catch(() => {})
    }
    registration.addEventListener('updatefound', updateFound)
    window.addEventListener('online', checkForUpdates)
    document.addEventListener('visibilitychange', checkForUpdates)
    track(registration.installing)
    track(registration.waiting)
    return () => {
      registration.removeEventListener('updatefound', updateFound)
      window.removeEventListener('online', checkForUpdates)
      document.removeEventListener('visibilitychange', checkForUpdates)
      for (const dispose of cleanup) dispose()
    }
  }

  function apply() {
    if (snapshot.status === 'updating') return
    const worker = waitingWorker
    if (!worker || !['installed', 'activated'].includes(worker.state)) {
      publish('error', '更新の準備を確認できません。アプリを開き直してください。')
      return
    }
    publish('updating')
    // A worker may have activated naturally while the user read the notice.
    if (worker.state === 'activated') { reload(); return }

    const container = getContainer()
    const previousController = container.controller
    const fail = (message: string) => {
      cleanupActivation?.()
      publish('error', message)
    }
    const changed = () => {
      if (!container.controller || container.controller === previousController) return
      cleanupActivation?.()
      reload()
    }
    const message = (event: MessageEvent) => {
      if (event.source !== worker) return
      if (event.data?.type === 'UPDATE_BLOCKED') {
        fail('ほかのタブやウィンドウのmoon-walkerを閉じてから、もう一度更新してください。')
      } else if (event.data?.type === 'UPDATE_FAILED') {
        fail('更新できませんでした。もう一度お試しください。')
      }
    }
    const timeout = setTimeout(() => fail('更新の切り替えを確認できません。もう一度お試しください。'), UPDATE_ACTIVATION_TIMEOUT_MS)
    cleanupActivation = () => {
      clearTimeout(timeout)
      container.removeEventListener('controllerchange', changed)
      container.removeEventListener('message', message)
      cleanupActivation = null
    }
    container.addEventListener('controllerchange', changed)
    container.addEventListener('message', message)
    try { worker.postMessage({ type: 'ACTIVATE_UPDATE' }) }
    catch { fail('更新できませんでした。もう一度お試しください。') }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    observe,
    apply,
    defer: () => { if (snapshot.status !== 'updating') publish('deferred') },
  }
}

// These callbacks access browser APIs only when registration/interaction starts.
export const serviceWorkerUpdates = createServiceWorkerUpdates(
  () => navigator.serviceWorker,
  () => window.location.reload(),
)
