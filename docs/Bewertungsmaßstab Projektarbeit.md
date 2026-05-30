**Leitfaden für die Projektarbeit – Machine Learning**

**1. Zielkompetenz**
Die Studierenden sollen in der Lage sein, eine betriebswirtschaftliche Fragestellung
eigenständig in ein vollständiges Machine-Learning-Projekt zu überführen und praktisch umzusetzen.
Dabei werden folgende Kompetenzen entwickelt und geprüft:

• Überführung einer Business-Fragestellung in ein ML-Problem
• Datenbeschaffung, -aufbereitung und explorative Analyse
• Auswahl, Implementierung und Training eines Machine-Learning-Algorithmus
• **Verständliche und anschauliche Erklärung des gewählten Algorithmus**
• **Evaluation** und **kritische Bewertung der Ergebnisse**
• Nachvollziehbare und reproduzierbare Umsetzung in Python
• **Dokumentation** und **Präsentation** der Ergebnisse

**Wichtig:** Mindestens ein ML-Algorithmus (z. B. Entscheidungsbaum, logistische
Regression, SVM oder neuronale Netze) muss vollständig implementiert und verständlich
erklärt werden.

**2. Empfohlene Vorgehensweise (Projektablauf)**

**1. Themen- und Datenrecherche**

Recherchieren Sie geeignete Beispiele im Internet (z. B. Kaggle, OpenML,
wissenschaftliche Artikel oder Tutorials).
Wählen Sie:

• ein geeignetes Dataset
• eine konkrete Problemstellung mit Business-Bezug (z. B. Produktion, Kundenanalyse, Qualitätssicherung)

**2. Auswahl des Machine-Learning-Ansatzes**

Bestimmen Sie, welches ML-Verfahren zur Lösung geeignet ist bzw. in diesem Beispiel
eingesetzt wurde.

Typische Zuordnung:

• Klassifikation → z. B. Entscheidungsbaum, logistische Regression, SVM, Neuronale Netze
• Regression → z. B. lineare Regression, Random Forest Regressor

**3. Verständnis des Algorithmus**

Erklären Sie den gewählten Algorithmus verständlich und anschaulich:

• Wie funktioniert der Algorithmus grundsätzlich?
• Welche Annahmen werden getroffen?
• Welche Vor- und Nachteile gibt es?
• Warum ist der Algorithmus für dieses Problem geeignet?

Optional:
• Visualisierungen
• einfache Beispiele zur Illustration

**4. Praktische Umsetzung in Python**

Setzen Sie das Projekt vollständig in Python um:

• Daten laden und verstehen
• Daten bereinigen und vorbereiten
• Explorative Datenanalyse (EDA)
• Feature Engineering
• Training des Modells
• Hyperparameter-Tuning
• Evaluation der Ergebnisse
• Interpretation im Business-Kontext

Der Code muss reproduzierbar und gut kommentiert sein.

**5. Weiterentwicklung und Erweiterung**

Reflektieren Sie mögliche Erweiterungen des Projekts:

• Vergleich mehrerer ML-Modelle oder Modellparameter
• Verbesserung durch Feature Engineering
• Optimierung der Hyperparameter
• Umsetzung eines Dashboards (z. B. Streamlit) zur Visualisierung

**3. Struktur des Projekts im Detail (CRISP-DM orientiert)**

**1. Rolle im Unternehmen definieren**

• Wahl eines Unternehmensbereichs (z. B. Produktion, Marketing, HR, Controlling)
• Beschreibung der Branche und Aufgaben
• Relevante KPIs

**2. Betriebswirtschaftliche Fragestellung**

Formulieren Sie eine konkrete, datenbasierte Fragestellung, z. B.:

• Welche Kunden sind abwanderungsgefährdet?
• Wie kann die Ausfallwahrscheinlichkeit von Maschinen vorhergesagt werden?
• Wie lassen sich Kundenbewertungen automatisch klassifizieren?

Definition von:

• Ziel
• Business Impact
• Erfolgskriterien (z. B. Accuracy, Recall, Kostenersparnis)

**3. Analytische Problemstellung**

• Definition der Zielvariable
• Einordnung des Problemtyps (Klassifikation, Regression, etc.)
• Formulierung von Hypothesen

**4. Datengrundlage**

• Nutzung von Kaggle, OpenML oder synthetischen Daten
• Prüfung der Datenqualität
• Umgang mit fehlenden Werten und Ausreißern
• Berücksichtigung von Datenschutz und Ethik

**5. CRISP-DM Prozess**

**Business Understanding**

• Zieldefinition und Kontext

**Data Understanding**

• Explorative Datenanalyse
• Visualisierungen

**Data Preparation**

• Datenbereinigung
• Encoding
• Feature Engineering (mindestens 2–3 Schritte)

**Modeling**

• Auswahl und Training von Modellen
• Hyperparameter-Tuning
• Begründung der Modellwahl

• **Erklärung des Algorithmus**

**Evaluation**

• Metriken: Accuracy, Precision, Recall, F1, ROC-AUC etc.
• Interpretation im Business-Kontext

**Deployment (optional)**

• Überlegungen zur praktischen Anwendung
• z. B. Dashboard oder API

**6. Ergebnisdarstellung**

• Visualisierung der Ergebnisse (Plots, Tabellen, Confusion Matrix etc.)
• Interpretation im Business-Kontext
• Ableitung von Handlungsempfehlungen

**7. Python-Implementierung**

• Vollständig reproduzierbarer Code
• Klare Struktur entlang CRISP-DM
• Ausführliche Kommentierung
• Nachvollziehbarkeit sicherstellen

**4. Reflexion**

• Bewertung der Ergebnisse
• Grenzen des Modells
• mögliche Verbesserungen
• Ausblick auf Erweiterungen

**5. Abgabe und Präsentation**

**Abzugeben:**

• Präsentation (PPTX) mit:
o Problemstellung
o Vorgehen (CRISP-DM)
o Modell und Ergebnisse
o Interpretation und Business Impact

• Reproduzierbarer Python-Code
• Kurzdokumentation

**Abgabezeitpunkt:**

• spätestens **24 Stunden vor dem Präsentationstermin**

**Hinweis**

Die Qualität der Arbeit wird insbesondere durch folgende Aspekte bestimmt:

• Klarheit der Problemstellung
• Saubere Umsetzung des ML-Prozesses
• Verständliche Erklärung des Algorithmus
• Kritische Reflexion
• Praktische Nachvollziehbarkeit (Code + Ergebnisse)