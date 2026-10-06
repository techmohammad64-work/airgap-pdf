// App-wide reactive status: connectivity and whether the app is cached for offline use.
import { registerSW } from 'virtual:pwa-register'

export const status = $state({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  offlineReady: false,
  updateAvailable: false,
})

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

export function initStatus() {
  addEventListener('online', () => (status.online = true))
  addEventListener('offline', () => (status.online = false))

  if (!('serviceWorker' in navigator)) return
  // Already controlled by our service worker: everything is precached.
  if (navigator.serviceWorker.controller) status.offlineReady = true
  applyUpdate = registerSW({
    immediate: true,
    onOfflineReady() {
      status.offlineReady = true
    },
    onNeedRefresh() {
      status.updateAvailable = true
    },
    onRegisteredSW(_url, reg) {
      if (reg?.active && navigator.serviceWorker.controller) status.offlineReady = true
    },
  })
}

export function reloadForUpdate() {
  applyUpdate?.(true)
}
