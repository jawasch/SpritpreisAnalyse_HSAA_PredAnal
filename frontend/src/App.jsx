import React from 'react'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🚗⛽ Spritpreis Analytics Dashboard</h1>
        <p>Transparente Spritpreis-Analyse und -Vorhersage</p>
      </header>
      
      <main className="app-main">
        <div className="welcome-section">
          <h2>Willkommen</h2>
          <p>Das Dashboard wird in Kürze verfügbar sein.</p>
          
          <div className="status-cards">
            <div className="status-card">
              <h3>Backend Status</h3>
              <p className="status pending">⏳ In Entwicklung</p>
            </div>
            
            <div className="status-card">
              <h3>Datenquellen</h3>
              <p className="status pending">⏳ Konfiguration ausstehend</p>
            </div>
            
            <div className="status-card">
              <h3>ML-Modelle</h3>
              <p className="status pending">⏳ Training ausstehend</p>
            </div>
          </div>
        </div>
        
        <div className="features-section">
          <h2>Geplante Features</h2>
          <ul>
            <li>📊 Echtzeit-Preisanalyse von 14.000+ Tankstellen</li>
            <li>🔮 Predictive Analytics für Preisentwicklungen</li>
            <li>⏰ Uhrzeitanalyse: Wann ist tanken am günstigsten?</li>
            <li>🗺️ Interaktive Karte mit Tankstellen</li>
            <li>📈 Rohölpreis-Korrelation</li>
            <li>🏛️ Policy Impact Analysis</li>
          </ul>
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Studienprojekt - Predictive Analytics | Hochschule Aalen</p>
      </footer>
    </div>
  )
}

export default App
