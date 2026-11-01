import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  badge?: {
    text: string
    variant?: 'neutral' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet'
  }
  loading?: boolean
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  loading = false,
  className,
}) => {
  const badgeClasses = {
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    rose: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    cyan: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
    violet: 'bg-violet-950/60 text-violet-400 border-violet-800/60',
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-slate-800 bg-[#0d131f]/90 p-5 shadow-lg backdrop-blur-md transition-all hover:border-slate-700/80',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className="rounded-lg bg-slate-800/60 p-2 text-slate-300 border border-slate-700/50">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-slate-800" />
        ) : (
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        )}

        {badge && !loading && (
          <span
            className={clsx(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
              badgeClasses[badge.variant || 'neutral'],
            )}
          >
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs text-slate-400 line-clamp-1">
          {subtitle}
        </div>
      )}
    </div>
  )
}
