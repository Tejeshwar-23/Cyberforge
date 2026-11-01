import React, { useEffect, useState, useCallback } from 'react'
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  FileCode,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import type { NormalizedUserRecord, PaginatedDataResponse } from '../types/api'

export const UsersPage: React.FC = () => {
  const [data, setData] = useState<PaginatedDataResponse<NormalizedUserRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Server-side query params
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [limit] = useState(25)
  const [offset, setOffset] = useState(0)

  // Client-side filter on currently loaded rows
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('')

  // Common Schema Record Details Modal
  const [selectedUser, setSelectedUser] = useState<NormalizedUserRecord | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await CyberForgeApi.getUsers({
        q: searchQuery.trim() || undefined,
        source: sourceFilter || undefined,
        offset,
        limit,
      })
      setData(res)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }, [searchQuery, sourceFilter, offset, limit])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    void loadUsers()
  }

  // Apply client-side filter on loaded rows only
  const displayedItems = (data?.items || []).filter((u) => {
    if (!clientStatusFilter) return true
    return u.status?.toLowerCase() === clientStatusFilter.toLowerCase()
  })

  const totalCount = data?.pagination.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Normalized Telemetry
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              Common Schema v1.0
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-400" />
            <span>Normalized Users</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Canonical identity records ingested across Identity and Access Management sources into unified CyberForge schema.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Query Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, ID (server query)..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Server-side source filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Source (Server):</span>
            <input
              type="text"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value)
                setOffset(0)
              }}
              placeholder="e.g. sophos-intercept-x"
              className="w-28 rounded-lg border border-slate-800 bg-[#090d16] px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Client-side status filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="text-[10px] text-amber-400/80 uppercase font-semibold">[Client] Status:</span>
            <select
              value={clientStatusFilter}
              onChange={(e) => setClientStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#090d16] px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            >
              <option value="">All Loaded</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <span className="text-xs font-mono text-slate-500">
            {data ? `${totalCount} total rows in database` : 'Loading...'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Source & ID</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No normalized user records found matching the criteria.
                  </td>
                </tr>
              ) : (
                displayedItems.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white uppercase text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded inline-block">
                        {u.source}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[120px]">
                        {u.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {u.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {u.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          u.status?.toLowerCase() === 'active'
                            ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                            : 'bg-rose-950/80 border border-rose-800 text-rose-400'
                        }`}
                      >
                        {u.status?.toLowerCase() === 'active' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span>{u.status || 'unknown'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
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
              {Math.min(offset + limit, totalCount)} of {totalCount} records
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
                {Math.ceil(totalCount / limit) || 1}
              </span>
              <button
                type="button"
                disabled={offset + limit >= totalCount || loading}
                onClick={() => setOffset(offset + limit)}
                className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspector Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl max-h-[85vh] flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-blue-400" />
                  <span>Normalized User Record #{selectedUser.id}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Source: <strong className="text-slate-300 uppercase">{selectedUser.source}</strong> — Normalized Common Schema Record
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded bg-slate-900/60 p-3 border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500">Name:</span>
                  <div className="text-white">{selectedUser.name || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>
                  <div className="text-white">{selectedUser.email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <div className="text-white uppercase font-bold">{selectedUser.status || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Last Login:</span>
                  <div className="text-white">{selectedUser.last_login || 'N/A'}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Record JSON:</span>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-[#070a10] border border-slate-800/80 p-3 text-[11px] text-slate-300">
                  {JSON.stringify(selectedUser, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
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
