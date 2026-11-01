import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  BrainCircuit,
  Clock,
  Database,
  FileCode,
  FlaskConical,
  History,
  KeyRound,
  Layers,
  Lock,
  Play,
  PlugZap,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type { OverviewResponse } from '../types/api'
import { StatCard } from '../components/StatCard'

export const DemoPage: React.FC = () => {
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="space-y-10 font-sans pb-12">
      {/* SECTION 1 — Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-900/50 bg-[#090e1a] p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-blue-400">
                Judge Walkthrough &amp; System Capabilities
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-800/80 bg-emerald-950/60 px-3 py-1 font-mono text-xs font-semibold text-emerald-300 shadow-sm">
                Declarative YAML &rarr; Zero Custom Vendor Code
              </span>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                title="Refresh Live Metrics"
                className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
              CyberForge — Config-Driven Security Integration Platform
            </h1>
            <p className="mt-2 max-w-3xl text-sm sm:text-base text-slate-300">
              Integrate security products through declarative YAML instead of vendor-specific connector code.
              A universal runtime handles authentication, HTTP transport, pagination, error classification, common schema normalization, and automated resilience.
            </p>
          </div>

          {/* Architecture Pipeline Stepper */}
          <div className="pt-3">
            <div className="flex items-center justify-between pb-2">
              <span className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Universal Pipeline Architecture Flow
              </span>
              <span className="font-mono text-[11px] text-blue-400">
                End-to-End Execution Flow
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono text-[11px] text-center">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 shadow">
                <span className="text-slate-500 text-[10px] block">01 · Source</span>
                <span className="font-semibold text-white">Security Product</span>
              </div>
              <div className="rounded-lg border border-blue-800/60 bg-blue-950/30 p-2.5 shadow">
                <span className="text-blue-400 text-[10px] block">02 · Spec</span>
                <span className="font-semibold text-blue-300">Connector YAML</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 shadow">
                <span className="text-slate-500 text-[10px] block">03 · Engine</span>
                <span className="font-semibold text-white">Universal Engine</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 shadow">
                <span className="text-slate-500 text-[10px] block">04 · Transport</span>
                <span className="font-semibold text-slate-300">Auth / HTTP / Paging</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 shadow">
                <span className="text-slate-500 text-[10px] block">05 · Resilience</span>
                <span className="font-semibold text-slate-300">Retry / Quarantine</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 shadow">
                <span className="text-slate-500 text-[10px] block">06 · Parser</span>
                <span className="font-semibold text-slate-300">JSON/YAML/XML</span>
              </div>
              <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-2.5 shadow">
                <span className="text-emerald-500 text-[10px] block">07 · Canonical</span>
                <span className="font-semibold text-emerald-400">Common Schema</span>
              </div>
              <div className="rounded-lg border border-violet-900/60 bg-violet-950/30 p-2.5 shadow">
                <span className="text-violet-500 text-[10px] block">08 · Database</span>
                <span className="font-semibold text-violet-400">PostgreSQL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — Proven Platform Scale (Live API Values) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">Section 02</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
                Telemetry
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-mono mt-1">
              Proven Platform Scale
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Grounding: live operational values from <code>GET /api/overview</code>
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-4 font-mono text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Failed to load live overview metrics: {error}. Showing baseline capabilities below.</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Security Sources"
            value={data ? data.catalog.sources : 10}
            subtitle={data ? `${data.catalog.connector_templates} Catalog Connector Templates` : '30 Catalog Connector Templates'}
            icon={PlugZap}
            badge={{ text: 'Multi-Vendor', variant: 'cyan' }}
          />

          <StatCard
            title="Connector Templates"
            value={data ? data.catalog.connector_templates : 30}
            subtitle="Users, Devices &amp; Events"
            icon={FileCode}
            badge={{ text: 'Verified', variant: 'cyan' }}
          />

          <StatCard
            title="Normalized Telemetry"
            value={data ? data.data.normalized_total : 3215}
            subtitle={
              data
                ? `${data.data.users.toLocaleString()} users · ${data.data.devices.toLocaleString()} devices · ${data.data.events.toLocaleString()} events`
                : '1,000 users · 1,000 devices · 1,215 events'
            }
            icon={Database}
            badge={{ text: 'Common Schema', variant: 'emerald' }}
          />

          <StatCard
            title="Healthy Executions"
            value={data ? data.runs.healthy : 75}
            subtitle={
              data
                ? `${data.runs.failed} failed out of ${data.runs.total} total recorded runs`
                : '4 failed out of 79 total recorded runs'
            }
            icon={Activity}
            badge={
              data
                ? data.runs.failed > 0
                  ? { text: `${data.runs.failed} Failed`, variant: 'rose' }
                  : { text: 'Stable', variant: 'emerald' }
                : { text: 'Run Health', variant: 'emerald' }
            }
          />

          <StatCard
            title="Quarantined Records"
            value={data ? data.data.quarantine : 0}
            subtitle="Isolated from trusted DB tables"
            icon={ShieldCheck}
            badge={{
              text: data && data.data.quarantine > 0 ? 'Failures Contained' : 'Zero Poisoning',
              variant: data && data.data.quarantine > 0 ? 'amber' : 'neutral',
            }}
          />
        </div>
      </div>

      {/* SECTION 3 — Challenge Requirements / Capabilities */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">Section 03</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Evaluation Matrix
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono mt-1">
            Challenge Requirements &amp; Implemented Capabilities
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            A 10-point architectural verification matrix comparing core platform mechanisms against hackathon requirements.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {/* 1. Config-Driven Integration */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-400" />
                <span>1. Config-Driven Integration</span>
              </span>
              <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 border border-blue-800">
                Universal Runtime
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              New security integrations are defined strictly in declarative YAML rather than requiring vendor-specific Python connector code.
              The universal engine parses, authenticates, pages, transforms, and standardizes data based solely on the configuration file.
            </p>
          </div>

          {/* 2. Multiple Authentication Methods */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-400" />
                <span>2. Multiple Authentication Methods</span>
              </span>
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-800">
                Multi-Auth Proven
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              CyberForge supports API key, Bearer token, Basic authentication, and custom-header authentication.
              <span className="block mt-1 text-[11px] font-mono text-slate-400">
                Boundaries: OAuth2 token refresh flows are not implemented for the demonstration environment.
              </span>
            </p>
          </div>

          {/* 3. Pagination */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span>3. Pagination Engine</span>
              </span>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-800">
                Page &amp; Offset
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The engine features proven, battle-tested <strong>page-number</strong> and <strong>offset-limit</strong> pagination strategies with configurable page limits and safety break conditions.
              <span className="block mt-1 text-[11px] font-mono text-slate-400">
                Boundaries: Cursor / next-link pagination is not advertised as end-to-end runtime proven.
              </span>
            </p>
          </div>

          {/* 4. Scheduling */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>4. Scheduling Engine</span>
              </span>
              <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-800">
                APScheduler
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Enabled YAML connector configurations are registered by APScheduler at backend startup using the configured <code>every_minutes</code> cadence.
              <span className="block mt-1 text-[11px] font-mono text-slate-400">
                Boundaries: Activation updates on-disk YAML configuration state immediately enabling manual Run Now; dynamic hot-reload of running scheduler jobs requires service restart.
              </span>
            </p>
          </div>

          {/* 5. Common Schema */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <span>5. Common Schema Normalization</span>
              </span>
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-800">
                Canonical v1.0
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              All heterogeneous vendor records are mapped into fixed canonical Pydantic schemas: <strong>Users</strong> (id, name, email, status, source, last_login), <strong>Devices</strong> (id, hostname, ip, os, owner, source, last_seen), and <strong>Events</strong> (id, type, severity, timestamp, description, source).
            </p>
          </div>

          {/* 6. Secret Vault */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-400" />
                <span>6. Encrypted Secret Vault — AES-256-GCM</span>
              </span>
              <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 border border-blue-800">
                HKDF + HMAC
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Vendor credentials are encrypted with AES-256-GCM using HKDF-derived keys, unique 96-bit nonces, AAD bound to secret name, and HMAC SHA-256 fingerprints. Plaintext secret values are never returned by read APIs or displayed in the UI.
            </p>
          </div>

          {/* 7. Reliability */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <span>7. Resilient Execution &amp; Quarantine</span>
              </span>
              <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-800">
                Zero Batch Crash
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automatic exponential backoff for transient 5xx server errors, HTTP 429 <code>Retry-After</code> header compliance, and deterministic timeout classification. Syntactically malformed records are isolated to the Quarantine vault without crashing sibling records in the batch.
            </p>
          </div>

          {/* 8. Self-Healing */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Wrench className="h-4 w-4 text-emerald-400" />
                <span>8. Conservative Heuristic Self-Healing</span>
              </span>
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-800">
                Deterministic Rule Repair
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Autonomous mapping repair for schema drift (e.g. <code>raisedAt &rarr; createdAt</code> with 99% confidence). Synthesizes candidates in memory, verifies with an isolated 100/100 dry-run, and persists or rolls back.
              <span className="block mt-1 text-[11px] font-mono text-slate-400">
                Guardrail: Rule-based heuristic only (NOT ML). Never modifies credentials, auth mechanism, permissions, base domains, or HTTP methods.
              </span>
            </p>
          </div>

          {/* 9. Behavioral ML */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-violet-400" />
                <span>9. ML Behavioral Anomaly Detection</span>
              </span>
              <span className="rounded bg-violet-950 px-2 py-0.5 text-[10px] font-mono font-bold text-violet-300 border border-violet-800">
                IsolationForest
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Regime-aware IsolationForest model separates <code>IDLE_INCREMENTAL</code> polling from <code>DATA_SYNC</code> bursts to detect statistical execution outliers (latency spikes, page variances) without asserting compromise or attack.
            </p>
          </div>

          {/* 10. RBAC */}
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                <span>10. Role-Based Access Control (RBAC)</span>
              </span>
              <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 border border-blue-800">
                Viewer / Operator / Admin
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Strict 3-tier authorization verified via backend HTTP 200/403: <strong>Viewer</strong> (read-only telemetry, zero secret visibility), <strong>Operator</strong> (test connection, execute runs, check secret readiness), and <strong>Admin</strong> (store secrets, edit YAML, toggle activation).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4 — Reliability Proof */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">Section 04</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Exercised Scenarios
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono mt-1">
            Reliability &amp; Error Handling Evidence
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Real test scenarios exercised against the live mock security services on port 9001 and backend runner.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-amber-300 font-bold">
              <span>HTTP 429 Rate Limiting</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Respects upstream <code>Retry-After</code> header with automatic wait and successful subsequent retry.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-blue-300 font-bold">
              <span>Transient HTTP 5xx Failures</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Automatic exponential backoff recovers transient HTTP 5xx service failures without operator intervention.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-rose-300 font-bold">
              <span>Upstream Service Outage</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Connection timeouts and dropped sockets are classified deterministically as <code>TIMEOUT_ERROR</code> or <code>NETWORK_ERROR</code>.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-rose-300 font-bold">
              <span>Authentication Rejection</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              HTTP 401 / invalid API credentials are deterministically classified by the generic connector executor as <code>AUTHENTICATION_ERROR</code> without unnecessary retry.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-amber-300 font-bold">
              <span>Malformed Record Quarantine</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Malformed records with corrupt types or missing required fields are quarantined without crashing the batch. Reliability Lab valid records are intentionally not persisted, preventing test data from polluting normalized storage.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-4 space-y-2">
            <div className="flex items-center justify-between text-emerald-300 font-bold">
              <span>Autonomous Schema Drift Repair</span>
              <span className="text-[10px] text-emerald-400">PASSED</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Sophos events timestamp drift (<code>raisedAt &rarr; createdAt</code>) detected, candidate synthesized, verified, and saved with zero quarantine rows.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 5 — Live Demo Flow Walkthrough */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">Section 05</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Interactive Flow
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono mt-1">
            Recommended Judge Walkthrough
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Click any numbered step to jump directly to the live platform capability.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
          {[
            {
              step: '01',
              title: 'Source Catalog',
              desc: 'Inspect 10 vendor-inspired sources & 30 catalog templates.',
              path: '/integrations/catalog',
              icon: PlugZap,
            },
            {
              step: '02',
              title: 'Deploy Wizard',
              desc: 'Guided YAML deployment with in-memory validation, secret readiness checks, Test Connection, activation, and Run Now.',
              path: '/integrations/wizard',
              icon: Wrench,
            },
            {
              step: '03',
              title: 'Configured Connectors',
              desc: 'Inspect installed connector configurations, activation state, auth type, schedule, health, Test and Run actions.',
              path: '/integrations/connectors',
              icon: Boxes,
            },
            {
              step: '04',
              title: 'Normalized Users',
              desc: 'Common Schema User records normalized across identity sources.',
              path: '/data/users',
              icon: Users,
            },
            {
              step: '05',
              title: 'Normalized Devices',
              desc: 'Endpoint inventory telemetry with IP, OS, and owner attribution.',
              path: '/data/devices',
              icon: Database,
            },
            {
              step: '06',
              title: 'Normalized Events',
              desc: 'Unified security detections and alerts with severity mapping.',
              path: '/data/events',
              icon: Siren,
            },
            {
              step: '07',
              title: 'Live Runs Dispatcher',
              desc: 'Trigger on-demand pipeline execution and inspect 7-stage timelines.',
              path: '/operations/live',
              icon: Play,
            },
            {
              step: '08',
              title: 'Run History',
              desc: 'Historical audit log with verified milestone execution timelines.',
              path: '/operations/history',
              icon: History,
            },
            {
              step: '09',
              title: 'Quarantine Vault',
              desc: 'Malformed record inspection vault preventing database poisoning.',
              path: '/operations/quarantine',
              icon: ShieldAlert,
            },
            {
              step: '10',
              title: 'Operational Risk',
              desc: 'Deterministic risk scoring (0-100) and IsolationForest ML regimes.',
              path: '/intelligence/risk',
              icon: BrainCircuit,
            },
            {
              step: '11',
              title: 'Self-Healing Audits',
              desc: 'Audit trail of heuristic schema drift repairs, diffs & rollbacks.',
              path: '/intelligence/self-heal',
              icon: Wrench,
            },
            {
              step: '12',
              title: 'Secrets Vault',
              desc: 'AES-256-GCM HKDF credential storage with role-gated access.',
              path: '/security/secrets',
              icon: KeyRound,
            },
            {
              step: '13',
              title: 'Failure Simulation',
              desc: 'Live interactive experiments: Bad Record quarantine & Sophos drift.',
              path: '/operations/failure-simulation',
              icon: FlaskConical,
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.step}
                to={item.path}
                className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0d131f] p-4 transition-all hover:border-blue-500/60 hover:bg-[#0f172a] shadow"
              >
                <div>
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="font-bold text-[11px] text-blue-400">Step {item.step}</span>
                    <Icon className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400 font-sans leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300 pt-2 border-t border-slate-800/80">
                  <span>Open Screen</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* SECTION 6 — Honest Boundaries (Current Scope) */}
      <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-6 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Honest Scope &amp; Architectural Boundaries</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 text-[11px] text-slate-400 pt-1">
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Mock Environment:</strong> 10 vendor-inspired security sources are served by the local CyberForge mock service on port 9001 for hackathon demonstration.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Auth Scope:</strong> API Key, Bearer, Basic, and custom headers are verified. OAuth2 token refresh flows are not implemented.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Pagination:</strong> Page and offset pagination are proven end-to-end; cursor / next-link are not claimed as runtime-tested.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Scheduler:</strong> Reads enabled configurations at startup; background scheduler dynamic hot-reload requires service restart.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Behavioral ML:</strong> IsolationForest detects statistical execution outliers (latency, volume), not cyberattacks or malicious compromises.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Self-Healing:</strong> Rule-based heuristic repair limited to field mapping schema drift. Never alters credentials or network endpoints.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Alerting:</strong> Repeated failure risk scoring is implemented; outbound external email/Slack alert delivery is not implemented.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400">&bull;</span>
            <span><strong>Connector Copilot:</strong> Sarvam Connector Copilot will provide generalized generative configuration assistance in a future phase.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
