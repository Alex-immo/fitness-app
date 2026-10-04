// Manual update check for the installed app. The service worker also updates
// by itself; this only saves closing and reopening the app.

export type UpdateResult = 'updated' | 'current' | 'unavailable'

const ACTIVATION_TIMEOUT_MS = 15_000

function activated(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    if (worker.state === 'activated') return resolve(true)
    const timeout = window.setTimeout(() => resolve(false), ACTIVATION_TIMEOUT_MS)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        window.clearTimeout(timeout)
        resolve(true)
      } else if (worker.state === 'redundant') {
        window.clearTimeout(timeout)
        resolve(false)
      }
    })
  })
}

/**
 * Asks the server for a new version. "updated" means a new version is active
 * and the page should be reloaded; "unavailable" means the check itself failed
 * (offline, or no service worker as in the dev server).
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (!registration) return 'unavailable'
    await registration.update()
    const incoming = registration.installing ?? registration.waiting
    if (!incoming) return 'current'
    return (await activated(incoming)) ? 'updated' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}
