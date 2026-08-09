import { useState, useEffect } from 'react'

/** Current HKT date, ticked every 60 seconds on the client.
 *  On first render returns server time; hydrates on mount. */
export function useHktNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  return now
}

/** HKT time string (HH:MM) from a Date, usable server-side too. */
export function hktHHMM(d: Date): string {
  const hh = String((d.getUTCHours() + 8) % 24).padStart(2, '0')  // HKT = UTC+8
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
