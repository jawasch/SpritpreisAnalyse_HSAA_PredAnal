import { NavLink } from 'react-router-dom'
import PixelPattern from '../ui/PixelPattern'

const nav = [
  { to: '/',             label: 'Business',          step: '01', desc: 'Problem · Einsparpotenzial · Ziele'       },
  { to: '/exploration',  label: 'Datenexploration',  step: '02', desc: 'Quelle · Karte · Muster'                  },
  { to: '/vorbereitung', label: 'Datenvorbereitung', step: '03', desc: '101 Features · Split · Normierung'        },
  { to: '/modellierung', label: 'Modellierung',      step: '04', desc: 'MLP · Architektur · Cross-Validation'     },
  { to: '/evaluation',   label: 'Evaluation',        step: '05', desc: 'Metriken · Test · Impact'                 },
  { to: '/deployment',   label: 'Deployment',        step: '06', desc: 'Live-Dispatch · 72h-Prognose'             },
  { to: '/reflexion',    label: 'Reflexion',         step: '07', desc: 'Kurskorrektur · Grenzen · Ausblick'       },
  { to: '/notebooks',    label: 'Notebooks',         step: '·',  desc: 'Die vier Projekt-Notebooks'               },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-brand-charcoal min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <span className="block text-white font-bold text-lg leading-tight tracking-tight">
          Spritpreis
        </span>
        <span className="block text-brand-orange text-[10px] font-mono uppercase tracking-widest mt-0.5">
          CRISP-DM · Analytics
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        {nav.map(({ to, label, step, desc }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex items-stretch transition-colors ${
                isActive
                  ? 'bg-brand-orange'
                  : 'hover:bg-white/8'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Step number column */}
                <span className={`w-10 shrink-0 flex items-center justify-center text-xs font-bold font-mono border-r ${
                  isActive
                    ? 'text-white/80 border-white/20'
                    : 'text-white/20 border-white/8 group-hover:text-white/40'
                }`}>
                  {step}
                </span>
                {/* Label + desc */}
                <div className="px-3 py-2.5 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white/80'}`}>
                    {label}
                  </p>
                  <p className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-white/70' : 'text-white/25 group-hover:text-white/40'}`}>
                    {desc}
                  </p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer with pixel pattern */}
      <div className="relative overflow-hidden border-t border-white/10">
        <div className="px-4 py-3 relative z-10">
          <p className="text-[10px] text-white/30 font-mono">HS Aalen · SoSe 2026</p>
          <p className="text-[10px] text-white/20 font-mono">Tankerkönig API</p>
        </div>
        <PixelPattern
          color1="rgba(255,255,255,0.06)"
          color2="transparent"
          size={24}
          steps={4}
          className="absolute bottom-0 right-0"
        />
      </div>
    </aside>
  )
}
