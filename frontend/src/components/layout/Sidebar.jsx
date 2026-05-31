import { NavLink } from 'react-router-dom'

const nav = [
  {
    to: '/',
    label: 'Datenexploration',
    icon: '🔍',
    step: '01',
    desc: 'Rohdaten · Ausreißer · Verteilungen',
  },
  {
    to: '/karte',
    label: 'Geo-Exploration',
    icon: '🗺️',
    step: '02',
    desc: 'Karte · Preise als Vektoren',
  },
  {
    to: '/analyse',
    label: 'Analyse',
    icon: '📡',
    step: '03',
    desc: 'Modell-Output · Raum-Zeit-Feld',
  },
  {
    to: '/modelle',
    label: 'Modellierung',
    icon: '🧠',
    step: '04',
    desc: 'B29 → Spedition → All-Germany',
  },
  {
    to: '/deployment',
    label: 'Deployment',
    icon: '🚛',
    step: '05',
    desc: 'Live-Dispatch · 72h-Prognose',
  },
  {
    to: '/notebooks',
    label: 'Notebooks',
    icon: '📓',
    step: '06',
    desc: 'Analyseergebnisse durchstöbern',
  },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-gray-900 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-base leading-tight">
          Spritpreis
          <br />
          <span className="text-blue-400 font-normal text-xs tracking-wide">
            Analytics · CRISP-DM
          </span>
        </span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ to, label, icon, step, desc }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-base shrink-0 mt-0.5">{icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono ${isActive ? 'text-blue-200' : 'text-gray-600'}`}>
                      {step}
                    </span>
                    <span className="truncate">{label}</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-blue-200' : 'text-gray-600'}`}>
                    {desc}
                  </p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">HS Aalen · Predictive Analytics</p>
        <p className="text-xs text-gray-600 mt-0.5">Daten: Tankerkönig API</p>
      </div>
    </aside>
  )
}
