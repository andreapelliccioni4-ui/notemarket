/* Seed: admin, venditori demo e appunti PDF di esempio */
const Database = require('better-sqlite3');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'notemarket.db'));
const UP = path.join(__dirname, 'uploads', 'notes');
fs.mkdirSync(UP, { recursive: true });

const hashPass = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');

if (db.prepare(`SELECT COUNT(*) c FROM users`).get().c > 0) {
  console.log('Database già popolato, salto il seed.');
  process.exit(0);
}

function addUser(name, email, pw, role, university, bio) {
  const salt = crypto.randomBytes(16).toString('hex');
  return db.prepare(`INSERT INTO users (name,email,pass_hash,salt,role,university,bio) VALUES (?,?,?,?,?,?,?)`)
    .run(name, email, hashPass(pw, salt), salt, role, university, bio).lastInsertRowid;
}

const admin = addUser('Amministratore', 'admin@notemarket.it', 'admin123', 'admin', 'Sapienza Università di Roma', 'Gestione della piattaforma NoteMarket.');
const giulia = addUser('Giulia Ricci', 'giulia@demo.it', 'demo123', 'user', 'Università di Bologna', 'Studentessa di Economia, appassionata di appunti ordinati e schemi chiari.');
const marco = addUser('Marco Esposito', 'marco@demo.it', 'demo123', 'user', 'Politecnico di Milano', 'Ingegneria informatica. Condivido appunti completi di teoria ed esercizi.');
const sara = addUser('Sara Colombo', 'sara@demo.it', 'demo123', 'user', 'Sapienza Università di Roma', 'Medicina e Chirurgia. Appunti dettagliati con illustrazioni e mappe concettuali.');
const luca = addUser('Luca Ferrari', 'luca@demo.it', 'demo123', 'user', 'Università degli Studi di Padova', 'Giurisprudenza — riassunti dei manuali e sentenze commentate.');

function makePdf(filename, title, subject, seller, pagesCount) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const stream = fs.createWriteStream(path.join(UP, filename));
    doc.pipe(stream);
    // Copertina
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f5f5f7');
    doc.fill('#1d1d1f').fontSize(11).font('Helvetica').text('NOTEMARKET — APPUNTI UNIVERSITARI', 60, 90, { characterSpacing: 2 });
    doc.moveDown(2).fontSize(34).font('Helvetica-Bold').text(title, { width: 460 });
    doc.moveDown(0.6).fontSize(15).font('Helvetica').fill('#6e6e73').text(subject);
    doc.moveDown(0.3).fontSize(12).text('A cura di ' + seller);
    doc.rect(60, 700, 120, 4).fill('#0071e3');
    const lorem = 'Questi appunti raccolgono in modo ordinato i concetti fondamentali del corso, con definizioni, dimostrazioni, esempi svolti e schemi riassuntivi pensati per la preparazione dell\'esame. Ogni capitolo si apre con una sintesi degli argomenti trattati e si chiude con una serie di domande di autovalutazione. ';
    for (let i = 1; i < pagesCount; i++) {
      doc.addPage();
      doc.fill('#1d1d1f').fontSize(20).font('Helvetica-Bold').text(`Capitolo ${i} — ${subject}`);
      doc.moveDown().fontSize(12).font('Helvetica').fill('#333').text(lorem.repeat(6), { lineGap: 5 });
      doc.fontSize(9).fill('#98989d').text(`Pagina ${i + 1} · ${title}`, 60, 790);
    }
    doc.end();
    stream.on('finish', resolve);
  });
}

