/* NoteMarket — Marketplace di appunti universitari
   Backend: Express + better-sqlite3 */
const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const UP_NOTES = path.join(ROOT, 'uploads', 'notes');
const UP_AVATARS = path.join(ROOT, 'uploads', 'avatars');
fs.mkdirSync(UP_NOTES, { recursive: true });
fs.mkdirSync(UP_AVATARS, { recursive: true });

const db = new Database(path.join(ROOT, 'notemarket.db'));
db.pragma('journal_mode = WAL');

/* ---------------- Schema ---------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'user',           -- user | admin
  university TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  balance REAL DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  university TEXT NOT NULL,
  course TEXT DEFAULT '',
  subject TEXT NOT NULL,
  price REAL NOT NULL,
  pages INTEGER DEFAULT 0,
  year TEXT DEFAULT '',
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating_sum REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cart_items (
  user_id INTEGER NOT NULL,
  note_id INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, note_id)
);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL,
  note_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  price REAL NOT NULL,
  commission REAL NOT NULL,
  seller_net REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  comment TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(note_id, user_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('commission_pct','15')`).run();

/* ---------------- Helpers ---------------- */
const hashPass = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const getCommission = () => parseFloat(db.prepare(`SELECT value FROM settings WHERE key='commission_pct'`).get().value);

function publicUser(u) {
  if (!u) return null;
  const { pass_hash, salt, ...rest } = u;
  return rest;
}

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (token) {
      const row = db.prepare(`SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=?`).get(token);
      if (row && !row.blocked) { req.user = row; req.token = token; return next(); }
    }
    if (required) return res.status(401).json({ error: 'Non autenticato' });
    next();
  };
}
const adminOnly = (req, res, next) =>
  req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Accesso riservato agli amministratori' });

/* ---------------- Uploads ---------------- */
const noteStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UP_NOTES),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + '.pdf'),
});
const uploadNote = multer({
  storage: noteStorage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Sono ammessi solo file PDF')),
});
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UP_AVATARS),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname || '.png')),
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Formato immagine non valido')),
});

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/avatars', express.static(UP_AVATARS));

/* ---------------- Università italiane ---------------- */
const UNIVERSITIES = [
  'Sapienza Università di Roma','Università di Bologna','Università degli Studi di Milano','Politecnico di Milano',
  'Politecnico di Torino','Università degli Studi di Torino','Università degli Studi di Padova','Università degli Studi di Firenze',
  'Università degli Studi di Napoli Federico II','Università di Pisa','Università degli Studi Roma Tre','Università degli Studi di Roma Tor Vergata',
  'Università Cattolica del Sacro Cuore','Università Commerciale Luigi Bocconi','Università degli Studi di Genova','Università degli Studi di Bari Aldo Moro',
  'Università degli Studi di Palermo','Università degli Studi di Catania','Università degli Studi di Verona','Università Ca\' Foscari Venezia',
  'Università degli Studi di Trento','Università degli Studi di Trieste','Università degli Studi di Pavia','Università degli Studi di Parma',
  'Università degli Studi di Modena e Reggio Emilia','Università degli Studi di Ferrara','Università degli Studi di Siena','Università degli Studi di Perugia',
  'Università Politecnica delle Marche','Università degli Studi di Salerno','Università degli Studi di Cagliari','Università degli Studi di Sassari',
  'Università degli Studi di Messina','Università della Calabria','Università degli Studi di Brescia','Università degli Studi di Bergamo',
  'Università degli Studi Milano-Bicocca','Università degli Studi dell\'Insubria','Università del Salento','Università degli Studi di Udine',
  'Università degli Studi dell\'Aquila','Università degli Studi G. d\'Annunzio Chieti-Pescara','Università degli Studi di Macerata','Università degli Studi di Camerino',
  'Università degli Studi di Urbino Carlo Bo','Università per Stranieri di Perugia','Università per Stranieri di Siena','Libera Università di Bolzano',
  'Università degli Studi di Foggia','Università degli Studi della Basilicata','Università degli Studi Magna Græcia di Catanzaro','Università Mediterranea di Reggio Calabria',
  'Università degli Studi del Molise','Università degli Studi di Teramo','Università degli Studi della Tuscia','Università degli Studi di Cassino e del Lazio Meridionale',
  'Università Campania Luigi Vanvitelli','Università degli Studi di Napoli L\'Orientale','Università degli Studi di Napoli Parthenope','Università degli Studi del Sannio',
  'LUISS Guido Carli','LUMSA Università','Università Vita-Salute San Raffaele','Humanitas University',
  'Università Carlo Cattaneo LIUC','Università IULM','Scuola Normale Superiore di Pisa','Scuola Superiore Sant\'Anna',
  'Università del Piemonte Orientale','Università della Valle d\'Aosta','Università Kore di Enna','Università Europea di Roma',
];
const SUBJECTS = [
  'Analisi Matematica','Fisica','Chimica','Informatica','Economia','Diritto Privato','Diritto Costituzionale','Anatomia',
  'Fisiologia','Biologia','Statistica','Microeconomia','Macroeconomia','Storia','Filosofia','Letteratura Italiana',
  'Ingegneria del Software','Elettrotecnica','Meccanica','Scienza delle Costruzioni','Psicologia','Sociologia',
  'Marketing','Contabilità e Bilancio','Farmacologia','Lingua Inglese','Architettura','Algoritmi e Strutture Dati',
];

