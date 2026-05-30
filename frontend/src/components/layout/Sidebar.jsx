import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/stations', label: 'Tankstellen', icon: '🗺️' },
  { to: '/analytics', label: 'Analyse', icon: '📈' },
  { to: '/predictions', label: 'Dispatch-Plan', icon: '🚛' },
  { to: '/geo', label: '3D Karte', icon: '🌐' },
  { to: '/notebooks', label: 'Notebooks', icon: '📓' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-gray-900 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-lg leading-tight">
          Spritpreis<br />
          <span className="text-blue-400 font-normal text-sm">Analytics</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
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
