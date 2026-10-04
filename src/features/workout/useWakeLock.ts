import { useEffect } from 'react'

/**
 * Keeps the screen awake while mounted. The lock is released by the browser
 * when the page is hidden, so it is requested again on return. Browsers without
 * the Screen Wake Lock API, or that refuse it, are silently left alone.
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release().catch(() => undefined)
        else sentinel = lock
      } catch {
        // Refused (e.g. low power mode): the workout works without it.
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void sentinel?.release().catch(() => undefined)
    }
  }, [])
}
