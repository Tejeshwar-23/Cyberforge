import React, { useState } from 'react'
import {
  Activity,
  Boxes,
  BrainCircuit,
  Database,
  FlaskConical,
  Gauge,
  History,
  KeyRound,
  LogOut,
  Menu,
  X,
  PlugZap,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { RoleBadge } from '../components/RoleBadge'

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const userRole = user?.role || 'viewer'
  const isPrivileged = userRole === 'operator' || userRole === 'admin'

  const navGroups = [
    {
      label: 'Platform',
      items: [
        {
          label: 'Overview',
          path: '/',
          icon: Gauge,
        },
      ],
    },
    {
      label: 'Integrations',
      items: [
        {
          label: 'Source Catalog',
          path: '/integrations/catalog',
          icon: PlugZap,
        },
        {
          label: 'Configured Connectors',
          path: '/integrations/connectors',
          icon: Boxes,
        },
        {
          label: 'Deploy Wizard',
          path: '/integrations/wizard',
          icon: Wrench,
          badge: isPrivileged ? undefined : 'Operator',
        },
      ],
    },
    {
      label: 'Canonical Telemetry',
      items: [
        {
          label: 'Users',
          path: '/data/users',
          icon: Users,
        },
        {
          label: 'Devices',
          path: '/data/devices',
          icon: Database,
        },
        {
          label: 'Events',
          path: '/data/events',
          icon: Siren,
        },
      ],
    },
    {
      label: 'Operations',
      items: [
        {
          label: 'Live Runs',
          path: '/operations/live',
          icon: Activity,
        },
        {
          label: 'Run History',
          path: '/operations/history',
          icon: History,
        },
        {
          label: 'Quarantine',
          path: '/operations/quarantine',
          icon: ShieldCheck,
        },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        {
          label: 'Risk Analysis',
          path: '/intelligence/risk',
          icon: BrainCircuit,
        },
        {
          label: 'Self-Healing',
          path: '/intelligence/self-heal',
          icon: ShieldCheck,
        },
      ],
    },
    {
      label: 'Governance & Demo',
      items: [
        // Final Correction 1: Viewer must NOT be presented as having access to secrets metadata.
        ...(isPrivileged
          ? [
              {
                label: 'Secrets Vault',
                path: '/security/secrets',
                icon: KeyRound,
              },
            ]
          : []),
        {
          label: 'Demo',
          path: '/demo',
          icon: Sparkles,
        },
        {
          label: 'Failure Simulation',
          path: '/operations/failure-simulation',
          icon: FlaskConical,
        },
      ],
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 cyber-grid">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-[#090d16]/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-950/60 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <span className="font-mono text-base font-bold text-blue-400">CF</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wider text-white">CYBERFORGE</span>
            </div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">Security Integration</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <h4 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                {group.label}
              </h4>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      onClick={() => setMobileOpen(false)}
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-inner'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[9px] font-mono text-slate-400 uppercase">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer profile bar */}
        <div className="shrink-0 border-t border-slate-800 bg-[#060910] p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-xs font-medium text-white font-mono">
                {user?.username || 'Authenticated User'}
              </p>
              <div className="mt-1">
                <RoleBadge role={userRole} size="sm" />
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#090d16]/80 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white lg:hidden"
              title="Toggle Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono text-slate-400">
                  Backend: <span className="text-slate-200 font-semibold">Port 8000</span>
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="text-xs font-mono text-slate-400">
                Mock Services: <span className="text-slate-200 font-semibold">Port 9001</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-mono text-slate-400">
              Environment: <span className="text-blue-400 font-semibold uppercase">Development</span>
            </div>
            <RoleBadge role={userRole} />
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
