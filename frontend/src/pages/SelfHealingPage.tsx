import React, { useEffect, useState, useCallback } from 'react'
import {
  Wrench,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  History,
  Eye,
  X,
  ShieldCheck,
  Undo2,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type {
  SelfHealSummaryResponse,
  SelfHealHistoryResponse,
  SelfHealAuditItem,
} from '../types/api'

export const SelfHealingPage: React.FC = () => {
  const [summary, setSummary] = useState<SelfHealSummaryResponse | null>(null)
  const [history, setHistory] = useState<SelfHealHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter params
  const [outcomeFilter, setOutcomeFilter] = useState<string>('')
  const [limit, setLimit] = useState(25)

  // Audit item modal
  const [selectedAudit, setSelectedAudit] = useState<SelfHealAuditItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sumRes, histRes] = await Promise.all([
        CyberForgeApi.getSelfHealSummary(),
        CyberForgeApi.getSelfHealHistory({
          outcome: outcomeFilter || undefined,
          limit,
        }),
      ])
      setSummary(sumRes)
      setHistory(histRes)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }, [outcomeFilter, limit])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const audits = history?.items || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">
              Heuristic Resilience
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Deterministic Rule Repair
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Wrench className="h-6 w-6 text-emerald-400" />
            <span>Conservative Heuristic Self-Healing</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Autonomous rule-based field mapping drift repair. Synthesizes candidates in memory, verifies via dry-run, and persists or rolls back.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scope Disclaimer Box */}
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-emerald-200 font-mono text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Heuristic Self-Healing Architecture (Non-ML Rule-Based Recovery)</span>
        </div>
        <p className="text-[11px] text-emerald-300/80">
          The self-healing subsystem detects low-risk vendor schema drift (e.g. field renaming, casing variations, nested aliases). It synthesizes an updated mapping candidate in a sandbox, executes an isolated verification dry-run, and automatically rolls back to the backup configuration if validation fails. Credentials, authentication mechanisms, permissions, and endpoint domains are never automatically modified.
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4 font-mono">
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Total Audits</span>
            <div className="mt-1 text-3xl font-bold text-white">{summary.audit_events}</div>
            <p className="text-[10px] text-slate-500 mt-2">Recorded drift events</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Repairs Applied</span>
            <div className="mt-1 text-3xl font-bold text-emerald-400">{summary.applied}</div>
            <p className="text-[10px] text-slate-500 mt-2">Candidate repairs mapped</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Verified Runs</span>
            <div className="mt-1 text-3xl font-bold text-blue-400">{summary.verified}</div>
            <p className="text-[10px] text-slate-500 mt-2">Passed full rerun verification</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Automated Rollbacks</span>
            <div className="mt-1 text-3xl font-bold text-amber-400">{summary.rolled_back}</div>
            <p className="text-[10px] text-slate-500 mt-2">Reverted upon verification failure</p>
          </div>
        </div>
      )}

      {/* Query Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md font-mono text-xs">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-white">Self-Healing Audit Trail</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Outcome (Server):</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Outcomes</option>
              <option value="applied">Applied</option>
              <option value="verified">Verified</option>
              <option value="rolled_back">Rolled Back</option>
              <option value="not_applied">Not Applied</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Limit:</span>
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
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Audit ID</th>
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Drift Mapping Change</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Occurred At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No self-healing audit incidents found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                audits.map((a) => (
                  <tr key={a.audit_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      #{a.audit_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {a.connector || 'Platform Engine'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate text-[11px]">
                      {a.old_source_path && a.new_source_path ? (
                        <span className="font-mono text-blue-300">
                          {a.old_source_path} → {a.new_source_path}
                        </span>
                      ) : (
                        a.message
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          a.outcome === 'verified' || a.outcome === 'applied'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : a.outcome === 'rolled_back'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {a.outcome === 'verified' || a.outcome === 'applied' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                        <span>{a.outcome}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {a.risk_level || 'LOW'}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {a.occurred_at ? new Date(a.occurred_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAudit(a)}
                        className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Audit Detail Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl max-h-[85vh] flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-400" />
                  <span>Self-Healing Audit Record #{selectedAudit.audit_id}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Connector: <strong className="text-slate-300">{selectedAudit.connector || 'N/A'}</strong> · Outcome: {selectedAudit.outcome.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4">
              <div className="rounded bg-slate-900/60 border border-slate-800 p-3 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500 font-bold uppercase">Audit Message:</span>
                  <div className="text-slate-200 mt-0.5">{selectedAudit.message}</div>
                </div>
                {selectedAudit.old_source_path && selectedAudit.new_source_path && (
                  <div>
                    <span className="text-slate-500 font-bold uppercase">Drift Path Mutation:</span>
                    <div className="text-emerald-400 mt-0.5 font-bold">
                      {selectedAudit.old_source_path} → {selectedAudit.new_source_path}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 font-bold uppercase">Assessed Risk Tier:</span>
                  <div className="text-slate-300 mt-0.5">{selectedAudit.risk_level || 'LOW (Conservative mapping change)'}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
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