/* ---------------- Auth API ---------------- */
app.post('/api/register', (req, res) => {
  const { name, email, password, university } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  if (password.length < 6) return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email non valida' });
  const salt = crypto.randomBytes(16).toString('hex');
  try {
    const info = db.prepare(`INSERT INTO users (name,email,pass_hash,salt,university) VALUES (?,?,?,?,?)`)
      .run(name.trim(), email.toLowerCase().trim(), hashPass(password, salt), salt, university || '');
    const token = newToken();
    db.prepare(`INSERT INTO tokens (token,user_id) VALUES (?,?)`).run(token, info.lastInsertRowid);
    const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(info.lastInsertRowid);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ error: 'Email già registrata' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare(`SELECT * FROM users WHERE email=?`).get((email || '').toLowerCase().trim());
  if (!u || hashPass(password || '', u.salt) !== u.pass_hash)
    return res.status(401).json({ error: 'Credenziali non valide' });
  if (u.blocked) return res.status(403).json({ error: 'Account sospeso' });
  const token = newToken();
  db.prepare(`INSERT INTO tokens (token,user_id) VALUES (?,?)`).run(token, u.id);
  res.json({ token, user: publicUser(u) });
});

app.post('/api/logout', auth(), (req, res) => {
  db.prepare(`DELETE FROM tokens WHERE token=?`).run(req.token);
  res.json({ ok: true });
});

app.get('/api/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

app.put('/api/me', auth(), (req, res) => {
  const { name, university, bio } = req.body || {};
  db.prepare(`UPDATE users SET name=COALESCE(?,name), university=COALESCE(?,university), bio=COALESCE(?,bio) WHERE id=?`)
    .run(name, university, bio, req.user.id);
  res.json({ user: publicUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id)) });
});

app.post('/api/me/avatar', auth(), uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessuna immagine caricata' });
  const old = req.user.avatar;
  db.prepare(`UPDATE users SET avatar=? WHERE id=?`).run('/avatars/' + req.file.filename, req.user.id);
  if (old && old.startsWith('/avatars/')) {
    try { fs.unlinkSync(path.join(UP_AVATARS, path.basename(old))); } catch {}
  }
  res.json({ user: publicUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id)) });
});

/* ---------------- Dati statici ---------------- */
app.get('/api/meta', (req, res) => {
  res.json({ universities: UNIVERSITIES, subjects: SUBJECTS, commission_pct: getCommission() });
});

/* ---------------- Notes API ---------------- */
const NOTE_SELECT = `
  SELECT n.*, u.name AS seller_name, u.avatar AS seller_avatar, u.university AS seller_university,
    CASE WHEN n.rating_count>0 THEN ROUND(n.rating_sum/n.rating_count,1) ELSE 0 END AS rating
  FROM notes n JOIN users u ON u.id = n.seller_id`;

