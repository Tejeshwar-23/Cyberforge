import React, { useEffect, useState, useMemo } from 'react'
import {
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ChevronRight,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { TimelineStepper } from '../components/TimelineStepper'
import type {
  ConnectorRunItem,
  ConnectorRunTimelineResponse,
} from '../types/api'

export const RunHistoryPage: React.FC = () => {
  const [runs, setRuns] = useState<ConnectorRunItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(50)

  // Client-side filtering on returned runs
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Timeline Inspection Modal
  const [selectedRun, setSelectedRun] = useState<ConnectorRunItem | null>(null)
  const [timeline, setTimeline] = useState<ConnectorRunTimelineResponse | null>(null)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [timelineError, setTimelineError] = useState('')

  const loadRuns = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await CyberForgeApi.getRuns(limit)
      setRuns(data)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const matchesSearch =
        r.connector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.run_id.toString().includes(searchTerm)
      const matchesStatus =
        !statusFilter || r.status.toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [runs, searchTerm, statusFilter])

  const handleOpenTimeline = async (run: ConnectorRunItem) => {
    setSelectedRun(run)
    setTimeline(null)
    setTimelineError('')
    setLoadingTimeline(true)
    try {
      const tl = await CyberForgeApi.getRunTimeline(run.run_id)
      setTimeline(tl)
    } catch (err) {
      setTimelineError(readableApiError(err))
    } finally {
      setLoadingTimeline(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Operations Audit
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Run History
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-400" />
            <span>Execution Run History</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Historical audit log of all scheduled and manual connector execution runs with verified stage milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadRuns()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md font-mono text-xs">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search run ID or connector name..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Client status filter */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[10px] text-amber-400/80 uppercase font-semibold">[Filtering this page] Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Runs</option>
              <option value="healthy">Healthy Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Limit (Server):</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <span className="text-slate-500">
            {filteredRuns.length} of {runs.length} loaded runs
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Runs Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Run ID</th>
                <th className="px-4 py-3">Connector Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Extracted</th>
                <th className="px-4 py-3">Ingested</th>
                <th className="px-4 py-3">Quarantined</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Started At</th>
                <th className="px-4 py-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No run records found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((r) => (
                  <tr
                    key={r.run_id}
                    onClick={() => void handleOpenTimeline(r)}
                    className="hover:bg-slate-900/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-bold text-white group-hover:text-blue-300">
                      #{r.run_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {r.connector}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.status === 'healthy' || r.status === 'success'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {r.status === 'healthy' || r.status === 'success' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.records_received}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">
                      {r.records_normalized}
                    </td>
                    <td className="px-4 py-3">
                      {r.records_quarantined > 0 ? (
                        <span className="font-bold text-amber-400">
                          {r.records_quarantined}
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.started_at && r.completed_at ? `${Math.max(0, Math.round(new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()))} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 group-hover:text-blue-300">
                        <span>Timeline</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Timeline Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl max-h-[90vh] overflow-y-auto font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Run #{selectedRun.run_id} — {selectedRun.connector}
                  </h3>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      selectedRun.status === 'healthy' || selectedRun.status === 'success'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {selectedRun.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Started: {selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleString() : 'N/A'} · Duration: {selectedRun.started_at && selectedRun.completed_at ? `${Math.max(0, Math.round(new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime()))} ms` : 'N/A'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Run summary grid */}
            <div className="grid grid-cols-3 gap-3 rounded bg-slate-900/60 p-3 border border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-500">Records Extracted:</span>
                <div className="text-white font-bold">{selectedRun.records_received}</div>
              </div>
              <div>
                <span className="text-slate-500">Records Ingested:</span>
                <div className="text-emerald-400 font-bold">{selectedRun.records_normalized}</div>
              </div>
              <div>
                <span className="text-slate-500">Quarantined Records:</span>
                <div className="text-amber-400 font-bold">{selectedRun.records_quarantined}</div>
              </div>
            </div>

            {/* Error detail if any */}
            {selectedRun.error_type && (
              <div className="rounded border border-rose-800/80 bg-rose-950/20 p-3 text-[11px] text-rose-300">
                <span className="font-bold">Error Type:</span> {selectedRun.error_type}
                {selectedRun.last_error && (
                  <p className="mt-1 text-rose-400">{selectedRun.last_error}</p>
                )}
              </div>
            )}

            {/* Timeline Stepper */}
            {loadingTimeline ? (
              <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                <span>Loading execution timeline milestones...</span>
              </div>
            ) : timelineError ? (
              <div className="rounded border border-rose-800 bg-rose-950/20 p-3 text-rose-300">
                Failed to load timeline: {timelineError}
              </div>
            ) : timeline ? (
              <TimelineStepper
                timeline={timeline}
                title="Execution Timeline"
                subtitle="Stage-level verification returned by generic connector engine"
              />
            ) : null}

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="rounded border border-slate-800 bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
