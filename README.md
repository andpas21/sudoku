# Sudoku

Web app (PWA) di sudoku, installabile su iPhone.

- 4 livelli: Facile (1 pt), Medio (3 pt), Difficile (5 pt), Esperto (10 pt)
- Cronometro, fino a 3 aiuti per partita (ogni aiuto toglie 1 punto)
- "Mi arrendo": mostra la soluzione, 0 punti
- Classifica (per ora locale) e profilo con statistiche

## Provarla in locale

    python3 -m http.server 8000

poi apri http://localhost:8000

## Installarla su iPhone

Servita via HTTPS: Safari → Condividi → Aggiungi alla schermata Home.

## Struttura

- `engine.js` generatore/solver (soluzione sempre unica)
- `app.js` interfaccia, punteggi, statistiche, storage (oggetto `Store`)
- `sw.js` + `manifest.webmanifest` supporto offline e installazione