app.get('/api/notes', (req, res) => {
  const { q, university, subject, sort, seller } = req.query;
  let sql = NOTE_SELECT + ' WHERE 1=1';
  const params = [];
  if (q) { sql += ` AND (n.title LIKE ? OR n.description LIKE ? OR n.course LIKE ? OR n.subject LIKE ?)`; const like = `%${q}%`; params.push(like, like, like, like); }
  if (university) { sql += ` AND n.university=?`; params.push(university); }
  if (subject) { sql += ` AND n.subject=?`; params.push(subject); }
  if (seller) { sql += ` AND n.seller_id=?`; params.push(seller); }
  const sorts = {
    recent: 'n.created_at DESC', price_asc: 'n.price ASC', price_desc: 'n.price DESC',
    popular: 'n.downloads DESC', rating: 'rating DESC',
  };
  sql += ` ORDER BY ${sorts[sort] || sorts.recent} LIMIT 200`;
  res.json({ notes: db.prepare(sql).all(...params) });
});

app.get('/api/notes/:id', auth(false), (req, res) => {
  const note = db.prepare(NOTE_SELECT + ' WHERE n.id=?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Appunti non trovati' });
  const reviews = db.prepare(`
    SELECT r.*, u.name AS user_name, u.avatar AS user_avatar FROM reviews r
    JOIN users u ON u.id=r.user_id WHERE r.note_id=? ORDER BY r.created_at DESC LIMIT 50`).all(note.id);
  let owned = false, inCart = false;
  if (req.user) {
    owned = req.user.id === note.seller_id ||
      !!db.prepare(`SELECT 1 FROM purchases WHERE buyer_id=? AND note_id=?`).get(req.user.id, note.id);
    inCart = !!db.prepare(`SELECT 1 FROM cart_items WHERE user_id=? AND note_id=?`).get(req.user.id, note.id);
  }
  res.json({ note, reviews, owned, inCart });
});

app.post('/api/notes', auth(), uploadNote.single('file'), (req, res) => {
  const { title, description, university, course, subject, price, pages, year } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'Carica un file PDF' });
  if (!title || !university || !subject || !price) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Compila titolo, università, materia e prezzo' });
  }
  const p = parseFloat(price);
  if (isNaN(p) || p < 0.5 || p > 200) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Prezzo tra 0,50 € e 200 €' }); }
  const info = db.prepare(`
    INSERT INTO notes (seller_id,title,description,university,course,subject,price,pages,year,file_path,file_size)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, title.trim(), description || '', university, course || '', subject, p,
      parseInt(pages) || 0, year || '', req.file.filename, req.file.size);
  res.json({ note: db.prepare(NOTE_SELECT + ' WHERE n.id=?').get(info.lastInsertRowid) });
});

app.delete('/api/notes/:id', auth(), (req, res) => {
  const note = db.prepare(`SELECT * FROM notes WHERE id=?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Appunti non trovati' });
  if (note.seller_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Non autorizzato' });
  db.prepare(`DELETE FROM notes WHERE id=?`).run(note.id);
  db.prepare(`DELETE FROM cart_items WHERE note_id=?`).run(note.id);
  try { fs.unlinkSync(path.join(UP_NOTES, note.file_path)); } catch {}
  res.json({ ok: true });
});

/* Anteprima pubblica (PDF inline) — download completo solo dopo acquisto */
app.get('/api/notes/:id/preview', (req, res) => {
  const note = db.prepare(`SELECT * FROM notes WHERE id=?`).get(req.params.id);
  if (!note) return res.status(404).send('Non trovato');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="anteprima.pdf"');
  fs.createReadStream(path.join(UP_NOTES, note.file_path)).pipe(res);
});

app.get('/api/notes/:id/download', (req, res) => {
  const token = req.query.token || '';
  const trow = db.prepare(`SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=?`).get(token);
  if (!trow) return res.status(401).send('Non autenticato');
  const note = db.prepare(`SELECT * FROM notes WHERE id=?`).get(req.params.id);
  if (!note) return res.status(404).send('Non trovato');
  const owned = trow.id === note.seller_id || trow.role === 'admin' ||
    db.prepare(`SELECT 1 FROM purchases WHERE buyer_id=? AND note_id=?`).get(trow.id, note.id);
  if (!owned) return res.status(403).send('Acquista gli appunti per scaricarli');
  db.prepare(`UPDATE notes SET downloads=downloads+1 WHERE id=?`).run(note.id);
  res.download(path.join(UP_NOTES, note.file_path), note.title.replace(/[^\w\s\-]/g, '') + '.pdf');
});

