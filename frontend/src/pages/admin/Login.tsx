import { Lock, LogIn, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { LotusMark } from '../../components/Illustrations'
import { Alert, LoadingBlock, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { user, loading, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const from = (loc.state as { from?: string } | null)?.from ?? '/admin'

  if (loading) return <LoadingBlock />
  if (user) return <Navigate to={from} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      nav(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-forest-900 px-4">
      <div className="absolute inset-0 bg-thai-pattern opacity-20" aria-hidden />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-3xl bg-cream-50 p-8 shadow-2xl animate-fade-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <LotusMark className="size-14" />
          <h1 className="mt-4 text-xl font-semibold">ระบบหลังร้าน</h1>
          <p className="text-sm text-forest-500">ร้านนวดไท๊ไทย • สำหรับเจ้าของร้านและพนักงาน</p>
        </div>
        {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
        <label htmlFor="email" className="label">อีเมล</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-forest-400" />
          <input id="email" type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <label htmlFor="password" className="label mt-4">รหัสผ่าน</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-forest-400" />
          <input id="password" type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button type="submit" className="btn-primary mt-6 w-full py-3" disabled={busy}>
          {busy ? <Spinner className="size-4" /> : <LogIn className="size-4" />}เข้าสู่ระบบ
        </button>
        <Link to="/" className="mt-5 block text-center text-sm text-forest-500 hover:text-forest-800">← กลับหน้าเว็บไซต์</Link>
      </form>
    </div>
  )
}
