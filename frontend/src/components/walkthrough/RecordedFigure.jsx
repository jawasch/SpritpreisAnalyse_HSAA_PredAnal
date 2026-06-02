import { api } from '../../services/api'

/**
 * Renders a recorded notebook/model figure (the canonical handout graph) from the
 * walkthrough assets. Hides itself gracefully if the figure hasn't been recorded yet.
 *
 * @param {string} name     file name in backend/app/walkthrough/recorded (e.g. "cv_folds.png")
 * @param {string} caption  short caption shown under the figure
 * @param {string} variant  "card" (white panel, default) | "bare" (image only, e.g. dark decks)
 */
export default function RecordedFigure({ name, caption, variant = 'card', className = '' }) {
  const src = api.walkthrough.assetUrl(`/api/v1/walkthrough-assets/${name}`)

  if (variant === 'bare') {
    return (
      <img
        src={src}
        alt={caption || name}
        className={`w-full rounded ${className}`}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }

  // "fit" — scale to fit the parent box (both dimensions), keep aspect ratio.
  // Used by wide presentation chart slides so the image fills without overflowing.
  if (variant === 'fit') {
    return (
      <img
        src={src}
        alt={caption || name}
        className={`max-h-full max-w-full w-auto h-auto object-contain rounded bg-white ${className}`}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }

  return (
    <figure className={`bg-white border border-gray-200 rounded p-2 ${className}`}>
      <img
        src={src}
        alt={caption || name}
        className="w-full rounded"
        onError={e => { e.currentTarget.closest('figure').style.display = 'none' }}
      />
      {caption && (
        <figcaption className="mt-1.5 text-[11px] text-gray-400 text-center">
          {caption} <span className="text-gray-300">· aus dem Notebook</span>
        </figcaption>
      )}
    </figure>
  )
}
