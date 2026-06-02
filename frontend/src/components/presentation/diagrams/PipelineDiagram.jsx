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
    <div className="w-full h-full flex flex-col justify-center gap-10">
      <div className="flex items-stretch gap-2 flex-1 max-h-[55%]">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-stretch flex-1 min-w-0">
            <div className="flex-1 bg-white border-2 border-gray-300 rounded-2xl px-3 py-5 flex items-center justify-center text-center shadow-sm">
              <span className="text-base leading-snug text-brand-charcoal/90 font-medium">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center px-1 text-brand-orange text-3xl font-bold shrink-0">→</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xl font-semibold text-brand-charcoal shrink-0">
        Betrachteter Zeitraum:{' '}
        <span className="font-mono">2014-06-08 09:00:00 → 2026-05-20 20:00:00</span>
      </p>
    </div>
  )
}
