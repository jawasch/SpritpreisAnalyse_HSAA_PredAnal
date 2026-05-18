# Spritpreisvorhersage

## Business-Kontext
Ein Spediteur möchte den optimalen Zeitpunkt für das Betanken seiner LKW-Flotte finden. 
Das Unternehmen besitzt 25 LKWs. 
Ein LKW hat einen durchschnittlichen Verbrauch von 30 Litern / 100 km und eine Fahrleistung je Fahrzeug von 500 km / Tag. 
In einem Tag verbraucht die Flotte somit rund 3750 Liter Diesel. 
Preiserhöhungen von wenigen Cent am Tag können so bereits zu dreistelligen Verlusten führen.

\* Zahlen sind typische Durchschnittswerte
## Ziel
Vorhersage von Spritpreisen in € als Regressionsproblem.

Vorhersagbarer Zeithorizont sollen 48 h sein. Innnerhalb dieser Zeitspanne soll das lokale Minimum des Preises gefunden und ausgegeben werden. 


## Gewählter ML-Ansatz
Als Hauptansatz wurde ein **MLP-Regressor** gewählt.
- Laut Dozent erlaubt und mit dem Modul Predictive Analytics vereinbar
- geeignet für **nichtlineare Zusammenhänge**
- passend für **tabellarische Daten mit Feature Engineering**

## Feature Auswahl
- **Lag-Features (exemplarisch)**
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

Politische Entscheidungen könnten in einem weiter gedachten extra Projektansatz durch erweiterte Pipelines zukünftig in diese Vorhersagen mit einfließen, da sie schwer operationalisierbar, bedingt vorhersagbar und typischerweise bereits indirekt im Ölpreis eingepreist sind, wird in diesem Projekt der Fokus auf den Einfluss des Rohölpreises zurückgegriffen.

## Modellierungsansatz
Über `scikit-learn` unter der Verwendung von `MLPRegressor`.
Train/Test Split über die Zeit (aus `sklearn`nutzen:`TimeSeriesSplit`)