import {
  createContext,
} from 'react'

import type {
  CurrentUser,
} from '../types/api'

export interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean

  login: (
    username: string,
    password: string,
  ) => Promise<void>

  logout: () => void
}

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  )
