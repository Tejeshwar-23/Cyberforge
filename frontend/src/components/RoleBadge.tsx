import React from 'react'
import { clsx } from 'clsx'
import { Shield, Wrench, Eye } from 'lucide-react'
import type { UserRole } from '../types/api'

interface RoleBadgeProps {
  role: UserRole | string
  size?: 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const normRole = (role || 'viewer').toLowerCase()

  const config = {
    admin: {
      label: 'Admin',
      icon: Shield,
      style: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
    },
    operator: {
      label: 'Operator',
      icon: Wrench,
      style: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
    },
    viewer: {
      label: 'Viewer',
      icon: Eye,
      style: 'bg-slate-800 text-slate-300 border-slate-700',
    },
  }[normRole] || {
    label: normRole,
    icon: Eye,
    style: 'bg-slate-800 text-slate-300 border-slate-700',
  }

  const Icon = config.icon

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium font-mono uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        config.style,
        className,
      )}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      <span>{config.label}</span>
    </span>
  )
}
