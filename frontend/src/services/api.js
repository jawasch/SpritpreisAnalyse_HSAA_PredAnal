import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data?.detail || err.message)
)

// Default location: Aalen (HS Aalen project area)
export const DEFAULT_LAT = 48.8375
export const DEFAULT_LNG = 10.0931

export const api = {
  stations: {
    nearby: (lat = DEFAULT_LAT, lng = DEFAULT_LNG, rad = 25, type = 'all', sort = 'dist') =>
      client.get('/api/v1/stations/nearby', { params: { lat, lng, rad, type, sort } }),
    detail: (id) => client.get(`/api/v1/stations/${id}`),
  },

  prices: {
    current: (ids) => client.get('/api/v1/prices/current', { params: { ids: ids.join(',') } }),
    history: (fuelType = 'e5', days = 30) =>
      client.get('/api/v1/prices/history', { params: { fuel_type: fuelType, days } }),
  },

  analytics: {
    heatmap: (fuelType = 'e5') =>
      client.get('/api/v1/analytics/heatmap', { params: { fuel_type: fuelType } }),
    bestTime: (fuelType = 'e5') =>
      client.get('/api/v1/analytics/best-time', { params: { fuel_type: fuelType } }),
    geoTimeseries: (fuelType = 'diesel', date = null, interval = 'hour', region = 'bw', scenario = 'all') =>
      client.get('/api/v1/analytics/geo/timeseries', {
        params: { fuel_type: fuelType, ...(date && { date }), interval, region, scenario },
      }),
  },

  predictions: {
    shortTerm: (fuelType = 'e5', hours = 72) =>
      client.get('/api/v1/predictions/short-term', { params: { fuel_type: fuelType, hours } }),
    spedition: () => client.get('/api/v1/predictions/spedition'),
    b29: () => client.get('/api/v1/predictions/b29'),
  },

  notebooks: {
    list: () => client.get('/api/v1/notebooks'),
    html: (name) => client.get(`/api/v1/notebooks/${encodeURIComponent(name)}/html`),
  },
}

export const FUEL_LABELS = { e5: 'E5', e10: 'E10', diesel: 'Diesel' }
export const FUEL_COLORS = { e5: '#3b82f6', e10: '#8b5cf6', diesel: '#f59e0b' }
export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const STATION_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e']
