# Spritpreisvorhersage

## Motivation


## Business-Kontext
Ein Spediteur möchte den optimalen Zeitpunkt für das Betanken seiner LKW-Flotte finden. 
Das Unternehmen besitzt 25 LKWs. 
Ein LKW hat einen durchschnittlichen Verbrauch von 30 Litern / 100 km und eine Fahrleistung je Fahrzeug von 500 km / Tag. 
In einem Tag verbraucht die Flotte somit rund 3750 Liter Diesel. 
Preiserhöhungen von wenigen Cent am Tag können so bereits zu dreistelligen Verlusten führen.

\* Zahlen sind typische Durchschnittswerte
## Ziel
Vorhersage von Spritpreisen in € als Regressionsproblem.

⚠️🚧🚧⚠️ Welche Vorhersage? also: nächster Zeitpunkt (t + 1h ?), Tagesdurchschnitt?, Minimum im nächsten Zeitraum (und wenn ja: in welchem?)

⚠️🚧🚧⚠️ Noch zu klären: "Vorhersage von Spritpreisen" vs. "Optimaler Tankzeitpunkt". Das ist nicht das gleiche! 
## Gewählter ML-Ansatz
Als Hauptansatz wurde ein **MLP-Regressor** gewählt.
- Laut Dozent erlaubt und mit dem Modul Predictive Analytics vereinbar
- geeignet für **nichtlineare Zusammenhänge**
- passend für **tabellarische Daten mit Feature Engineering**

## Feature Auswahl
- **Lag-Features** (\*Hinweis s.u.)
    - Preis vor 1 Stunde
    - Preis vor 3 Stunden
    - Preis vor 24 Stunden
- **Rolling Features**
    - gleitender Mittelwert über 6 Stunden
    - gleitender Mittelwert über 24 Stunden
- **Kalender-/Zeitmerkmale**
    - Stunde des Tages
    - Wochentag
- **optional externe Variable**
    - Rohölpreis / Brent-Preis

\* Hinweis: Das Modell ist **kein natives Zeitreihenmodell**.  
Daher muss die zeitliche Struktur **explizit über Features** abgebildet werden.
Das bedeutet:
- keine rohe Zeitreihe direkt in das Modell geben
- stattdessen gezieltes **Feature Engineering**

Politische Entscheidungen werden **nicht direkt modelliert**, da sie schwer operationalisierbar, kaum vorhersagbar und typischerweise bereits indirekt im Ölpreis eingepreist sind.

⚠️🚧🚧⚠️ Leakage-Risiko beachten: Gleitender Mittelwert nur über vergangene Daten
⚠️🚧🚧⚠️ Feature Scaling (`StandardScaler`) AUF JEDEN FALL NUTZEN!
⚠️🚧🚧⚠️ Tuning (ist gefordert). Parameter: `hidden_layer_sizes`, `alpha`, `learning_rate_init`


## Modellierungsansatz
Über `scikit-learn` unter der Verwendung von `MLPRegressor`.
**Geplante Architektur:**
- Input Layer: Anzahl der erzeugten Features (s.o.)
- Hidden Layer 1: **64 Neuronen**
- Hidden Layer 2: **32 Neuronen**
- Output Layer: **1 Neuron**, linear (Preis in €)

Ggf. `PyTorch` mit eigenem Feed-Forward-Netz mit `torch.nn` erstlellen (für Lernzwecke).

Train/Test Split über die Zeit (aus `sklearn`nutzen:`TimeSeriesSplit`)
## Evaluation
Vorgesehene Metriken:
- **MAE**
- **RMSE**
- **R²**
Wichtig ist die Interpretation im **Business-Kontext**, also z. B.:
- Wie groß ist der mittlere Fehler in Cent?
- Ist die Vorhersagequalität praktisch nutzbar?

## Vergleich mit zweitem Modell
⚠️🚧🚧⚠️ Notwendig, weil steht im Leitfaden!
