import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { adminApi, setUnauthorizedHandler, tokenStore } from '../lib/api'
import type { AdminUser } from '../lib/types'

type AuthCtx = {
  user: AdminUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    adminApi.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false))
  }, [logout])

  const login = async (email: string, password: string) => {
    const res = await adminApi.login(email, password)
    tokenStore.set(res.token)
    setUser(res.user)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
