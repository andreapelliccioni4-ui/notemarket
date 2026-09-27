# 📱 Come mettere NoteMarket online (link permanente, gratis)

Il modo più semplice è **Render.com** (piano gratuito, niente carta di credito).
In 5 minuti avrai un link tipo `https://notemarket.onrender.com` che funziona
da qualsiasi telefono o computer, sempre.

## Opzione A — Render.com (consigliata)

1. **Crea un account gratuito** su https://render.com (puoi usare Google/GitHub).
2. **Carica il progetto su GitHub:**
   - Crea un repository nuovo su https://github.com/new (es. `notemarket`)
   - Carica tutti i file di questa cartella (puoi trascinarli dalla pagina
     "uploading an existing file" del repo). **Non serve** caricare
     `node_modules`, `notemarket.db` o il contenuto di `uploads/`.
3. Su Render: **New → Web Service** → collega il repository `notemarket`.
4. Render legge automaticamente `render.yaml`. Se te li chiede:
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free**
5. Premi **Deploy**. Dopo 2-3 minuti il sito è online al link che ti mostra
   Render, es. `https://notemarket.onrender.com`. Aprilo dal telefono. ✅

Al primo avvio il database si popola da solo con gli account demo:
- Admin: `admin@notemarket.it` / `admin123`
- Venditore: `marco@demo.it` / `demo123`
- Studentessa: `giulia@demo.it` / `demo123`

### ⚠️ Nota sul piano gratuito di Render
- Dopo 15 minuti di inattività il sito "si addormenta": la prima visita
  successiva impiega ~30 secondi a caricarsi, poi torna veloce.
- Il disco è temporaneo: a ogni nuovo deploy o riavvio il database riparte
  dai dati demo (gli appunti caricati dagli utenti si perdono). Per un uso
  reale serve un piano con disco persistente (7 $/mese) o un database esterno.

## Opzione B — Railway.app
1. Account su https://railway.app → **New Project → Deploy from GitHub repo**.
2. Railway rileva Node.js da solo; start command: `npm start`.
3. In Settings → Networking premi **Generate Domain** per avere il link pubblico.

## Opzione C — Un tuo server / VPS
```bash
npm install
npm start          # il sito ascolta sulla porta 3000 (o PORT)
```
Metti davanti un reverse proxy (Caddy/Nginx) con il tuo dominio e HTTPS.
