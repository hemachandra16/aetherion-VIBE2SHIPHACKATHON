// BurnBar component — depleting timer from real deadline input
// Width calculated from real time_remaining vs total_time (both from user input / Gemini output)
export default function BurnBar({ timeRemainingMinutes, totalMinutes }) {
  if (!totalMinutes || totalMinutes <= 0) return null

  const fraction = Math.max(0, Math.min(1, timeRemainingMinutes / totalMinutes))
  const pct = Math.round(fraction * 100)
  const isCritical = fraction < 0.25

  const h = Math.floor(timeRemainingMinutes / 60)
  const m = Math.round(timeRemainingMinutes % 60)
  const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`

  return (
    <div className="burn-wrap">
      <div className="burn-meta">
        <span>Time remaining</span>
        <span className="burn-time">{timeLabel}</span>
      </div>
      <div className="burn-track">
        <div
          className={`burn-fill${isCritical ? ' critical' : ''}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${timeLabel} remaining`}
        />
      </div>
    </div>
  )
}
