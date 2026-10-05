import type { ReactNode } from 'react'

export type AppPath = '/' | '/calibration' | '/ar' | '/moon-info' | '/settings'
export type Navigate = (path: AppPath) => void

export function AppLink({ to, navigate, children, className, current }: {
  to: AppPath; navigate: Navigate; children: ReactNode; className?: string; current?: boolean
}) {
  return <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }}>{children}</a>
}

export function AppNavigation({ navigate, active }: { navigate: Navigate; active: AppPath }) {
  return (
    <nav className="mw-navigation" aria-label="メインナビゲーション">
      <AppLink to="/" navigate={navigate} current={active === '/'}>ホーム</AppLink>
      <AppLink to="/moon-info" navigate={navigate} current={active === '/moon-info'}>月の情報</AppLink>
      <AppLink to="/settings" navigate={navigate} current={active === '/settings'}>設定</AppLink>
    </nav>
  )
}
