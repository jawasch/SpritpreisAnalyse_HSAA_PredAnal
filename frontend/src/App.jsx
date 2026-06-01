import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
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
import GuidedTerminal        from './components/walkthrough/GuidedTerminal'
import PresentationMode      from './components/presentation/PresentationMode'
import { phaseForPath } from './content/phases'

const SHOW_SETUP = import.meta.env.VITE_SHOW_SETUP === 'true'

function AppShell() {
  const location = useLocation()
  const phase = phaseForPath(location.pathname)
  const [presenting, setPresenting] = useState(false)

  return (
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

      {/* Guided terminal — left-edge overlay drawer, one per phase page */}
      {phase && <GuidedTerminal key={phase} phase={phase} />}

      {/* Presentation toggle — right edge */}
      <button
        onClick={() => setPresenting(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] bg-brand-orange text-white text-[11px] font-mono tracking-wide px-1.5 py-3 rounded-l shadow-lg hover:bg-brand-charcoal transition-colors"
        style={{ writingMode: 'vertical-rl' }}
        title="Präsentationsmodus — Story für Daniel & Jannis"
      >
        ▶ Präsentation
      </button>

      <PresentationMode
        open={presenting}
        startPhase={phase || 'business'}
        onClose={() => setPresenting(false)}
      />
    </div>
  )
}

export default function App() {
  const [setupVisible, setSetupVisible] = useState(false)

  useEffect(() => {
    if (!SHOW_SETUP) return
    fetch('/api/v1/setup/status')
      .then(r => r.json())
      .then(data => {
        const hasMissing = data.components?.some(c => c.status === 'missing' && c.script)
        if (hasMissing) setSetupVisible(true)
      })
      .catch(() => {})
  }, [])

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell />
      {setupVisible && <Setup onDone={() => setSetupVisible(false)} />}
    </BrowserRouter>
  )
}
