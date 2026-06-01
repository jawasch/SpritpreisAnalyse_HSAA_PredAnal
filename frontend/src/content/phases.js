/** The 7 CRISP-DM phases — shared by routing, the guided terminal and presentation mode. */
export const PHASES = [
  { key: 'business',   route: '/',             label: 'Business Understanding', n: '01' },
  { key: 'data',       route: '/exploration',  label: 'Data Understanding',     n: '02' },
  { key: 'prep',       route: '/vorbereitung', label: 'Data Preparation',       n: '03' },
  { key: 'modeling',   route: '/modellierung', label: 'Modeling',               n: '04' },
  { key: 'evaluation', route: '/evaluation',   label: 'Evaluation',             n: '05' },
  { key: 'deployment', route: '/deployment',   label: 'Deployment',             n: '06' },
  { key: 'reflexion',  route: '/reflexion',    label: 'Reflexion',              n: '07' },
]

export const phaseForPath = (path) => PHASES.find(p => p.route === path)?.key ?? null
export const phaseIndex   = (key)  => PHASES.findIndex(p => p.key === key)
