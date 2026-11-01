import React, { useEffect, useState, useMemo } from 'react'
import {
  Layers,
  RefreshCw,
  Search,
  Filter,
  Power,
  Play,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ArrowRight,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { TimelineStepper } from '../components/TimelineStepper'
import type {
  InstalledConnectorMetadata,
  ConnectorHealthItem,
  TestConnectionResult,
  ConnectorRunResult,
  ConnectorRunTimelineResponse,
  CatalogSource,
} from '../types/api'

export const ConfiguredConnectorsPage: React.FC = () => {
  const { user } = useAuth()
  const [configs, setConfigs] = useState<InstalledConnectorMetadata[]>([])
  const [healthMap, setHealthMap] = useState<Record<string, ConnectorHealthItem>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'catalog' | 'demo'>('catalog')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  // Action states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string>('')
  const [actionSuccess, setActionSuccess] = useState<string>('')

  // Detail Modal / Drawer
  const [inspectConnector, setInspectConnector] = useState<InstalledConnectorMetadata | null>(null)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [runResult, setRunResult] = useState<ConnectorRunResult | null>(null)
  const [runTimeline, setRunTimeline] = useState<ConnectorRunTimelineResponse | null>(null)

  const [catalogSourceIds, setCatalogSourceIds] = useState<string[]>([])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [configsData, healthData, sourcesData] = await Promise.all([
        CyberForgeApi.getInstalledConfigs(),
        CyberForgeApi.getHealth().catch(() => [] as ConnectorHealthItem[]),
        CyberForgeApi.getSources().catch(() => [] as CatalogSource[]),
      ])
      setConfigs(configsData)
      setCatalogSourceIds(sourcesData.map((s) => s.source_id.toLowerCase()))
      const map: Record<string, ConnectorHealthItem> = {}
      for (const h of healthData) {
        map[h.connector] = h
      }
      setHealthMap(map)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const { catalogConfigs, demoConfigs } = useMemo(() => {
    const cat: InstalledConnectorMetadata[] = []
    const dem: InstalledConnectorMetadata[] = []

    for (const c of configs) {
      const isCatalog = catalogSourceIds.some(
        (cs) => c.connector.toLowerCase().startsWith(`${cs}-`)
      )

      if (isCatalog) {
        cat.push(c)
      } else {
        dem.push(c)
      }
    }

    return { catalogConfigs: cat, demoConfigs: dem }
  }, [configs, catalogSourceIds])

  // Filter current tab
  const currentTabConfigs = activeTab === 'catalog' ? catalogConfigs : demoConfigs

  const filteredConfigs = useMemo(() => {
    return currentTabConfigs.filter((c) => {
      const matchesSearch = c.connector.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesEntity = !selectedEntity || c.entity === selectedEntity
      const matchesStatus =
        !selectedStatus ||
        (selectedStatus === 'enabled' ? c.enabled : !c.enabled)
      return matchesSearch && matchesEntity && matchesStatus
    })
  }, [currentTabConfigs, searchTerm, selectedEntity, selectedStatus])

  // Handle Activation Toggle (Admin only)
  const handleToggleActivation = async (connector: InstalledConnectorMetadata) => {
    if (user?.role !== 'admin') return
    const newEnabled = !connector.enabled
    setActionInProgress(connector.connector)
    setActionError('')
    setActionSuccess('')
    try {
      await CyberForgeApi.setActivation(connector.connector, newEnabled)
      setActionSuccess(`Connector "${connector.connector}" is now ${newEnabled ? 'ACTIVE' : 'DISABLED'}.`)
      setConfigs((prev) =>
        prev.map((c) => (c.connector === connector.connector ? { ...c, enabled: newEnabled } : c))
      )
      if (inspectConnector?.connector === connector.connector) {
        setInspectConnector({ ...inspectConnector, enabled: newEnabled })
      }
    } catch (err) {
      setActionError(readableApiError(err))
    } finally {
      setActionInProgress(null)
    }
  }

  // Handle Test Connection (Operator / Admin)
  const handleTestConnection = async (connectorName: string) => {
    if (user?.role === 'viewer') return
    setActionInProgress(connectorName)
    setActionError('')
    setActionSuccess('')
    setTestResult(null)
    try {
      const res = await CyberForgeApi.testConnection(connectorName)
      setTestResult(res)
      if (res.success) {
        setActionSuccess(`Dry-run connection test passed for "${connectorName}".`)
      } else {
        setActionError(`Dry-run test failed: ${res.message || 'Connection failed'}`)
      }
    } catch (err) {
      setActionError(readableApiError(err))
    } finally {
      setActionInProgress(null)
    }
  }

  // Handle Run Now (Operator / Admin)
  const handleRunNow = async (connectorName: string) => {
    if (user?.role === 'viewer') return
    setActionInProgress(connectorName)
    setActionError('')
    setActionSuccess('')
    setRunResult(null)
    setRunTimeline(null)
    try {
      const res = await CyberForgeApi.runNow(connectorName)
      setRunResult(res)
      setActionSuccess(`Run executed successfully. Run ID: #${res.run_id}`)
      if (res.run_id) {
        const timeline = await CyberForgeApi.getRunTimeline(res.run_id)
        setRunTimeline(timeline)
      }
      void CyberForgeApi.getHealth().then((healthData) => {
        const map: Record<string, ConnectorHealthItem> = {}
        for (const h of healthData) map[h.connector] = h
        setHealthMap(map)
      })
    } catch (err) {
      setActionError(readableApiError(err))
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Integrations Management
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              {configs.length} Installed Configs
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-400" />
            <span>Configured Connectors</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Monitor installed YAML connector configurations, verify operational health, manage activation states, and trigger dry-runs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/integrations/wizard"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
          >
            <span>Deploy New Connector</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

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

      {/* Action alerts */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/20 p-3 text-xs font-mono text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs: Catalog Integrations vs Demo/Legacy Configs */}
      <div className="flex border-b border-slate-800 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-blue-500 text-blue-400 bg-blue-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Catalog Integrations ({catalogConfigs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('demo')}
          className={`px-4 py-2.5 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'demo'
              ? 'border-blue-500 text-blue-400 bg-blue-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="h-4 w-4" />
          <span>Demo / Test / Legacy Configs ({demoConfigs.length})</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
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
            <span>Entity:</span>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Entities</option>
              <option value="user">Users</option>
              <option value="device">Devices</option>
              <option value="event">Events</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>State:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All States</option>
              <option value="enabled">Active / Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <span className="text-slate-500">
            {filteredConfigs.length} shown
          </span>
        </div>
      </div>

      {/* Grid of Installed Connectors */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-800 bg-[#0d131f]" />
          ))}
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-12 text-center text-slate-500 font-mono">
          <Layers className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm">No connectors match the current filter in this tab.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredConfigs.map((connector) => {
            const health = healthMap[connector.connector]
            const isBusy = actionInProgress === connector.connector

            return (
              <div
                key={connector.connector}
                className={`group flex flex-col justify-between rounded-xl border p-4 shadow-lg transition-all ${
                  connector.enabled
                    ? 'border-emerald-900/60 bg-[#0b141a] hover:border-emerald-600/60'
                    : 'border-slate-800 bg-[#0d131f] hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            connector.enabled ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        <h3 className="font-mono text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                          {connector.connector}
                        </h3>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        File: <span className="text-slate-400">{connector.config_file}</span>
                      </p>
                    </div>

                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                        connector.enabled
                          ? 'border border-emerald-800 bg-emerald-950/80 text-emerald-400'
                          : 'border border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {connector.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {/* Attributes */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 text-[10px]">Entity:</span>
                      <div className="text-slate-200 capitalize">{connector.entity}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">Auth Type:</span>
                      <div className="text-slate-200">{connector.auth_type}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">Schedule:</span>
                      <div className="text-slate-200">{connector.schedule_every_minutes}m</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">Health:</span>
                      <div className="flex items-center gap-1">
                        {health ? (
                          <span
                            className={`capitalize ${
                              health.status === 'healthy'
                                ? 'text-emerald-400'
                                : health.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {health.status}
                          </span>
                        ) : (
                          <span className="text-slate-500">Uninitialized</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectConnector(connector)
                      setTestResult(null)
                      setRunResult(null)
                      setRunTimeline(null)
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Inspect Details
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Test button (Operator/Admin) */}
                    {user?.role !== 'viewer' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleTestConnection(connector.connector)}
                        title="Dry-run Test Connection"
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        Test
                      </button>
                    )}

                    {/* Run Now (Operator/Admin) */}
                    {user?.role !== 'viewer' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRunNow(connector.connector)}
                        title="Execute Pipeline Run"
                        className="rounded border border-blue-900 bg-blue-950/60 px-2 py-1 text-[11px] font-bold text-blue-300 hover:bg-blue-900 disabled:opacity-50"
                      >
                        Run
                      </button>
                    )}

                    {/* Activation Toggle (Admin only) */}
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleActivation(connector)}
                        title={connector.enabled ? 'Deactivate Connector' : 'Activate Connector'}
                        className={`rounded p-1 transition-colors ${
                          connector.enabled
                            ? 'text-emerald-400 hover:bg-emerald-950/40'
                            : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inspect Connector Drawer / Modal */}
      {inspectConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{inspectConnector.connector}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inspectConnector.enabled
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {inspectConnector.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  File: <strong className="text-slate-200">{inspectConnector.config_file}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectConnector(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono text-xs">
              {/* Metadata specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div>
                  <span className="text-slate-500 text-[10px]">Entity:</span>
                  <div className="text-white capitalize">{inspectConnector.entity}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Auth Type:</span>
                  <div className="text-white">{inspectConnector.auth_type}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Schedule:</span>
                  <div className="text-white">Every {inspectConnector.schedule_every_minutes} min</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Last Status:</span>
                  <div className="text-white">
                    {healthMap[inspectConnector.connector]?.status || 'Never executed'}
                  </div>
                </div>
              </div>

              {/* Health details if present */}
              {healthMap[inspectConnector.connector] && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                  <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider">Health Telemetry</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500">Records Pulled:</span>
                      <div className="text-white">
                        {healthMap[inspectConnector.connector].records_pulled}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Records Normalized:</span>
                      <div className="text-emerald-400">
                        {healthMap[inspectConnector.connector].records_normalized}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Quarantined Records:</span>
                      <div className="text-amber-400">
                        {healthMap[inspectConnector.connector].records_quarantined}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons inside drawer */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {user?.role !== 'viewer' && (
                  <button
                    type="button"
                    disabled={actionInProgress === inspectConnector.connector}
                    onClick={() => void handleTestConnection(inspectConnector.connector)}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    <span>Run Dry-Run Test</span>
                  </button>
                )}

                {user?.role !== 'viewer' && (
                  <button
                    type="button"
                    disabled={actionInProgress === inspectConnector.connector}
                    onClick={() => void handleRunNow(inspectConnector.connector)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Trigger Pipeline Run</span>
                  </button>
                )}

                {user?.role === 'admin' && (
                  <button
                    type="button"
                    disabled={actionInProgress === inspectConnector.connector}
                    onClick={() => void handleToggleActivation(inspectConnector)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                      inspectConnector.enabled
                        ? 'border-rose-900 bg-rose-950/40 text-rose-300 hover:bg-rose-950'
                        : 'border-emerald-900 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>{inspectConnector.enabled ? 'Deactivate' : 'Activate'}</span>
                  </button>
                )}
              </div>

              {/* Test result output if run */}
              {testResult && (
                <div
                  className={`rounded border p-3 ${
                    testResult.success
                      ? 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300'
                      : 'border-rose-800/80 bg-rose-950/20 text-rose-300'
                  }`}
                >
                  <div className="font-bold">
                    Dry-Run Connection Test: {testResult.success ? 'PASSED' : 'FAILED'} (HTTP {testResult.http_status ?? 'N/A'})
                  </div>
                  <p className="mt-1">{testResult.message}</p>
                </div>
              )}

              {/* Run result output if executed */}
              {runResult && (
                <div className="rounded border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>Run Result: #{runResult.run_id} ({runResult.status.toUpperCase()})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                    <div>Extracted: <strong className="text-white">{runResult.records_received}</strong></div>
                    <div>Ingested: <strong className="text-emerald-400">{runResult.records_normalized}</strong></div>
                    <div>Quarantined: <strong className="text-amber-400">{runResult.records_quarantined}</strong></div>
                  </div>
                </div>
              )}

              {/* Execution Timeline */}
              {runTimeline && (
                <div className="pt-2">
                  <TimelineStepper
                    timeline={runTimeline}
                    title="Execution Timeline"
                    subtitle={`Run #${runTimeline.run.run_id} execution lifecycle milestones`}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setInspectConnector(null)}
                className="rounded-lg border border-slate-800 px-4 py-1.5 text-xs font-mono text-slate-400 hover:bg-slate-800 hover:text-white"
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
