import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Boxes,
  Database,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type { OverviewResponse } from '../types/api'
import { StatCard } from '../components/StatCard'

export const OverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await CyberForgeApi.getOverview()
      setData(res)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
        <span className="font-mono text-xs text-slate-400">Loading CyberForge operational state...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-6 text-slate-200">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-rose-400">
          <AlertTriangle className="h-5 w-5" />
          <span>Failed to load platform overview</span>
        </div>
        <p className="mt-2 text-xs text-rose-300/80">{error}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-4 rounded-lg border border-rose-800 bg-rose-900/40 px-3 py-1.5 text-xs font-mono text-rose-200 hover:bg-rose-900/70"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  const catalogIntegrations = data.catalog.connector_templates
  const totalConfigs = data.configured_connectors.total_files
  const demoConfigsCount = Math.max(0, totalConfigs - catalogIntegrations)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">Control Plane</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Live State
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono">
            Security Integration Platform Overview
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Operational state and governance status across all integrated security domains.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

            {/* Product Positioning & Architecture Pipeline */}
      <div className="rounded-xl border border-blue-900/40 bg-[#0a101d] p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400">Core Architecture</span>
            <h2 className="text-sm font-bold text-white font-mono">Config-Driven Security Integration Pipeline</h2>
          </div>
          <span className="rounded bg-blue-950/80 border border-blue-800 px-2.5 py-1 text-[11px] font-mono text-blue-300">
            Declarative YAML Â· Zero Custom Vendor Code
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400 font-sans">
          <strong>Value Proposition:</strong> Add and operate security integrations through declarative configuration rather than vendor-specific connector code.
        </p>

        {/* Pipeline Stepper Visualization */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono text-[11px] text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">01 Â· Source</span>
            <span className="font-semibold text-white">Security Product</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">02 Â· Spec</span>
            <span className="font-semibold text-blue-400">Connector YAML</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">03 Â· Engine</span>
            <span className="font-semibold text-white">Universal Runtime</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">04 Â· Transport</span>
            <span className="font-semibold text-slate-300">Auth &amp; Rate Limits</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">05 Â· Paging</span>
            <span className="font-semibold text-slate-300">Page / Offset</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300">
            <span className="text-slate-500 text-[10px] block">06 Â· Parser</span>
            <span className="font-semibold text-slate-300">JSON / YAML / XML</span>
          </div>
          <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-2 text-emerald-300">
            <span className="text-emerald-500 text-[10px] block">07 Â· Canonical</span>
            <span className="font-semibold text-emerald-400">Common Schema</span>
          </div>
          <div className="rounded-lg border border-violet-900/60 bg-violet-950/30 p-2 text-violet-300">
            <span className="text-violet-500 text-[10px] block">08 Â· Resilience</span>
            <span className="font-semibold text-violet-400">Health &amp; Self-Heal</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Security Sources"
          value={data.catalog.sources}
          subtitle={`${data.catalog.connector_templates} Catalog Connector Templates`}
          icon={PlugZap}
          badge={{ text: 'Catalog', variant: 'cyan' }}
        />

        <StatCard
          title="Normalized Telemetry"
          value={data.data.normalized_total}
          subtitle={`${data.data.users.toLocaleString()} users / ${data.data.devices.toLocaleString()} devices / ${data.data.events.toLocaleString()} events`}
          icon={Database}
          badge={{ text: 'Common Schema', variant: 'emerald' }}
        />

        <StatCard
          title="Healthy Executions"
          value={data.runs.healthy}
          subtitle={`${data.runs.failed} failed out of ${data.runs.total} total recorded runs`}
          icon={Activity}
          badge={{
            text: data.runs.failed > 0 ? `${data.runs.failed} Failed` : 'Stable',
            variant: data.runs.failed > 0 ? 'rose' : 'emerald',
          }}
        />

        <StatCard
          title="Quarantined Records"
          value={data.data.quarantine}
          subtitle="Isolated from trusted normalized tables"
          icon={ShieldCheck}
          badge={{ text: data.data.quarantine > 0 ? 'Failures Contained' : 'Zero', variant: data.data.quarantine > 0 ? 'amber' : 'neutral' }}
        />
      </div>

      {/* Telemetry & Health Distribution Visualizations */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Canonical Telemetry Distribution */}
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-white">Normalized Telemetry Distribution</span>
            <span className="text-[11px] text-slate-400">{data.data.normalized_total.toLocaleString()} total records</span>
          </div>
          {/* Segmented bar */}
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              style={{ width: `${data.data.normalized_total > 0 ? (data.data.users / data.data.normalized_total) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all"
              title={`Users: ${data.data.users}`}
            />
            <div
              style={{ width: `${data.data.normalized_total > 0 ? (data.data.devices / data.data.normalized_total) * 100 : 0}%` }}
              className="bg-blue-500 transition-all"
              title={`Devices: ${data.data.devices}`}
            />
            <div
              style={{ width: `${data.data.normalized_total > 0 ? (data.data.events / data.data.normalized_total) * 100 : 0}%` }}
              className="bg-amber-500 transition-all"
              title={`Events: ${data.data.events}`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
              <span className="text-[10px] text-emerald-400 block font-bold">Users</span>
              <span className="text-slate-200 font-semibold">{data.data.users.toLocaleString()}</span>
            </div>
            <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
              <span className="text-[10px] text-blue-400 block font-bold">Devices</span>
              <span className="text-slate-200 font-semibold">{data.data.devices.toLocaleString()}</span>
            </div>
            <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
              <span className="text-[10px] text-amber-400 block font-bold">Events</span>
              <span className="text-slate-200 font-semibold">{data.data.events.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Connector Health Distribution */}
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-white">Connector Health Breakdown</span>
            <span className="text-[11px] text-slate-400">
              {data.runs.latest_health.healthy + data.runs.latest_health.failed + data.runs.latest_health.other} evaluated
            </span>
          </div>
          {(() => {
            const totalHealth = data.runs.latest_health.healthy + data.runs.latest_health.failed + data.runs.latest_health.other
            return (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{ width: `${totalHealth > 0 ? (data.runs.latest_health.healthy / totalHealth) * 100 : 0}%` }}
                    className="bg-emerald-500 transition-all"
                    title={`Healthy: ${data.runs.latest_health.healthy}`}
                  />
                  <div
                    style={{ width: `${totalHealth > 0 ? (data.runs.latest_health.failed / totalHealth) * 100 : 0}%` }}
                    className="bg-rose-500 transition-all"
                    title={`Degraded / Failed: ${data.runs.latest_health.failed}`}
                  />
                  <div
                    style={{ width: `${totalHealth > 0 ? (data.runs.latest_health.other / totalHealth) * 100 : 0}%` }}
                    className="bg-slate-600 transition-all"
                    title={`Never Run: ${data.runs.latest_health.other}`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                    <span className="text-[10px] text-emerald-400 block font-bold">Healthy</span>
                    <span className="text-slate-200 font-semibold">{data.runs.latest_health.healthy}</span>
                  </div>
                  <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                    <span className="text-[10px] text-rose-400 block font-bold">Degraded</span>
                    <span className="text-slate-200 font-semibold">{data.runs.latest_health.failed}</span>
                  </div>
                  <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">Standby</span>
                    <span className="text-slate-200 font-semibold">{data.runs.latest_health.other}</span>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Main Sections: Recent Runs & Intelligence Readiness */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Recent Runs Activity (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white font-mono flex items-center gap-2">
                <span>Recent Connector Executions</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 border border-slate-700">
                  {data.runs.recent.length} recent
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Stage-level persisted milestone summaries</p>
            </div>

            <Link
              to="/operations/history"
              className="inline-flex items-center gap-1 text-xs font-mono text-blue-400 hover:text-blue-300"
            >
              <span>View All History</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60 overflow-hidden">
            {data.runs.recent.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">No recent connector runs recorded.</div>
            ) : (
              data.runs.recent.map((run) => (
                <div key={run.run_id} className="flex flex-wrap items-center justify-between gap-3 py-3 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    {run.status === 'healthy' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{run.connector}</span>
                        {run.http_status && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400">
                            HTTP {run.http_status}
                          </span>
                        )}
                        {run.error_type && (
                          <span className="rounded bg-rose-950 px-1.5 py-0.2 text-[10px] text-rose-300 border border-rose-800">
                            {run.error_type}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        Run #{run.run_id} / {run.records_normalized} normalized / {run.records_quarantined} quarantined
                        {run.duration_seconds !== null && ` / ${run.duration_seconds.toFixed(2)}s`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400">
                    {run.completed_at ? new Date(run.completed_at).toLocaleString() : 'In Progress'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Platform Intelligence & Architecture Breakdown */}
        <div className="space-y-6">
          {/* Intelligence Status Card */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg">
            <h3 className="text-sm font-semibold tracking-wide text-white font-mono flex items-center gap-2 mb-3">
              <BrainCircuit className="h-4 w-4 text-violet-400" />
              <span>Intelligence Status</span>
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Operational Risk Engine</span>
                  <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-800">
                    Active
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-sans">
                  Deterministic signal-weighted operational scoring (0â€“100) based on error classifications and failure rates.
                </p>
                <div className="mt-2 text-right">
                  <Link to="/intelligence/risk" className="text-blue-400 hover:text-blue-300 text-[11px]">
                    Inspect risk breakdown â†’
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">ML Behavioral Anomaly</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] border ${
                      data.intelligence.ml_anomaly.fully_available
                        ? 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-800'
                        : 'bg-amber-950 text-amber-400 border-amber-800'
                    }`}
                  >
                    {data.intelligence.ml_anomaly.fully_available ? 'Fully Trained' : 'Training'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-sans">
                  Regime-aware IsolationForest (contamination=0.05). Scores execution outliers without asserting compromise.
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                  <span>Idle Samples: {data.intelligence.ml_anomaly.idle_incremental.healthy_samples}/15</span>
                  <span>Sync Samples: {data.intelligence.ml_anomaly.data_sync.healthy_samples}/15</span>
                </div>
              </div>

              {/* Self-Healing Card */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Heuristic Self-Healing</span>
                  <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] text-blue-400 border border-blue-800">
                    {data.self_heal.audit_events} Audits
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-sans">
                  Conservative field mapping repair: {data.self_heal.applied} applied, {data.self_heal.verified} verified, {data.self_heal.rolled_back} rolled back.
                </p>
                <div className="mt-2 text-right">
                  <Link to="/intelligence/self-heal" className="text-blue-400 hover:text-blue-300 text-[11px]">
                    Audit history â†’
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Connectors Inventory Classification */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg">
            <h3 className="text-sm font-semibold tracking-wide text-white font-mono flex items-center gap-2 mb-3">
              <Boxes className="h-4 w-4 text-blue-400" />
              <span>Installed Configurations</span>
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between rounded bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-slate-300">Catalog Templates</span>
                <span className="font-bold text-white">{catalogIntegrations}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-slate-400">Demo / Test / Legacy Configs</span>
                <span className="font-bold text-slate-400">{demoConfigsCount}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-slate-300">Active / Enabled</span>
                <span className="font-bold text-emerald-400">{data.configured_connectors.enabled}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-slate-300">Inactive / Standby</span>
                <span className="font-bold text-slate-400">{data.configured_connectors.disabled}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-center">
              <Link
                to="/integrations/connectors"
                className="text-xs font-mono text-blue-400 hover:text-blue-300 font-semibold"
              >
                Manage Configured Connectors â†’
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
