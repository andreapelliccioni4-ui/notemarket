# NoteMarket — Marketplace di appunti universitari

Marketplace completo in stile Apple per la compravendita di appunti universitari di tutti gli atenei italiani.

## Avvio
```bash
cd notemarket
npm install
node seed.js      # solo la prima volta (dati demo)
node server.js    # http://localhost:3000
```

## Account demo
| Ruolo | Email | Password |
|---|---|---|
| Amministratore | admin@notemarket.it | admin123 |
| Venditore (Ing. PoliMi) | marco@demo.it | demo123 |
| Venditrice (Economia UniBo) | giulia@demo.it | demo123 |
| Venditrice (Medicina Sapienza) | sara@demo.it | demo123 |
| Venditore (Giurisprudenza UniPd) | luca@demo.it | demo123 |

## Funzionalità
- **Marketplace** — ricerca, filtri per università (70+ atenei italiani) e materia, ordinamenti, card con gradienti e icone SVG eleganti
- **Anteprima PDF** — sia in fase di caricamento (drag & drop) sia sulla pagina di dettaglio; il download completo è riservato a chi acquista
- **Carrello persistente** — salvato nel database, gli articoli restano anche dopo il logout
- **Dashboard venditore** — saldo, vendite, guadagni netti, gestione dei propri appunti
- **Recensioni verificate** — solo gli acquirenti possono recensire (1–5 stelle)
- **Profilo** — modifica dati e **immagine del profilo** (upload avatar)
- **Dashboard admin** — statistiche globali, **commissione della piattaforma modificabile**, gestione utenti (sospensione), transazioni recenti

## Stack
- **Backend:** Node.js, Express, better-sqlite3 (SQLite), Multer (upload), token auth (scrypt + bearer token)
- **Frontend:** SPA vanilla JS, design system in stile Apple (frosted glass, SF font stack, icone SVG line-style)
- **Database:** `notemarket.db` — utenti, appunti, carrello, acquisti, recensioni, impostazioni
