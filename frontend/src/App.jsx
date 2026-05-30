import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Stations from './pages/Stations'
import Analytics from './pages/Analytics'
import Predictions from './pages/Predictions'
import GeoViz from './pages/GeoViz'
import Notebooks from './pages/Notebooks'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/geo" element={<GeoViz />} />
            <Route path="/notebooks" element={<Notebooks />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
