import { useCallback, useEffect, useRef, useState } from 'react'

/** โหลดข้อมูลแบบ async พร้อม loading / error / reload */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  const run = useCallback((silent = false) => {
    const id = ++seq.current
    if (!silent) setLoading(true)
    setError(null)
    return fn()
      .then((d) => { if (id === seq.current) setData(d) })
      .catch((e: Error) => { if (id === seq.current) setError(e.message) })
      .finally(() => { if (id === seq.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { run() }, [run])

  return { data, setData, error, loading, reload: run }
}