/* ---------------- Recensioni ---------------- */
app.post('/api/notes/:id/reviews', auth(), (req, res) => {
  const { stars, comment } = req.body || {};
  const s = parseInt(stars);
  if (!s || s < 1 || s > 5) return res.status(400).json({ error: 'Valutazione da 1 a 5 stelle' });
  const bought = db.prepare(`SELECT 1 FROM purchases WHERE buyer_id=? AND note_id=?`).get(req.user.id, req.params.id);
  if (!bought) return res.status(403).json({ error: 'Puoi recensire solo appunti acquistati' });
  const existing = db.prepare(`SELECT * FROM reviews WHERE note_id=? AND user_id=?`).get(req.params.id, req.user.id);
  if (existing) {
    db.prepare(`UPDATE reviews SET stars=?, comment=? WHERE id=?`).run(s, comment || '', existing.id);
    db.prepare(`UPDATE notes SET rating_sum=rating_sum-?+? WHERE id=?`).run(existing.stars, s, req.params.id);
  } else {
    db.prepare(`INSERT INTO reviews (note_id,user_id,stars,comment) VALUES (?,?,?,?)`).run(req.params.id, req.user.id, s, comment || '');
    db.prepare(`UPDATE notes SET rating_sum=rating_sum+?, rating_count=rating_count+1 WHERE id=?`).run(s, req.params.id);
  }
  res.json({ ok: true });
});

/* ---------------- Carrello (persistente su DB) ---------------- */
app.get('/api/cart', auth(), (req, res) => {
  const items = db.prepare(NOTE_SELECT + `
    JOIN cart_items c ON c.note_id = n.id WHERE c.user_id=? ORDER BY c.added_at DESC`).all(req.user.id);
  res.json({ items, total: items.reduce((s, i) => s + i.price, 0) });
});

app.post('/api/cart', auth(), (req, res) => {
  const note = db.prepare(`SELECT * FROM notes WHERE id=?`).get(req.body.note_id);
  if (!note) return res.status(404).json({ error: 'Appunti non trovati' });
  if (note.seller_id === req.user.id) return res.status(400).json({ error: 'Non puoi acquistare i tuoi appunti' });
  if (db.prepare(`SELECT 1 FROM purchases WHERE buyer_id=? AND note_id=?`).get(req.user.id, note.id))
    return res.status(400).json({ error: 'Hai già acquistato questi appunti' });
  db.prepare(`INSERT OR IGNORE INTO cart_items (user_id,note_id) VALUES (?,?)`).run(req.user.id, note.id);
  res.json({ ok: true, count: db.prepare(`SELECT COUNT(*) c FROM cart_items WHERE user_id=?`).get(req.user.id).c });
});

app.delete('/api/cart/:noteId', auth(), (req, res) => {
  db.prepare(`DELETE FROM cart_items WHERE user_id=? AND note_id=?`).run(req.user.id, req.params.noteId);
  res.json({ ok: true, count: db.prepare(`SELECT COUNT(*) c FROM cart_items WHERE user_id=?`).get(req.user.id).c });
});

app.post('/api/checkout', auth(), (req, res) => {
  const items = db.prepare(`
    SELECT n.* FROM cart_items c JOIN notes n ON n.id=c.note_id WHERE c.user_id=?`).all(req.user.id);
  if (!items.length) return res.status(400).json({ error: 'Il carrello è vuoto' });
  const pct = getCommission();
  const tx = db.transaction(() => {
    for (const n of items) {
      const commission = +(n.price * pct / 100).toFixed(2);
      const net = +(n.price - commission).toFixed(2);
      db.prepare(`INSERT INTO purchases (buyer_id,note_id,seller_id,price,commission,seller_net) VALUES (?,?,?,?,?,?)`)
        .run(req.user.id, n.id, n.seller_id, n.price, commission, net);
      db.prepare(`UPDATE users SET balance=balance+? WHERE id=?`).run(net, n.seller_id);
    }
    db.prepare(`DELETE FROM cart_items WHERE user_id=?`).run(req.user.id);
  });
  tx();
  res.json({ ok: true, purchased: items.length, total: items.reduce((s, i) => s + i.price, 0) });
});

