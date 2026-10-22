import { KonteksSesiPembeli, useStatusSesiPembeli } from './gunakanSesiPembeli.js'

// Satu sesi untuk login, profil, dan reseller agar perubahan langsung sinkron.
export function PenyediaSesiPembeli({ children }) {
  const sesi = useStatusSesiPembeli()
  return <KonteksSesiPembeli.Provider value={sesi}>{children}</KonteksSesiPembeli.Provider>
}
