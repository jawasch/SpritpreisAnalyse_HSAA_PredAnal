const STEPS = [
  '87 GB CSV-Dateien (parallel einlesen & filtern)',
  'Filterung auf 5 Stations-UUIDs',
  'Stündliche Aggregation je Station',
  'Vorwärtsfüllung fehlender Stunden',
  'Feature Engineering (101 Features)',
  'Normierung (StandardScaler)',
  'Zeitlicher Split: Train | Val | Test',
]

/** Verarbeitungs-Pipeline (PDF S.13) — 7 process boxes inside a big arrow. */
export default function PipelineDiagram() {
  return (
    <div className="w-full">
      <div className="flex items-stretch gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-stretch flex-1 min-w-0">
            <div className="flex-1 bg-white border border-gray-300 rounded-xl px-2 py-4 flex items-center justify-center text-center shadow-sm">
              <span className="text-[13px] leading-snug text-brand-charcoal/85">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center px-0.5 text-brand-orange text-xl shrink-0">→</div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-base font-semibold text-brand-charcoal">
        Betrachteter Zeitraum:{' '}
        <span className="font-mono">2014-06-08 09:00:00 → 2026-05-20 20:00:00</span>
      </p>
    </div>
  )
}
