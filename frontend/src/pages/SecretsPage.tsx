import React, { useEffect, useState } from 'react'
import {
  Lock,
  RefreshCw,
  Search,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Plus,
  RotateCw,
  CheckCircle2,
  X,
  FileKey,
  ShieldAlert,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { RoleBadge } from '../components/RoleBadge'
import type { SecretMetadataItem } from '../types/api'

export const SecretsPage: React.FC = () => {
  const { user } = useAuth()
  const isViewer = user?.role === 'viewer'
  const isAdmin = user?.role === 'admin'
  const isOperatorOrAdmin = user?.role === 'operator' || user?.role === 'admin'

  const [secrets, setSecrets] = useState<SecretMetadataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Create / Rotate Secret Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [secretName, setSecretName] = useState('')
  const [secretValue, setSecretValue] = useState('')
  const [savingSecret, setSavingSecret] = useState(false)
  const [secretActionMsg, setSecretActionMsg] = useState('')
  const [secretActionError, setSecretActionError] = useState('')

  const loadSecrets = React.useCallback(async () => {
    // Viewer must NEVER issue GET /api/secrets (403 restriction)
    if (isViewer) return

    setLoading(true)
    setError('')
    try {
      const data = await CyberForgeApi.getSecrets()
      setSecrets(data)
    } catch (err) {
      setError(readableApiError(err))
    } finally {
      setLoading(false)
    }
  }, [isViewer])

  useEffect(() => {
    if (isOperatorOrAdmin) {
      void loadSecrets()
    }
  }, [isOperatorOrAdmin, loadSecrets])

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secretName.trim() || !secretValue.trim()) return
    setSavingSecret(true)
    setSecretActionError('')
    setSecretActionMsg('')
    try {
      const cleanName = secretName.trim().replace(/^secret:\/\//, '')
      const res = await CyberForgeApi.createOrRotateSecret(cleanName, secretValue)
      setSecretActionMsg(`Secret "${res.name}" stored in AES-256-GCM encrypted vault. Fingerprint: ${res.fingerprint.slice(0, 16)}...`)
      setSecretValue('')
      setSecretName('')
      void loadSecrets()
      setTimeout(() => {
        setModalOpen(false)
        setSecretActionMsg('')
      }, 1800)
    } catch (err) {
      setSecretActionError(readableApiError(err))
    } finally {
      setSavingSecret(false)
    }
  }

  const filteredSecrets = secrets.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Viewer Restricted State
  if (isViewer) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Security Vault</span>
            <RoleBadge role="viewer" />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Lock className="h-6 w-6 text-slate-500" />
            <span>Encrypted Secret Vault</span>
          </h1>
        </div>

        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-8 text-center font-mono space-y-3 shadow-xl">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-400" />
          <h2 className="text-base font-bold text-white">Access Restricted to Operator & Admin Roles</h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            By security policy, secret metadata and vault management APIs are restricted to Operators and Administrators. Viewer accounts are barred from accessing or probing secret metadata.
          </p>
          <div className="pt-2 text-[11px] text-slate-500">
            Current Role: <span className="text-amber-300 font-bold uppercase">Viewer</span> • Zero unauthorized API calls were dispatched.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Security & Credential Vault
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              AES-256-GCM HKDF
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Lock className="h-6 w-6 text-blue-400" />
            <span>Encrypted Secret Vault — AES-256-GCM</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Encrypted vendor credential storage using AES-256-GCM with HKDF-derived keys, random nonces, AAD, and HMAC-based fingerprints. Plaintext secret values are never returned through read APIs or displayed in the UI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setModalOpen(true)
                setSecretName('')
                setSecretValue('')
                setSecretActionError('')
                setSecretActionMsg('')
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Store / Rotate Secret</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadSecrets()}
            disabled={loading}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 font-mono text-xs text-slate-400 space-y-1 shadow-md">
        <div className="flex items-center gap-2 text-white font-bold">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Cryptographic Vault Implementation Specifications</span>
        </div>
        <p className="text-[11px] text-slate-400">
          • <strong>Algorithm:</strong> AES-256-GCM authenticated encryption with HKDF key derivation from master secret.
        </p>
        <p className="text-[11px] text-slate-400">
          • <strong>Integrity & Validation:</strong> Random 96-bit nonces, Additional Authenticated Data (AAD) bound to secret name, and SHA-256 HMAC fingerprints for validation without decryption.
        </p>
        <p className="text-[11px] text-slate-500">
          • <strong>Password Storage:</strong> User authentication credentials in PostgreSQL are hashed using <strong>Argon2</strong>.
        </p>
      </div>

      {/* Query Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d131f] p-4 sm:flex-row sm:items-center sm:justify-between shadow-md font-mono text-xs">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search secret name..."
            className="w-full rounded-lg border border-slate-800 bg-[#090d16] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <span className="text-slate-500">
          {filteredSecrets.length} of {secrets.length} secrets in vault
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Secrets Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 bg-[#080c14] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Secret Reference Name</th>
                <th className="px-4 py-3">HMAC SHA-256 Fingerprint</th>
                <th className="px-4 py-3">Encryption Algorithm</th>
                <th className="px-4 py-3">Last Rotated / Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="h-12 bg-slate-900/30 px-4 py-3" />
                  </tr>
                ))
              ) : filteredSecrets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No secrets currently stored in vault matching search.
                  </td>
                </tr>
              ) : (
                filteredSecrets.map((s) => (
                  <tr key={s.name} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>{s.name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      <code>{s.fingerprint ? `${s.fingerprint.slice(0, 24)}...` : 'N/A'}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 font-bold uppercase">
                        AES-256-GCM
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSecretName(s.name)
                            setSecretValue('')
                            setSecretActionError('')
                            setSecretActionMsg('')
                            setModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>Rotate</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">Operator Read-Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Store / Rotate Secret Modal */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-slate-800 bg-[#0d131f] p-6 shadow-2xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileKey className="h-4 w-4 text-blue-400" />
                <span>Store / Rotate Secret in Vault</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSecret} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1">Secret Reference Name:</label>
                <input
                  type="text"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="e.g. SOPHOS_BEARER_TOKEN"
                  className="w-full rounded-lg border border-slate-800 bg-[#070a10] p-2.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">
                  Referenced in YAML as <code>secret://{'<name>'}</code>
                </span>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Raw Secret Credential:</label>
                <input
                  type="password"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Enter token, API key, or credential..."
                  className="w-full rounded-lg border border-slate-800 bg-[#070a10] p-2.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">
                  Encrypted via AES-256-GCM before database write. Plaintext is never saved.
                </span>
              </div>

              {secretActionError && (
                <div className="rounded border border-rose-800/80 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                  {secretActionError}
                </div>
              )}

              {secretActionMsg && (
                <div className="rounded border border-emerald-800/80 bg-emerald-950/20 p-2 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{secretActionMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3.5 py-2 text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingSecret || !secretName.trim() || !secretValue.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-md"
                >
                  {savingSecret ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Encrypting...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Encrypt & Save</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
