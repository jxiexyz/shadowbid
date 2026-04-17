import React from 'react'
import { useCountdown } from '../hooks/useCountdown'

interface Props {
  endTime: string
  compact?: boolean
}

export default function CountdownTimer({ endTime, compact = false }: Props) {
  const { days, hours, minutes, seconds, expired, urgent } = useCountdown(endTime)

  if (expired) {
    return (
      <span className="text-[rgba(255,255,255,0.40)] text-xs font-mono">Auction ended</span>
    )
  }

  if (compact) {
    return (
      <span
        className={`font-mono text-sm font-semibold ${
          urgent ? 'text-[#ff6b6b] animate-pulse' : 'text-[var(--accent)]'
        }`}
      >
        {days > 0 && `${days}d `}
        {`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {days > 0 && (
        <TimeBlock value={days} label="days" urgent={urgent} />
      )}
      <TimeBlock value={hours} label="hrs" urgent={urgent} />
      <TimeBlock value={minutes} label="min" urgent={urgent} />
      <TimeBlock value={seconds} label="sec" urgent={urgent} />
    </div>
  )
}

function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-[2.5rem]">
      <span
        className={`font-mono text-2xl font-bold leading-none tabular-nums ${
          urgent ? 'text-[#ff6b6b]' : 'text-white'
        }`}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs text-[rgba(255,255,255,0.40)] mt-1">{label}</span>
    </div>
  )
}
