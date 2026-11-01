import React, { useEffect, useState } from 'react'
import {
  Activity,
  Play,
  RefreshCw,
  CheckCircle2,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { TimelineStepper } from '../components/TimelineStepper'
import type {
  InstalledConnectorMetadata,
  ConnectorRunResult,
  ConnectorRunTimelineResponse,
} from '../types/api'

export const LiveRunsPage: React.FC = () => {
  const { user } = useAuth()
  const [connectors, setConnectors] = useState<InstalledConnectorMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Running state
  const [activeRunningName, setActiveRunningName] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<ConnectorRunResult | null>(null)
  const [runTimeline, setRunTimeline] = useState<ConnectorRunTimelineResponse | null>(null)
  const [runError, setRunError] = useState<string>('')

  const loadConnectors = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await CyberForgeApi.getInstalledConfigs()
      setConnectors(data)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConnectors()
  }, [])

  const handleTriggerRun = async (connectorName: string) => {
    if (user?.role === 'viewer') return
    setActiveRunningName(connectorName)
    setRunError('')
    setRunResult(null)
    setRunTimeline(null)

    try {
      const res = await CyberForgeApi.runNow(connectorName)
      setRunResult(res)
      if (res.run_id) {
        const timeline = await CyberForgeApi.getRunTimeline(res.run_id)
        setRunTimeline(timeline)
      }
    } catch (err) {
      setRunError(readableApiError(err))
    } finally {
      setActiveRunningName(null)
    }
  }

  const enabledConnectors = connectors.filter((c) => c.enabled)
  const disabledConnectors = connectors.filter((c) => !c.enabled)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Operations Control
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              On-Demand Dispatcher
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-400" />
            <span>Live Connector Execution</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Dispatch ad-hoc pipeline synchronizations and observe the verified 7-stage execution lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/operations/history"
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800"
          >
            Review Run History →
          </Link>
          <button
            type="button"
            onClick={() => void loadConnectors()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Run Execution Result Card */}
      {(activeRunningName || runResult || runError) && (
        <div className="rounded-xl border border-blue-900/60 bg-[#0a101d] p-5 shadow-2xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${activeRunningName ? 'text-blue-400 animate-spin' : 'text-emerald-400'}`} />
              <h2 className="text-sm font-bold text-white">
                {activeRunningName ? `Executing Connector: ${activeRunningName}` : `Run Completed: #${runResult?.run_id}`}
              </h2>
            </div>
            {runResult && (
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  runResult.status === 'success'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {runResult.status}
              </span>
            )}
          </div>

          {activeRunningName && (
            <div className="text-xs text-blue-300 flex items-center gap-2 py-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Generic connector engine is executing extraction, parsing, mapping, quarantine, and persistence...</span>
            </div>
          )}

          {runError && (
            <div className="rounded border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-300">
              Run failed: {runError}
            </div>
          )}

          {runResult && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded bg-slate-900/80 p-3 text-xs">
              <div>
                <span className="text-slate-500 text-[10px]">Records Received:</span>
                <div className="text-white font-bold">{runResult.records_received}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Records Normalized:</span>
                <div className="text-emerald-400 font-bold">{runResult.records_normalized}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Quarantined:</span>
                <div className="text-amber-400 font-bold">{runResult.records_quarantined}</div>
              </div>
            </div>
          )}

          {runTimeline && (
            <div className="pt-2">
              <TimelineStepper
                timeline={runTimeline}
                title="Execution Timeline"
                subtitle="Milestone verification across the 7 pipeline lifecycle stages"
              />
            </div>
          )}
        </div>
      )}

      {/* Active Connectors Dispatch Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Active / Enabled Connectors ({enabledConnectors.length})</span>
        </h2>
        <p className="text-xs text-slate-400 font-mono">
          These connectors are enabled and ready for immediate manual invocation. Background schedule registration takes effect after service reload.
        </p>

        {loading ? (
          <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-[#0d131f]" />
        ) : enabledConnectors.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-8 text-center text-xs font-mono text-slate-500">
            No connectors are currently active. Activate a connector from Configured Connectors to run it here.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enabledConnectors.map((c) => (
              <div
                key={c.connector}
                className="rounded-xl border border-emerald-900/50 bg-[#0a1318] p-4 font-mono shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{c.connector}</span>
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      Active
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <div>Entity: <strong className="text-slate-200 capitalize">{c.entity}</strong></div>
                    <div>Interval: Every {c.schedule_every_minutes} min</div>
                    <div>File: {c.config_file}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                  {user?.role === 'viewer' ? (
                    <span className="text-[10px] text-slate-500">Read-only role</span>
                  ) : (
                    <button
                      type="button"
                      disabled={activeRunningName === c.connector}
                      onClick={() => void handleTriggerRun(c.connector)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-all shadow-md"
                    >
                      <Play className="h-3 w-3" />
                      <span>{activeRunningName === c.connector ? 'Running...' : 'Run Now'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disabled Connectors List (Read-only quick-run for testing) */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-400 font-mono flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-500" />
          <span>Disabled / Inactive Connectors ({disabledConnectors.length})</span>
        </h2>
        <p className="text-xs text-slate-500 font-mono">
          Connectors in safe disabled state. Operators and Admins can still trigger a manual run to test ingestion.
        </p>

        <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
            {disabledConnectors.slice(0, 10).map((c) => (
              <div key={c.connector} className="flex items-center justify-between p-3 hover:bg-slate-900/40">
                <div>
                  <span className="text-slate-300 font-semibold">{c.connector}</span>
                  <span className="ml-2 text-[10px] text-slate-500 uppercase">{c.entity} • {c.config_file}</span>
                </div>
                {user?.role !== 'viewer' && (
                  <button
                    type="button"
                    disabled={activeRunningName === c.connector}
                    onClick={() => void handleTriggerRun(c.connector)}
                    className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Run Test
                  </button>
                )}
              </div>
            ))}
          </div>
          {disabledConnectors.length > 10 && (
            <div className="p-2 text-center text-[11px] font-mono text-slate-500 bg-slate-900/60 border-t border-slate-800">
              Showing 10 of {disabledConnectors.length} disabled connectors. Browse full catalog under Configured Connectors.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
