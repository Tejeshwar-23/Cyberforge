import React, { useEffect, useState } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  BrainCircuit,
  AlertTriangle,
  ChevronDown,
  Info,
  Activity,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { OperationalRiskBadge, MLAnomalyBadge } from '../components/RiskBadge'
import type {
  RiskSummaryResponse,
  ConnectorRiskResponse,
  CombinedRunAnalysis,
} from '../types/api'

export const RiskAnalysisPage: React.FC = () => {
  const [summary, setSummary] = useState<RiskSummaryResponse | null>(null)
  const [connectorRisk, setConnectorRisk] = useState<ConnectorRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('')
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const sumRes = await CyberForgeApi.getRiskSummary()
      setSummary(sumRes)

      const connRes = await CyberForgeApi.getConnectorRisk()
      setConnectorRisk(connRes)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const initialLoadStarted = React.useRef(false)

  useEffect(() => {
    if (initialLoadStarted.current) return

    initialLoadStarted.current = true
    void loadData()
  }, [])

  const items = connectorRisk?.items || []

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.run.connector.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = !tierFilter || item.operational_risk.level.toLowerCase() === tierFilter.toLowerCase()
    return matchesSearch && matchesTier
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Intelligence Engine
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Dual-Model Analytics
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-blue-400" />
            <span>Operational Risk &amp; Behavioral Anomaly Engine</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Combines deterministic heuristic risk scoring with regime-aware unsupervised IsolationForest behavioral anomaly detection.
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

      {/* Behavioral Anomaly Disclaimer */}
      <div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4 font-mono text-xs text-violet-300 shadow-md flex items-start gap-3">
        <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
        <p>
          <strong>Disclaimer:</strong> A behavioral anomaly indicates a statistically unusual execution pattern (duration, page volume, record throughput). It is not an assertion of compromise or system failure.
        </p>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4 font-mono">
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Total Runs Assessed</span>
            <div className="mt-1 text-3xl font-bold text-white">{summary.total_runs}</div>
            <p className="text-[10px] text-slate-500 mt-2">
              {summary.healthy_runs} healthy / {summary.failed_runs} failed
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Connectors Monitored</span>
            <div className="mt-1 text-3xl font-bold text-blue-400">{summary.connectors}</div>
            <p className="text-[10px] text-slate-500 mt-2">Unique configured connectors</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">High / Critical Risk</span>
            <div className="mt-1 text-3xl font-bold text-rose-400">
              {(summary.risk_distribution.HIGH || 0) + (summary.risk_distribution.CRITICAL || 0)}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              MODERATE: {summary.risk_distribution.MODERATE || 0} Ãƒâ€šÃ‚Â· LOW: {summary.risk_distribution.LOW || 0}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">ML Strategy</span>
            <div className="mt-1 text-xs font-bold text-violet-300 uppercase truncate">
              {summary.ml_strategy.replace(/_/g, ' ')}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Contamination=0.05, 300 estimators</p>
          </div>
        </div>
      )}

      {/* Query Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md font-mono text-xs">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search connector name..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Risk Tier (Loaded rows):</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Tiers</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <span className="text-slate-500">
            {filteredItems.length} of {items.length} connectors evaluated
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connector Risk & ML Intelligence Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Latest Run ID</th>
                <th className="px-4 py-3">Operational Risk</th>
                <th className="px-4 py-3">Regime</th>
                <th className="px-4 py-3">ML Anomaly Status</th>
                <th className="px-4 py-3">ML Score</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No connectors found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: CombinedRunAnalysis) => {
                  const isExpanded = expandedConnector === item.run.connector
                  return (
                    <React.Fragment key={item.run.connector}>
                      <tr
                        onClick={() =>
                          setExpandedConnector(isExpanded ? null : item.run.connector)
                        }
                        className="hover:bg-slate-900/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-semibold text-white">
                          {item.run.connector}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          #{item.run.run_id}
                        </td>
                        <td className="px-4 py-3">
                          <OperationalRiskBadge
                            level={item.operational_risk.level}
                            score={item.operational_risk.score}
                          />
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">
                          <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5">
                            {item.run.behavior_regime}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <MLAnomalyBadge
                            classification={item.ml_anomaly.classification}
                            score={item.ml_anomaly.score}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {item.ml_anomaly.score !== null && item.ml_anomaly.score !== undefined
                            ? item.ml_anomaly.score.toFixed(4)
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Factor Breakdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-[#090e17]">
                          <td colSpan={7} className="px-6 py-4 border-b border-slate-800/80">
                            <div className="space-y-4 font-mono text-xs">

                              {/* Sub-section A: Operational Risk */}
                              <div className="rounded-lg border border-blue-900/50 bg-blue-950/10 p-3 space-y-2">
                                <span className="text-blue-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  Operational Risk ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Contributing Heuristic Signals
                                </span>
                                {item.operational_risk.signals && item.operational_risk.signals.length > 0 ? (
                                  <div className="space-y-1">
                                    {item.operational_risk.signals.map((sig, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 border border-slate-800 text-[11px]"
                                      >
                                        <span className="text-slate-300">{sig.message || sig.signal}</span>
                                        <span className="font-bold text-amber-400">+{sig.weight} pts</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-slate-500 text-[11px]">
                                    No elevated risk factors detected. Clean execution baseline.
                                  </div>
                                )}
                              </div>

                              {/* Sub-section B: Behavioral Anomaly */}
                              <div className="rounded-lg border border-violet-900/50 bg-violet-950/10 p-3 space-y-2">
                                <span className="text-violet-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <Activity className="h-3.5 w-3.5" />
                                  Behavioral Anomaly ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â IsolationForest Regime Diagnostics
                                </span>
                                <div className="rounded bg-slate-900/60 p-2.5 border border-slate-800 text-[11px] space-y-1 text-slate-300">
                                  <div>
                                    Active Regime: <strong className="text-white">{item.run.behavior_regime}</strong>
                                  </div>
                                  <div>
                                    Training Scope: <strong className="text-slate-400">{item.ml_anomaly.training_scope || 'Earlier healthy regime runs'}</strong> ({item.ml_anomaly.training_samples} samples)
                                  </div>
                                  <div>
                                    IsolationForest Anomaly Score: <strong className="text-violet-300">{item.ml_anomaly.score?.toFixed(4) ?? 'N/A'}</strong>
                                  </div>
                                  <div>
                                    Statistical Classification: <strong className={item.ml_anomaly.model_flagged_anomaly ? 'text-fuchsia-400' : 'text-emerald-400'}>
                                      {item.ml_anomaly.model_flagged_anomaly
                                        ? 'STATISTICAL EXECUTION OUTLIER (Unusual Latency or Volume Pattern)'
                                        : 'NORMAL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Within Expected Statistical Range'}
                                    </strong>
                                  </div>
                                  {item.ml_anomaly.reason && (
                                    <div className="text-slate-500 text-[10px]">
                                      Note: {item.ml_anomaly.reason}
                                    </div>
                                  )}
                                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                                    Regime awareness isolates scheduled idle check latency from data transfer bursts to prevent false positives.
                                    A statistical outlier does <strong>not</strong> indicate a security incident or system failure.
                                  </p>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
