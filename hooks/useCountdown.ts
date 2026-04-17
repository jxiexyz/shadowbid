import { useState, useEffect } from 'react'

export interface CountdownResult {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
  expired: boolean
  urgent: boolean // < 1 hour remaining
}

export function useCountdown(endTime: string): CountdownResult {
  const calc = (): CountdownResult => {
    const total = Math.max(0, new Date(endTime).getTime() - Date.now())
    const days = Math.floor(total / (1000 * 60 * 60 * 24))
    const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((total % (1000 * 60)) / 1000)
    return {
      days,
      hours,
      minutes,
      seconds,
      total,
      expired: total === 0,
      urgent: total < 3_600_000 && total > 0,
    }
  }

  const [state, setState] = useState<CountdownResult>(calc)

  useEffect(() => {
    const id = setInterval(() => setState(calc()), 1000)
    return () => clearInterval(id)
  }, [endTime]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
