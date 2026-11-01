import React, { useEffect, useState, useMemo } from 'react'
import {
  PlugZap,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Shield,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type { CatalogSource, ConnectorSummary } from '../types/api'

export const CatalogPage: React.FC = () => {
  const [sources, setSources] = useState<CatalogSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [drawerSource, setDrawerSource] = useState<CatalogSource | null>(null)

  const loadSources = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await CyberForgeApi.getSources()
      setSources(data)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSources()
  }, [])

  const filteredSources = useMemo(() => {
    return sources.filter((src) => {
      const matchesSearch =
        src.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        src.source_id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesEntity =
        !selectedEntity || src.entities.includes(selectedEntity as 'user' | 'device' | 'event')
      const matchesFormat =
        !selectedFormat || src.response_formats.includes(selectedFormat)
      return matchesSearch && matchesEntity && matchesFormat
    })
  }, [sources, searchTerm, selectedEntity, selectedFormat])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">Integrations</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Verified Templates
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono">
            Security Integration Catalog
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Browse verified connector templates for vendor-inspired security sources across Users, Devices, and Events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/integrations/wizard"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
          >
            <span>Deploy via Wizard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => void loadSources()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Vendor Disclaimer Banner */}
      <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-xs font-mono text-slate-300 flex items-start gap-3">
        <Shield className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Vendor-inspired security integrations for the CyberForge demonstration environment:</span>{' '}
          Security source templates represent vendor-inspired configurations designed for testing and demonstrating CyberForge&apos;s universal configuration engine. They do not imply official vendor partnership or certification.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sources by name or ID..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Filter className="h-3.5 w-3.5" />
            <span>Entity:</span>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            >
              <option value="">All Entities</option>
              <option value="user">Users</option>
              <option value="device">Devices</option>
              <option value="event">Events</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Format:</span>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            >
              <option value="">All Formats</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="yaml">YAML</option>
            </select>
          </div>

          <span className="text-xs font-mono text-slate-500">
            {filteredSources.length} of {sources.length} sources
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-4 text-xs font-mono text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Grid of Sources */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border border-slate-800 bg-[#0d131f]" />
          ))}
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-12 text-center text-slate-500 font-mono">
          <PlugZap className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm">No security sources match the current filter criteria.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map((source) => (
            <div
              key={source.source_id}
              className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0d131f] p-5 shadow-lg transition-all hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(37,99,235,0.1)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-blue-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono group-hover:text-blue-300 transition-colors">
                        {source.display_name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500">{source.source_id}</p>
                    </div>
                  </div>

                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 border border-slate-700">
                    {source.connector_count} Templates
                  </span>
                </div>

                {/* Capabilities pills */}
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-500 text-[10px] uppercase">Entities:</span>
                    {source.entities.map((e) => (
                      <span
                        key={e}
                        className="rounded border border-slate-800 bg-slate-900/80 px-1.5 py-0.5 text-slate-300 capitalize"
                      >
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-500 text-[10px] uppercase">Auth:</span>
                    {source.auth_types.map((a) => (
                      <span
                        key={a}
                        className="rounded border border-blue-950 bg-blue-950/40 px-1.5 py-0.5 text-blue-300"
                      >
                        {a}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-500 text-[10px] uppercase">Formats:</span>
                    {source.response_formats.map((f) => (
                      <span
                        key={f}
                        className="rounded border border-slate-800 bg-slate-900/80 px-1.5 py-0.5 text-slate-400 uppercase"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => setDrawerSource(source)}
                  className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  Inspect Templates ({source.connectors.length})
                </button>

                <Link
                  to={`/integrations/wizard?source=${encodeURIComponent(source.source_id)}`}
                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-400 hover:text-blue-300"
                >
                  <span>Configure</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer / Modal: Inspect Templates for Source */}
      {drawerSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white font-mono">{drawerSource.display_name}</h2>
                <p className="text-xs text-slate-400 font-mono">3 Canonical Entity Connector Templates</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerSource(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {drawerSource.connectors.map((c: ConnectorSummary) => (
                <div
                  key={c.connector}
                  className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-4 font-mono text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{c.connector}</span>
                    <span className="rounded bg-blue-950/80 border border-blue-800 px-2 py-0.5 text-[10px] text-blue-300 uppercase">
                      {c.entity}
                    </span>
                  </div>
                  {c.description && <p className="text-slate-400 text-[11px] font-sans">{c.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <span>Format: <strong className="text-slate-300 uppercase">{c.response_format}</strong></span>
                    <span className="text-slate-600">•</span>
                    <span>Auth: <strong className="text-slate-300">{c.auth_type}</strong></span>
                    <span className="text-slate-600">•</span>
                    <span>Pagination: <strong className="text-slate-300">{c.pagination_type}</strong></span>
                    <span className="text-slate-600">•</span>
                    <span>Schedule: <strong className="text-slate-300">{c.schedule_every_minutes}m</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs text-slate-400 font-mono">Select a template in the wizard to deploy</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerSource(null)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
                <Link
                  to={`/integrations/wizard?source=${encodeURIComponent(drawerSource.source_id)}`}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-blue-500"
                >
                  Launch Wizard
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
