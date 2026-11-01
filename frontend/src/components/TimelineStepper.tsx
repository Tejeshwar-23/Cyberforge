import React, { useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { clsx } from 'clsx'
import type { ConnectorRunEventItem, ConnectorRunTimelineResponse } from '../types/api'

interface TimelineStepperProps {
  events?: (ConnectorRunEventItem | { stage: string; status: string; message?: string | null; details?: unknown; occurred_at?: string })[]
  timeline?: ConnectorRunTimelineResponse | null
  title?: string
  subtitle?: string
  className?: string
}

export const TimelineStepper: React.FC<TimelineStepperProps> = ({
  events: propEvents,
  timeline,
  title = 'Execution Timeline',
  subtitle = 'Persisted stage-level milestones from connector run',
  className,
}) => {
  const events = propEvents || timeline?.events || []
  const [expandedId, setExpandedId] = useState<number | string | null>(null)

  const toggleExpand = (id: number | string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-400 animate-spin" />
      case 'error':
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-rose-400" />
      default:
        return <Layers className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusLineClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-emerald-600/40'
      case 'error':
      case 'failed':
        return 'bg-rose-600/40'
      default:
        return 'bg-slate-700/60'
    }
  }

  if (!events || events.length === 0) {
    return (
      <div className={clsx('rounded-xl border border-slate-800 bg-[#0b0f19] p-6 text-center', className)}>
        <Layers className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-2 text-sm text-slate-400">No milestone events recorded for this execution.</p>
      </div>
    )
  }

  return (
    <div className={clsx('rounded-xl border border-slate-800 bg-[#0b0f19] p-5 shadow-lg', className)}>
      <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-white font-mono">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400 border border-slate-700">
          {events.length} milestones
        </span>
      </div>

      <div className="relative space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {events.map((event, idx) => {
          const eventKey = ('event_id' in event && typeof event.event_id === 'number') ? event.event_id : idx
          const isExpanded = expandedId === eventKey
          const hasDetails = Boolean(event.details && typeof event.details === 'object' && Object.keys(event.details).length > 0)

          return (
            <div key={eventKey} className="relative flex items-start gap-3 pl-1">
              <div
                className={clsx(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-[#0d131f] shadow',
                  getStatusLineClass(event.status),
                )}
              >
                {getStatusIcon(event.status)}
              </div>

              <div className="flex-1 rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 text-xs transition-colors hover:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tracking-wide text-slate-200">
                      {event.stage}
                    </span>
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase',
                        event.status.toLowerCase() === 'success'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : event.status.toLowerCase() === 'error' || event.status.toLowerCase() === 'failed'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            : 'bg-slate-800 text-slate-400',
                      )}
                    >
                      {event.status}
                    </span>
                  </div>

                  {event.occurred_at && (
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(event.occurred_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {event.message && (
                  <p className="mt-1 text-slate-300 leading-relaxed font-sans">{event.message}</p>
                )}

                {hasDetails && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(eventKey)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span>{isExpanded ? 'Hide Details' : 'Inspect Details'}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 overflow-x-auto rounded border border-slate-800 bg-[#060910] p-2.5 font-mono text-[11px] text-slate-300 max-h-48">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
