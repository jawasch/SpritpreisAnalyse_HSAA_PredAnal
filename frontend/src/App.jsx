import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import BusinessUnderstanding from './pages/BusinessUnderstanding'
import DataExploration       from './pages/DataExploration'
import Datenvorbereitung     from './pages/Datenvorbereitung'
import Modellierung          from './pages/Modellierung'
import Evaluation            from './pages/Evaluation'
import Deployment            from './pages/Deployment'
import Reflexion             from './pages/Reflexion'
import Notebooks             from './pages/Notebooks'
import Setup                 from './pages/Setup'

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
            <Route path="/"             element={<BusinessUnderstanding />} />
            <Route path="/exploration"  element={<DataExploration />} />
            <Route path="/vorbereitung" element={<Datenvorbereitung />} />
            <Route path="/modellierung" element={<Modellierung />} />
            <Route path="/evaluation"   element={<Evaluation />} />
            <Route path="/deployment"   element={<Deployment />} />
            <Route path="/reflexion"    element={<Reflexion />} />
            <Route path="/notebooks"    element={<Notebooks />} />
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
