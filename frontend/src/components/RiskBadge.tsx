import React from 'react'
import { clsx } from 'clsx'
import type { RiskLevel, MLClassification } from '../types/api'

interface OperationalRiskBadgeProps {
  score?: number | null
  level?: RiskLevel | string | null
  showScore?: boolean
  className?: string
}

export const OperationalRiskBadge: React.FC<OperationalRiskBadgeProps> = ({
  score,
  level = 'LOW',
  showScore = true,
  className,
}) => {
  const normLevel = (level || 'LOW').toUpperCase()

  const levelStyles: Record<string, string> = {
    CRITICAL: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
    HIGH: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    MODERATE: 'bg-yellow-950/80 text-yellow-300 border-yellow-800/80',
    LOW: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
  }

  const badgeClass = levelStyles[normLevel] || levelStyles.LOW

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold tracking-wide font-mono',
        badgeClass,
        className,
      )}
      title="Operational Risk: Deterministic signal-weighted evaluation"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{normLevel}</span>
      {showScore && score !== undefined && score !== null && (
        <span className="opacity-80">({score}/100)</span>
      )}
    </span>
  )
}

interface MLAnomalyBadgeProps {
  classification?: MLClassification | string | null
  score?: number | null
  className?: string
}

export const MLAnomalyBadge: React.FC<MLAnomalyBadgeProps> = ({
  classification,
  score,
  className,
}) => {
  if (!classification) {
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-500 font-mono',
          className,
        )}
      >
        UNAVAILABLE
      </span>
    )
  }

  const normClass = classification.toUpperCase()

  const styles: Record<string, string> = {
    ANOMALOUS: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-800/80',
    ELEVATED: 'bg-violet-950/80 text-violet-300 border-violet-800/80',
    NORMAL: 'bg-slate-900 text-slate-400 border-slate-800',
  }

  const styleClass = styles[normClass] || styles.NORMAL

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold tracking-wide font-mono',
        styleClass,
        className,
      )}
      title="IsolationForest Behavioral Pipeline Anomaly (Statistical Execution Outlier; does not imply compromise or breach)"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{normClass}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-75">{score}%</span>
      )}
    </span>
  )
}
