// ConfidenceMeter — displays real score from backend calculation
// score, label, trend all from /api/confidence or pipeline response
export default function ConfidenceMeter({ score, label, trend, completed, total }) {
  let scoreClass = ''
  if (score < 50) scoreClass = 'critical-score'
  else if (score < 70) scoreClass = 'at-risk'

  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'
  const trendText   = trend === 'up' ? 'improving' : trend === 'down' ? 'falling behind' : 'holding'

  return (
    <div className="conf-card">
      <div>
        <div className={`conf-score${scoreClass ? ' ' + scoreClass : ''}`}>
          {score}<span style={{ fontSize: 16, fontWeight: 500 }}>%</span>
        </div>
      </div>
      <div className="conf-label-group">
        <div className="conf-caption">{label || 'confidence'}</div>
        {trend && (
          <div className={`conf-trend ${trend}`}>
            {trendSymbol} {trendText}
          </div>
        )}
        {total > 0 && (
          <div style={{ fontSize: 11, color: 'var(--paper-faint)', marginTop: 2 }}>
            {completed}/{total} steps done
          </div>
        )}
      </div>
    </div>
  )
}
