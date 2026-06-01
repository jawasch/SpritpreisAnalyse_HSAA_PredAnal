import FlottenKalkulator from '../../deployment/FlottenKalkulator'

/**
 * Interactive cost feature for the deck: the same fleet-cost calculator from the
 * Deployment page. The presenter can move the sliders live to show how the
 * model's ~2 ct/L edge scales with fleet size and daily consumption.
 */
export default function DeploymentCalcEmbed() {
  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <FlottenKalkulator defaultTrucks={25} defaultDailyLiters={150} savingsPerLiter={0.02} />
      <p className="text-sm text-brand-charcoal/60 max-w-3xl">
        Basis: Ø Spread günstigste ↔ teuerste Station 7,93 ct/L · Pick-Accuracy 46 %.
        MLP-Routing spart gegenüber Zufalls-Disposition ≈ 77 €/Tag ≈ 19 300 €/Jahr für die Flotte.
      </p>
    </div>
  )
}
