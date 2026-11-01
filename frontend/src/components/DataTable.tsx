import React, { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Filter, AlertCircle, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  totalCount: number
  offset: number
  limit: number
  loading?: boolean
  onPageChange: (newOffset: number) => void
  onSearchChange?: (q: string) => void
  searchValue?: string
  sourceFilterValue?: string
  onSourceFilterChange?: (source: string) => void
  availableSources?: string[]
  searchPlaceholder?: string
  onRefresh?: () => void
  emptyMessage?: string
  title?: string
  subtitle?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  totalCount,
  offset,
  limit,
  loading = false,
  onPageChange,
  onSearchChange,
  searchValue = '',
  sourceFilterValue = '',
  onSourceFilterChange,
  availableSources = [],
  searchPlaceholder = 'Search records...',
  onRefresh,
  emptyMessage = 'No matching records found.',
  title,
  subtitle,
}: DataTableProps<T>) {
  const [clientSortKey, setClientSortKey] = useState<string | null>(null)
  const [clientSortDir, setClientSortDir] = useState<'asc' | 'desc'>('asc')
  const [clientFilterText, setClientFilterText] = useState('')

  const handleSort = (key: string) => {
    if (clientSortKey === key) {
      if (clientSortDir === 'asc') {
        setClientSortDir('desc')
      } else {
        setClientSortKey(null)
      }
    } else {
      setClientSortKey(key)
      setClientSortDir('asc')
    }
  }

  // Client-side operations on loaded rows (clearly labeled in UI)
  const displayData = useMemo(() => {
    let rows = [...data]

    if (clientFilterText.trim()) {
      const term = clientFilterText.toLowerCase()
      rows = rows.filter((item) =>
        Object.values(item).some((val) =>
          String(val ?? '').toLowerCase().includes(term),
        ),
      )
    }

    if (clientSortKey) {
      rows.sort((a, b) => {
        const valA = a[clientSortKey]
        const valB = b[clientSortKey]
        if (valA === valB) return 0
        if (valA === null || valA === undefined) return 1
        if (valB === null || valB === undefined) return -1
        const res = valA > valB ? 1 : -1
        return clientSortDir === 'asc' ? res : -res
      })
    }

    return rows
  }, [data, clientFilterText, clientSortKey, clientSortDir])

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const canPrev = offset > 0
  const canNext = offset + limit < totalCount

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-[#0d131f] shadow-xl overflow-hidden">
      {/* Header controls */}
      <div className="border-b border-slate-800/80 p-4 bg-slate-900/40">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title && (
              <h2 className="text-base font-semibold tracking-wide text-white font-mono flex items-center gap-2">
                {title}
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-sans border border-slate-700">
                  {totalCount.toLocaleString()} total
                </span>
              </h2>
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Server-side search */}
            {onSearchChange && (
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Server-side source filter */}
            {onSourceFilterChange && availableSources.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={sourceFilterValue}
                  onChange={(e) => onSourceFilterChange(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Sources</option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Client-side filter on loaded rows */}
            <div className="relative min-w-[150px]">
              <input
                type="text"
                value={clientFilterText}
                onChange={(e) => setClientFilterText(e.target.value)}
                placeholder="Filter loaded rows..."
                title="Filters only the currently loaded page rows"
                className="w-full rounded-lg border border-slate-800/80 bg-slate-900/60 py-1.5 px-2.5 text-xs text-slate-300 placeholder-slate-500 focus:border-slate-600 focus:outline-none"
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh table data"
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            )}
          </div>
        </div>

        {(clientFilterText || clientSortKey) && (
          <div className="mt-2 text-[11px] font-mono text-amber-400/90 flex items-center gap-2">
            <span>Client-side sort/filter active (affects current page only).</span>
            <button
              type="button"
              onClick={() => {
                setClientFilterText('')
                setClientSortKey(null)
              }}
              className="underline hover:text-amber-300"
            >
              Reset client view
            </button>
          </div>
        )}
      </div>

      {/* Table contents */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#090d16]/90 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx('px-4 py-3 font-semibold select-none', col.className)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                      title="Sort current page rows"
                    >
                      <span>{col.header}</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-500" />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              Array.from({ length: Math.min(limit, 5) }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-3">
                      <div className="h-4 rounded bg-slate-800/80" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  <AlertCircle className="mx-auto h-7 w-7 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              displayData.map((item, rowIdx) => (
                <tr
                  key={item.id ?? item.pk ?? rowIdx}
                  className="transition-colors hover:bg-slate-800/30 font-mono"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={clsx('px-4 py-3 text-slate-300', col.className)}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-slate-800 bg-[#090d16] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing <span className="text-slate-200 font-mono">{totalCount === 0 ? 0 : offset + 1}</span> to{' '}
          <span className="text-slate-200 font-mono">{Math.min(offset + limit, totalCount)}</span> of{' '}
          <span className="text-slate-200 font-mono">{totalCount.toLocaleString()}</span> records
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono">
            Page {currentPage} of {totalPages}
          </span>

          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => onPageChange(offset + limit)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