const NOTES = [
  [marco, 'Analisi Matematica 1 — Teoria completa ed esercizi svolti', 'Limiti, derivate, integrali e serie: tutta la teoria del corso con oltre 120 esercizi svolti passo passo, schemi riassuntivi e trucchi per lo scritto.', 'Politecnico di Milano', 'Ingegneria Informatica', 'Analisi Matematica', 12.9, 8, '2024/2025'],
  [marco, 'Algoritmi e Strutture Dati — Appunti con pseudocodice', 'Complessità computazionale, ordinamenti, alberi, grafi e programmazione dinamica. Ogni algoritmo spiegato con pseudocodice ed esempi tracciati a mano.', 'Politecnico di Milano', 'Ingegneria Informatica', 'Algoritmi e Strutture Dati', 14.5, 10, '2024/2025'],
  [marco, 'Fisica 1 — Meccanica e Termodinamica', 'Cinematica, dinamica, lavoro ed energia, moti rotazionali e principi della termodinamica con formulario finale pronto per l\'esame.', 'Politecnico di Milano', 'Ingegneria Informatica', 'Fisica', 10.0, 7, '2023/2024'],
  [giulia, 'Microeconomia — Riassunto completo del Besanko', 'Teoria del consumatore, teoria dell\'impresa, forme di mercato e equilibrio generale. Con grafici rifatti in bella e domande d\'esame frequenti.', 'Università di Bologna', 'Economia Aziendale', 'Microeconomia', 9.9, 6, '2024/2025'],
  [giulia, 'Contabilità e Bilancio — Schemi + esercitazioni svolte', 'Partita doppia, scritture d\'assestamento, bilancio d\'esercizio e analisi per indici. Include 15 esercitazioni complete svolte e commentate.', 'Università di Bologna', 'Economia Aziendale', 'Contabilità e Bilancio', 11.5, 9, '2024/2025'],
  [giulia, 'Statistica — Appunti con esempi in R', 'Statistica descrittiva e inferenziale: probabilità, variabili casuali, stima e test d\'ipotesi. Ogni argomento accompagnato da esempi pratici.', 'Università di Bologna', 'Economia Aziendale', 'Statistica', 8.5, 6, '2023/2024'],
  [sara, 'Anatomia Umana 1 — Apparato locomotore e cardiovascolare', 'Osteologia, artrologia, miologia e cuore: descrizioni sistematiche complete con mappe concettuali per il ripasso rapido pre-esame.', 'Sapienza Università di Roma', 'Medicina e Chirurgia', 'Anatomia', 15.9, 12, '2024/2025'],
  [sara, 'Fisiologia — Sistema nervoso e cardiocircolatorio', 'Potenziali d\'azione, sinapsi, riflessi, ciclo cardiaco e regolazione della pressione. Appunti integrati con il Conti e le slide del corso.', 'Sapienza Università di Roma', 'Medicina e Chirurgia', 'Fisiologia', 13.9, 10, '2024/2025'],
  [sara, 'Biologia e Genetica — Riassunto per il primo anno', 'Cellula, DNA, mitosi e meiosi, leggi di Mendel e genetica molecolare. Perfetto per prepararsi al primo esonero.', 'Sapienza Università di Roma', 'Medicina e Chirurgia', 'Biologia', 7.9, 5, '2023/2024'],
  [luca, 'Diritto Privato — Riassunto del Torrente-Schlesinger', 'Soggetti, obbligazioni, contratto, responsabilità civile, famiglia e successioni. Riassunto capitolo per capitolo con casistica essenziale.', 'Università degli Studi di Padova', 'Giurisprudenza', 'Diritto Privato', 16.5, 14, '2024/2025'],
  [luca, 'Diritto Costituzionale — Appunti aggiornati', 'Fonti del diritto, organi costituzionali, diritti e libertà, giustizia costituzionale. Con le principali sentenze della Corte commentate.', 'Università degli Studi di Padova', 'Giurisprudenza', 'Diritto Costituzionale', 12.0, 9, '2024/2025'],
  [marco, 'Ingegneria del Software — UML, design pattern e testing', 'Ciclo di vita del software, requisiti, UML completo, principali design pattern GoF e strategie di testing con esempi in Java.', 'Politecnico di Milano', 'Ingegneria Informatica', 'Ingegneria del Software', 11.0, 8, '2024/2025'],
];

(async () => {
  for (const [sellerId, title, desc, uni, course, subject, price, pages, year] of NOTES) {
    const filename = Date.now() + '-' + crypto.randomBytes(5).toString('hex') + '.pdf';
    const seller = db.prepare(`SELECT name FROM users WHERE id=?`).get(sellerId).name;
    await makePdf(filename, title, subject, seller, pages);
    const size = fs.statSync(path.join(UP, filename)).size;
    db.prepare(`INSERT INTO notes (seller_id,title,description,university,course,subject,price,pages,year,file_path,file_size,downloads,rating_sum,rating_count)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(sellerId, title, desc, uni, course, subject, price, pages * 6, year, filename, size,
        Math.floor(Math.random() * 90) + 5, 0, 0);
  }

  // Qualche acquisto e recensione demo per popolare statistiche
  const pct = 15;
  const buyPairs = [[giulia, 1], [giulia, 7], [sara, 4], [luca, 2], [marco, 10], [sara, 11], [luca, 1], [giulia, 12]];
  for (const [buyer, noteId] of buyPairs) {
    const n = db.prepare(`SELECT * FROM notes WHERE id=?`).get(noteId);
    if (!n || n.seller_id === buyer) continue;
    const commission = +(n.price * pct / 100).toFixed(2);
    db.prepare(`INSERT INTO purchases (buyer_id,note_id,seller_id,price,commission,seller_net) VALUES (?,?,?,?,?,?)`)
      .run(buyer, noteId, n.seller_id, n.price, commission, +(n.price - commission).toFixed(2));
    db.prepare(`UPDATE users SET balance=balance+? WHERE id=?`).run(+(n.price - commission).toFixed(2), n.seller_id);
    const stars = Math.random() > 0.3 ? 5 : 4;
    const comments = ['Appunti chiarissimi, esame passato al primo colpo!', 'Ben organizzati e completi, consigliati.', 'Ottimo rapporto qualità prezzo.', 'Schemi fantastici, mi hanno salvato la sessione.'];
    try {
      db.prepare(`INSERT INTO reviews (note_id,user_id,stars,comment) VALUES (?,?,?,?)`)
        .run(noteId, buyer, stars, comments[Math.floor(Math.random() * comments.length)]);
      db.prepare(`UPDATE notes SET rating_sum=rating_sum+?, rating_count=rating_count+1 WHERE id=?`).run(stars, noteId);
    } catch {}
  }
  console.log('Seed completato.');
})();
