# Datenstruktur:
Beginnend ab 2014-06-08
```plain
tankerkoenig-data
├── prices
│   ├── 2014
│   │   ├── 06
│   │   ├── 07
│   │   ├── 08
│   │   ├── 09
│   │   ├── 10
│   │   ├── 11
│   │   └── 12
│   ├── 2015
│       ├── 01
│       ├── 02
│       ├── ...
│
└── stations
    ├── 2019
    │   ├── 01
    │   ├── 02
    │   ├── 03
    │   ├── 04
    │   ├── 05
    │   ├── 06
    │   ├── 07
    │   ├── 08
    │   ├── 09
    │   ├── 10
    │   ├── 11
    │   └── 12
    ├── 2020
    │   ├── 01
    │   ├── 02
    │   ├── ...


257 directories
```



# Preise

Im Verzeichnis _prices_ sind alle Preisänderungen aller Tankstellen in jeweils einer CSV-Datei pro Tag protokolliert.

Felder im CSV-Header:
`date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change`

Bedeutung der Felder

| Feld         | Bedeutung                                       |
| ------------ | ----------------------------------------------- |
| date         | Änderungszeitpunkt                              |
| station_uuid | UUID der Tankstelle aus `stations`              |
| diesel       | Preis Diesel                                    |
| e5           | Preis Super E5                                  |
| e10          | Preis Super E10                                 |
| dieselchange | 0=keine Änderung, 1=Änderung, 2=Entfernt, 3=Neu |
| e5change     | 0=keine Änderung, 1=Änderung, 2=Entfernt, 3=Neu |
| e10change    | 0=keine Änderung, 1=Änderung, 2=Entfernt, 3=Neu |

# Tankstellen

Im Verzeichnis _stations_ sind alle Tankstellen in einer CSV-Datei aufgeführt.
Da sich die Tankstellenliste ändert, wird sie täglich in ein Verzeichnis stations/JAHR/MONAT/ exportiert
Felder im CSV-Header:
`uuid,name,brand,street,house_number,post_code,city,latitude,longitude`

Bedeutung:

|Feld |Bedeutung |
|-----------------|-----------------------------------------------|
|uuid |UUID der Tankstelle, matcht mit den Preisen |
|name |Tankstellenname |
|brand |Marke |
|street |Straße |
|post_code |Postleitzahl |
|city |Stadt |
|latitude |geogr. Breite |
|longitude |geogr. Länge |
|first_active |erstes Auftauchen |
|openingtimes_json|Öffnungszeiten als JSON |

# openingtimes_json
applicable_days: die Tage, an denen diese Öffnungszeit gültig ist, binär kodiert - ein Byte.

|Wert |Bedeutung |
|-----------------|-----------------------------------------------|
|1|Montag|
|2|Dienstag|
|4|Mittwoch|
|8|Donnerstag|
|16|Freitag|
|32|Samstag|
|64|Sonntag|
|128|Feiertag|

Bsp:
* Montag - Freitag = 31 (1 + 2 + 4 + 8 + 16)
* Sa/So = 96 (32 + 64)
* Feiertags = 128

# Zuordnung
Jede Tankstelle ist eindeutig über eine UUID identifiziert. In den Preisdaten wird diese UUID referenziert.



# Beispiel-exzerpte


## Tankstellen:
Aus `tankerkoenig-data/stations/stations.csv`:
```csv
uuid,name,brand,street,house_number,post_code,city,latitude,longitude
00060723-0001-4444-8888-acdc00000001,BAGeno Raiffeisen eG,"",Künzelsauer Strasse,7,74653,Ingelfingen ,49.296821594238,9.6613845825195
005056ba-7cb6-1ed2-bceb-5332ab168d12,famila Tankstelle,FAMILA,Pascalstrasse,9,25442,Quickborn,53.74215,9.94124
005056ba-7cb6-1ed2-bceb-573c18314d16,star Tankstelle,STAR,Riehler Strasse,240,50735,Köln,50.9618,6.98007
```

## Preise:
aus `tankerkoenig-data/stations/2026/04/2026-04-30-stations.csv`
```csv
date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change
2026-04-30 00:00:44+02,611addb1-9986-49ce-b16b-76f4d8774da3,0.000,0.000,0.000,2,2,2
2026-04-30 00:00:44+02,44014c36-d54d-4ddc-8c88-85bec2e89c41,2.169,2.129,2.069,0,1,1
2026-04-30 00:01:44+02,94f40322-c44c-49fc-a191-cfb01f42f250,2.099,2.109,2.049,1,1,1
2026-04-30 00:01:44+02,ef2023d8-1373-4896-89d7-92b01375a28c,2.159,2.099,0.000,0,0,2
2026-04-30 00:01:44+02,ed2ce91a-60b2-44ce-adba-465622164011,2.109,2.079,2.019,1,1,1
```
