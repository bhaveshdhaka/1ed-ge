import { createContext, useContext, useState, type ReactNode } from 'react'

const CeremonyContext = createContext<{
  active: boolean
  setActive: (v: boolean) => void
}>({ active: false, setActive: () => {} })

export function CeremonyProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  return <CeremonyContext.Provider value={{ active, setActive }}>{children}</CeremonyContext.Provider>
}

export function useCeremony() { return useContext(CeremonyContext) }
