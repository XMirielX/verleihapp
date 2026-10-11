# CSS-Aufbau

Die Anwendung lädt `style.css`. Diese Datei bündelt die Styles in dieser Reihenfolge:

| Datei | Zuständigkeit |
| --- | --- |
| `variables.css` | Farben, Statusfarben, Schriftgrößen, Abstände und Rundungen |
| `basis.css` | Allgemeine Buttons, Eingabefelder, Formularzeilen und Tabellen |
| `layout.css` | Seitenrahmen, Navigation, Kopfzeilen und Formulargruppen |
| `components.css` | Karten, Dialoge, Kameravorschau, Erfolgsmeldungen und Warnungen |
| `pages.css` | Verleih, Verteiler, Materialpreise, Rechnungsformulare und mobile Listen |
| `darkmode.css` | Anpassungen an das dunkle Farbschema des Betriebssystems |
| `mobile.css` | Mobile Navigation und abschließende responsive Anpassungen |

`invoice-print.css` wird separat für Rechnungs-PDFs geladen. Die A4-Maße und
Tabellenregeln gehören ausschließlich zum Drucklayout.

## Änderungen einordnen

- Gemeinsame Werte in `variables.css` definieren. Dunkle Farbwerte in `darkmode.css` überschreiben.
- Allgemeine Elemente in `basis.css`, wiederverwendbare Bausteine in `components.css` pflegen.
- Seitenspezifische Regeln in `pages.css` eintragen.
- Mobile Navigation in `mobile.css` pflegen. Mobile Listen sind in `pages.css` gebündelt.
- Für App und Listen liegt der mobile Breakpoint bei maximal 768 Pixeln.
- Die Import- und Regelreihenfolge erhalten: Spätere Regeln überschreiben frühere bei gleicher Spezifität.

Einige Rechnungs- und Kartenregeln in `mobile.css` überschreiben gezielt frühere
Regeln aus `pages.css`. Sie sind daher keine beliebig entfernbaren Duplikate.
