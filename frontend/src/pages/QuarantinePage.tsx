import React, { useEffect, useState, useCallback } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
  X,
  FileCode,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type {
  QuarantinedRecordItem,
  QuarantineResponse,
  QuarantineSummaryResponse,
} from '../types/api'

export const QuarantinePage: React.FC = () => {
  const [data, setData] = useState<QuarantineResponse | null>(null)
  const [summary, setSummary] = useState<QuarantineSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Server params
  const [connectorFilter, setConnectorFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(25)

  // Client search on error message or ID
  const [searchQuery, setSearchQuery] = useState('')

  // Modal for raw record
  const [selectedRecord, setSelectedRecord] = useState<QuarantinedRecordItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [quarRes, sumRes] = await Promise.all([
        CyberForgeApi.getQuarantine({
          connector: connectorFilter || undefined,
          offset,
          limit,
        }),
        CyberForgeApi.getQuarantineSummary().catch(() => null),
      ])
      setData(quarRes)
      if (sumRes) setSummary(sumRes)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }, [connectorFilter, offset, limit])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const displayedItems = (data?.items || []).filter((item) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.connector.toLowerCase().includes(q) ||
      (item.error && item.error.toLowerCase().includes(q)) ||
      item.id.toString().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
              Reliability & Integrity
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Data Isolation
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-400" />
            <span>Quarantine Vault</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Malformed or schema-violating security records are isolated from trusted normalized storage to preserve downstream data integrity.
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

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 font-mono">
          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Total Quarantined</span>
            <div className="mt-1 text-2xl font-bold text-amber-400">{summary.total}</div>
            <p className="text-[10px] text-slate-500 mt-1">Isolated records preserved for inspection</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Affecting Connectors</span>
            <div className="mt-1 text-2xl font-bold text-white">
              {summary.connectors.length}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Connectors with quarantined records</p>
          </div>
        </div>
      )}

      {/* Query Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md font-mono text-xs">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search error message or ID (client filter)..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Connector (Server):</span>
            <input
              type="text"
              value={connectorFilter}
              onChange={(e) => {
                setConnectorFilter(e.target.value)
                setOffset(0)
              }}
              placeholder="Filter by connector..."
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none w-44"
            />
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Page Size:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setOffset(0)
              }}
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

      {/* Quarantined Records Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Record Index</th>
                <th className="px-4 py-3">Error Detail</th>
                <th className="px-4 py-3">Quarantined At</th>
                <th className="px-4 py-3 text-right">Payload Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No quarantined records found in the vault matching criteria.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-amber-400">
                      #{item.id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {item.connector}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {item.record_index}
                    </td>
                    <td className="px-4 py-3 text-rose-300 max-w-sm truncate text-[11px]">
                      {item.error}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {item.quarantined_at ? new Date(item.quarantined_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(item)}
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

        {/* Server Pagination */}
        {data && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-[#080c14] px-4 py-3 text-xs font-mono text-slate-400">
            <div>
              Showing {data.items.length > 0 ? offset + 1 : 0} to{' '}
              {Math.min(offset + limit, data.pagination.total)} of {data.pagination.total} quarantined records
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page {Math.floor(offset / limit) + 1} of{' '}
                {Math.ceil(data.pagination.total / limit) || 1}
              </span>
              <button
                type="button"
                disabled={offset + limit >= data.pagination.total || loading}
                onClick={() => setOffset(offset + limit)}
                className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Raw Quarantined Record Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl max-h-[85vh] flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-amber-400" />
                  <span>Quarantined Record #{selectedRecord.id}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Connector: <strong className="text-slate-300">{selectedRecord.connector}</strong> · Record Index: {selectedRecord.record_index}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              <div className="rounded bg-rose-950/20 border border-rose-800/80 p-3 text-[11px] text-rose-300 space-y-1">
                <div>
                  <span className="text-slate-400 font-bold">Error Detail:</span>
                  <p className="mt-0.5 text-rose-300">{selectedRecord.error}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">
                    Raw Record Snippet (Bounded Preview):
                  </span>
                  <span className="text-[10px] text-slate-500">Max 1000 characters</span>
                </div>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-[#070a10] border border-slate-800/80 p-3 text-[11px] text-slate-300 whitespace-pre-wrap break-all">
                  {selectedRecord.raw_record_preview || 'No raw record preview available.'}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
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
