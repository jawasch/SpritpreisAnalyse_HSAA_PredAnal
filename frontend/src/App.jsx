import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import DataExploration from './pages/DataExploration'
import GeoExploration  from './pages/GeoExploration'
import Analyse         from './pages/Analyse'
import Modellierung    from './pages/Modellierung'
import Deployment      from './pages/Deployment'
import Notebooks       from './pages/Notebooks'
import Setup           from './pages/Setup'

const SHOW_SETUP = import.meta.env.VITE_SHOW_SETUP === 'true'

export default function App() {
  const [setupVisible, setSetupVisible] = useState(false)

  useEffect(() => {
    if (!SHOW_SETUP) return
    // Check if any scriptable components are missing
    fetch('/api/v1/setup/status')
      .then(r => r.json())
      .then(data => {
        const hasMissing = data.components?.some(
          c => c.status === 'missing' && c.script
        )
        if (hasMissing) setSetupVisible(true)
      })
      .catch(() => {})
  }, [])

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex h-screen overflow-hidden bg-brand-cream">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/"           element={<DataExploration />} />
            <Route path="/karte"      element={<GeoExploration />} />
            <Route path="/analyse"    element={<Analyse />} />
            <Route path="/modelle"    element={<Modellierung />} />
            <Route path="/deployment" element={<Deployment />} />
            <Route path="/notebooks"  element={<Notebooks />} />
          </Routes>
        </main>
      </div>

      {/* Setup overlay — only shown when VITE_SHOW_SETUP=true and data is missing */}
      {setupVisible && (
        <Setup onDone={() => setSetupVisible(false)} />
      )}
    </BrowserRouter>
  )
}
