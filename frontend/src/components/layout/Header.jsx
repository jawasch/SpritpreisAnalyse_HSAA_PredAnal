import { useState } from 'react'
import { FUEL_LABELS } from '../../services/api'

export default function Header({ fuelType, onFuelTypeChange, title }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>

      {onFuelTypeChange && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {Object.entries(FUEL_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onFuelTypeChange(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                fuelType === key
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
