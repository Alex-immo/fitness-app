import { liveQuery } from 'dexie'
import { useEffect, useState, type DependencyList } from 'react'

/**
 * Runs a Dexie query and re-runs it whenever the data it read changes.
 * Returns undefined until the first result is in.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [result, setResult] = useState<{ value: T } | undefined>(undefined)
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setResult({ value }),
      error: (error) => console.error(error),
    })
    return () => subscription.unsubscribe()
    // The caller lists what the query depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return result?.value
}