/* ---------------- Acquisti & Dashboard venditore ---------------- */
app.get('/api/purchases', auth(), (req, res) => {
  const rows = db.prepare(`
    SELECT p.id AS purchase_id, p.price AS paid, p.created_at AS purchased_at, n.*, u.name AS seller_name
    FROM purchases p JOIN notes n ON n.id=p.note_id JOIN users u ON u.id=n.seller_id
    WHERE p.buyer_id=? ORDER BY p.created_at DESC`).all(req.user.id);
  res.json({ purchases: rows });
});

app.get('/api/dashboard', auth(), (req, res) => {
  const uid = req.user.id;
  const myNotes = db.prepare(NOTE_SELECT + ` WHERE n.seller_id=? ORDER BY n.created_at DESC`).all(uid);
  const sales = db.prepare(`
    SELECT p.*, n.title, u.name AS buyer_name FROM purchases p
    JOIN notes n ON n.id=p.note_id JOIN users u ON u.id=p.buyer_id
    WHERE p.seller_id=? ORDER BY p.created_at DESC LIMIT 100`).all(uid);
  const stats = db.prepare(`
    SELECT COUNT(*) AS total_sales, COALESCE(SUM(seller_net),0) AS earnings, COALESCE(SUM(commission),0) AS fees
    FROM purchases WHERE seller_id=?`).get(uid);
  res.json({ notes: myNotes, sales, stats, balance: db.prepare(`SELECT balance FROM users WHERE id=?`).get(uid).balance });
});

/* ---------------- Admin ---------------- */
app.get('/api/admin/stats', auth(), adminOnly, (req, res) => {
  const s = {
    users: db.prepare(`SELECT COUNT(*) c FROM users`).get().c,
    notes: db.prepare(`SELECT COUNT(*) c FROM notes`).get().c,
    sales: db.prepare(`SELECT COUNT(*) c FROM purchases`).get().c,
    volume: db.prepare(`SELECT COALESCE(SUM(price),0) v FROM purchases`).get().v,
    commission_earned: db.prepare(`SELECT COALESCE(SUM(commission),0) v FROM purchases`).get().v,
    commission_pct: getCommission(),
  };
  const recentSales = db.prepare(`
    SELECT p.*, n.title, b.name AS buyer_name, s.name AS seller_name FROM purchases p
    JOIN notes n ON n.id=p.note_id JOIN users b ON b.id=p.buyer_id JOIN users s ON s.id=p.seller_id
    ORDER BY p.created_at DESC LIMIT 20`).all();
  res.json({ stats: s, recentSales });
});

app.get('/api/admin/users', auth(), adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id,name,email,role,university,avatar,balance,blocked,created_at,
      (SELECT COUNT(*) FROM notes WHERE seller_id=users.id) AS notes_count,
      (SELECT COUNT(*) FROM purchases WHERE buyer_id=users.id) AS purchases_count
    FROM users ORDER BY created_at DESC`).all();
  res.json({ users });
});

app.put('/api/admin/users/:id/block', auth(), adminOnly, (req, res) => {
  const u = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Non puoi bloccare un amministratore' });
  db.prepare(`UPDATE users SET blocked=? WHERE id=?`).run(u.blocked ? 0 : 1, u.id);
  if (!u.blocked) db.prepare(`DELETE FROM tokens WHERE user_id=?`).run(u.id);
  res.json({ ok: true, blocked: u.blocked ? 0 : 1 });
});

app.put('/api/admin/settings', auth(), adminOnly, (req, res) => {
  const pct = parseFloat(req.body.commission_pct);
  if (isNaN(pct) || pct < 0 || pct > 50) return res.status(400).json({ error: 'Commissione tra 0% e 50%' });
  db.prepare(`UPDATE settings SET value=? WHERE key='commission_pct'`).run(String(pct));
  res.json({ ok: true, commission_pct: pct });
});

/* ---------------- Fallback SPA ---------------- */
app.get(/^\/(?!api|avatars).*/, (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Errore del server' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`NoteMarket in ascolto su http://0.0.0.0:${PORT}`));
