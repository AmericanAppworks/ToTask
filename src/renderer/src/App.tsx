import { useEffect } from 'react'
import { useAppStore } from './store/app'
import AppShell from './components/layout/AppShell'

export default function App(): JSX.Element {
  const init = useAppStore((s) => s.init)

  useEffect(() => { init() }, [init])

  return <AppShell />
}
