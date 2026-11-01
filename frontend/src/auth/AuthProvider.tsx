import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  api,
  TOKEN_KEY,
} from '../lib/api'

import type {
  CurrentUser,
  LoginResponse,
} from '../types/api'

import {
  AuthContext,
} from './AuthContext'


interface Props {
  children: React.ReactNode
}


export function AuthProvider({
  children,
}: Props) {
  const [
    user,
    setUser,
  ] = useState<CurrentUser | null>(
    null,
  )

  const [
    loading,
    setLoading,
  ] = useState(true)


  const logout =
    useCallback(() => {
      localStorage.removeItem(
        TOKEN_KEY,
      )

      setUser(null)
    }, [])


  useEffect(() => {
    let active = true

    const restore =
      async () => {
        const token =
          localStorage.getItem(
            TOKEN_KEY,
          )

        if (!token) {
          if (active) {
            setLoading(false)
          }

          return
        }

        try {
          const response =
            await api.get<CurrentUser>(
              '/api/auth/me',
            )

          if (active) {
            setUser(
              response.data,
            )
          }
        }
        catch {
          localStorage.removeItem(
            TOKEN_KEY,
          )

          if (active) {
            setUser(null)
          }
        }
        finally {
          if (active) {
            setLoading(false)
          }
        }
      }

    void restore()

    return () => {
      active = false
    }
  }, [])


  const login =
    useCallback(
      async (
        username: string,
        password: string,
      ) => {
        const response =
          await api.post<LoginResponse>(
            '/api/auth/login',
            {
              username,
              password,
            },
          )

        localStorage.setItem(
          TOKEN_KEY,
          response.data.access_token,
        )

        try {
          const me =
            await api.get<CurrentUser>(
              '/api/auth/me',
            )

          setUser(
            me.data,
          )
        }
        catch (error) {
          localStorage.removeItem(
            TOKEN_KEY,
          )

          throw error
        }
      },
      [],
    )


  const value =
    useMemo(
      () => ({
        user,
        loading,
        login,
        logout,
      }),
      [
        user,
        loading,
        login,
        logout,
      ],
    )


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  )
}
