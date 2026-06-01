/**
 * Number formatting — single source of truth.
 *
 * The dashboard mixes large counts (66.159) and small prices (1,629 €/L). With the
 * German convention (thousands ".", decimal ",") a bare "1.234" is ambiguous. To keep
 * the two unmistakable we use:
 *   • decimal separator : comma         → prices always carry a comma  (1,629)
 *   • thousands separator: thin space   → counts never look like decimals (66 159)
 */

const THIN = ' ' // narrow no-break space, used as thousands separator

/** Group the integer part with thin-space thousands separators. */
function groupThousands(intStr) {
  const neg = intStr.startsWith('-')
  const digits = neg ? intStr.slice(1) : intStr
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN)
  return neg ? '-' + grouped : grouped
}

/**
 * Format a plain number: thin-space thousands, comma decimals.
 * @param {number} value
 * @param {number} decimals  fixed number of decimal places (default 0)
 */
export function formatNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return '–'
  const fixed = Math.abs(value).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  let out = groupThousands(intPart)
  if (decPart) out += ',' + decPart
  return (value < 0 ? '-' : '') + out
}

/** Fuel price in €/L with comma decimals (default 3 places): 1,629. */
export function formatPrice(value, decimals = 3) {
  return formatNumber(value, decimals)
}

/** Price with a € suffix: "1,629 €/L". */
export function formatEuroPrice(value, decimals = 3, unit = '€/L') {
  if (value == null || Number.isNaN(value)) return '–'
  return `${formatNumber(value, decimals)} ${unit}`
}

/** Euro amount (money), default 2 decimals: "19 300,00 €" / "€ 77,17". */
export function formatEuro(value, decimals = 2, { symbolFirst = false } = {}) {
  if (value == null || Number.isNaN(value)) return '–'
  const n = formatNumber(value, decimals)
  return symbolFirst ? `€ ${n}` : `${n} €`
}

/** Cents per litre from a €/L value: formatCt(0.0793) → "7,93". */
export function formatCt(valueEur, decimals = 2) {
  if (valueEur == null || Number.isNaN(valueEur)) return '–'
  return formatNumber(valueEur * 100, decimals)
}

/** Percentage: formatPct(0.46, 1) → "46,0 %". Pass already-percent with isFraction=false. */
export function formatPct(value, decimals = 1, isFraction = true) {
  if (value == null || Number.isNaN(value)) return '–'
  return `${formatNumber(isFraction ? value * 100 : value, decimals)} %`
}
