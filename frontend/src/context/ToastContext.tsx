import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; type: 'success' | 'error'; message: string }
type ToastCtx = { success: (m: string) => void; error: (m: string) => void }

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, type, message }])
    setTimeout(() => remove(id), type === 'error' ? 6000 : 3500)
  }, [remove])
  const value = { success: (m: string) => push('success', m), error: (m: string) => push('error', m) }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg animate-fade-up ${t.type === 'success' ? 'border-forest-200 bg-white text-forest-800' : 'border-red-200 bg-white text-red-700'}`}>
            {t.type === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest-500" /> : <AlertCircle className="mt-0.5 size-5 shrink-0" />}
            <p className="flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} aria-label="ปิด" className="text-forest-400 hover:text-forest-700"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast must be used inside ToastProvider')
  return c
}
