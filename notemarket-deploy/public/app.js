/* NoteMarket — SPA frontend */
'use strict';

/* ================= State & helpers ================= */
const S = {
  token: localStorage.getItem('nm_token') || null,
  user: null,
  cartCount: 0,
  meta: { universities: [], subjects: [] },
  filters: { q: '', university: '', subject: '', sort: 'recent' },
};

const $app = document.getElementById('app');

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Errore di rete');
  return data;
}

const icon = (name, cls = '') => `<svg class="icon ${cls}"><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtDate = (d) => new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

const GRADIENTS = [
  ['#0071e3', '#40a9ff'], ['#7b61ff', '#a78bfa'], ['#e64980', '#ff8787'], ['#0ca678', '#63e6be'],
  ['#f59f00', '#ffd43b'], ['#1098ad', '#66d9e8'], ['#5f3dc4', '#845ef7'], ['#d6336c', '#faa2c1'],
  ['#2f9e44', '#8ce99a'], ['#e8590c', '#ffa94d'],
];
function grad(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
const SUBJECT_ICONS = {
  'Analisi Matematica': 'chart', 'Fisica': 'spark', 'Chimica': 'spark', 'Informatica': 'layers',
  'Algoritmi e Strutture Dati': 'layers', 'Ingegneria del Software': 'layers', 'Economia': 'euro',
  'Microeconomia': 'euro', 'Macroeconomia': 'euro', 'Contabilità e Bilancio': 'euro', 'Marketing': 'tag',
  'Diritto Privato': 'shield', 'Diritto Costituzionale': 'shield', 'Anatomia': 'user', 'Fisiologia': 'user',
  'Biologia': 'spark', 'Farmacologia': 'spark', 'Statistica': 'chart', 'Storia': 'lib', 'Filosofia': 'lib',
  'Letteratura Italiana': 'book', 'Lingua Inglese': 'book', 'Psicologia': 'user', 'Sociologia': 'users',
  'Architettura': 'uni', 'Meccanica': 'settings', 'Elettrotecnica': 'spark', 'Scienza delle Costruzioni': 'uni',
};
const subjIcon = (s) => SUBJECT_ICONS[s] || 'book';

function avatarHtml(user, cls = 'nav-avatar') {
  const name = user?.name || '?';
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  if (user?.avatar) return `<img class="${cls}" src="${esc(user.avatar)}" alt="${esc(name)}" />`;
  const fb = cls === 'profile-avatar' ? 'profile-avatar-fb' : 'avatar-fallback';
  return `<div class="${fb}" style="background:${grad(name)}">${esc(initials)}</div>`;
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = icon(type === 'ok' ? 'check' : 'x') + esc(msg);
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, 2800);
}

function openModal(html, small = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal ${small ? 'modal-sm' : ''}">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
window.closeModal = closeModal;

function starsHtml(rating, count) {
  let s = '<span class="stars">';
  for (let i = 1; i <= 5; i++) s += `<svg class="icon ${i <= Math.round(rating) ? '' : 'off'}"><use href="#i-star"/></svg>`;
  s += '</span>';
  if (count !== undefined) s += ` <span style="color:var(--text-3);font-size:13px">(${count})</span>`;
  return s;
}

async function refreshSession() {
  if (!S.token) return;
  try {
    const { user } = await api('/me');
    S.user = user;
    const { items } = await api('/cart');
    S.cartCount = items.length;
  } catch {
    S.token = null; S.user = null; localStorage.removeItem('nm_token');
  }
}

/* ================= Router ================= */
const routes = {
  '': pageHome, 'note': pageNote, 'cart': pageCart, 'login': pageLogin, 'register': pageRegister,
  'sell': pageSell, 'dashboard': pageDashboard, 'purchases': pagePurchases, 'profile': pageProfile, 'admin': pageAdmin,
};
function nav(hash) { location.hash = hash; }
window.nav = nav;

async function router() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = routes[parts[0]] || pageHome;
  window.scrollTo(0, 0);
  renderNav(parts[0]);
  await page(parts.slice(1));
}
window.addEventListener('hashchange', router);

/* ================= Navbar ================= */
function renderNav(active) {
  let right;
  if (S.user) {
    right = `
      ${S.user.role === 'admin' ? `<button class="nav-link ${active === 'admin' ? 'active' : ''}" onclick="nav('#/admin')">${icon('shield')}<span class="lbl">Admin</span></button>` : ''}
      <button class="nav-link ${active === 'sell' ? 'active' : ''}" onclick="nav('#/sell')">${icon('upload')}<span class="lbl">Vendi</span></button>
      <button class="nav-link ${active === 'dashboard' ? 'active' : ''}" onclick="nav('#/dashboard')">${icon('chart')}<span class="lbl">Dashboard</span></button>
      <button class="nav-link ${active === 'purchases' ? 'active' : ''}" onclick="nav('#/purchases')">${icon('bag')}<span class="lbl">Acquisti</span></button>
      <button class="nav-link nav-cart ${active === 'cart' ? 'active' : ''}" onclick="nav('#/cart')">${icon('cart')}${S.cartCount ? `<span class="cart-badge">${S.cartCount}</span>` : ''}</button>
      <span onclick="nav('#/profile')" title="${esc(S.user.name)}" style="cursor:pointer">${avatarHtml(S.user)}</span>`;
  } else {
    right = `
      <button class="nav-link" onclick="nav('#/login')">Accedi</button>
      <button class="btn btn-primary btn-sm" onclick="nav('#/register')">Registrati</button>`;
  }
  const navEl = document.getElementById('mainnav') || (() => {
    const n = document.createElement('nav'); n.className = 'nav'; n.id = 'mainnav';
    document.body.insertBefore(n, $app); return n;
  })();
  navEl.innerHTML = `
    <div class="nav-inner">
      <div class="nav-logo" onclick="nav('#/')"><div class="logo-mark">${icon('book')}</div>NoteMarket</div>
      <button class="nav-link ${active === '' ? 'active' : ''}" onclick="nav('#/')">${icon('search')}<span class="lbl">Esplora</span></button>
      <div class="nav-spacer"></div>
      ${right}
    </div>`;
}

/* ================= Home / Marketplace ================= */
async function pageHome() {
  const showHero = !S.filters.q && !S.filters.university && !S.filters.subject;
  $app.innerHTML = `
    ${showHero ? `
    <section class="hero fade-in">
      <div class="hero-badge">${icon('spark', 'sm')} Il marketplace degli studenti italiani</div>
      <h1>I migliori appunti.<br/><span class="grad">Da studente a studente.</span></h1>
      <p>Compra e vendi appunti universitari di qualità per ogni ateneo d'Italia. Anteprima immediata, download istantaneo, guadagni reali.</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" onclick="document.getElementById('market').scrollIntoView({behavior:'smooth'})">${icon('search')} Esplora gli appunti</button>
        <button class="btn btn-secondary btn-lg" onclick="nav('${S.user ? '#/sell' : '#/register'}')">${icon('upload')} Inizia a vendere</button>
      </div>
      <div class="hero-stats" id="hero-stats"></div>
    </section>
    <div class="page" style="padding-top:0;padding-bottom:0">
      <div class="feature-band">
        <div class="card feature"><div class="f-icon tint-blue">${icon('eye')}</div><b>Anteprima trasparente</b><p>Sfoglia gli appunti prima di acquistarli. Niente sorprese.</p></div>
        <div class="card feature"><div class="f-icon tint-purple">${icon('uni')}</div><b>Tutte le università</b><p>Oltre 70 atenei italiani, da Bolzano a Palermo.</p></div>
        <div class="card feature"><div class="f-icon tint-green">${icon('wallet')}</div><b>Guadagna studiando</b><p>Vendi i tuoi appunti e monetizza il tuo impegno.</p></div>
        <div class="card feature"><div class="f-icon tint-amber">${icon('shield')}</div><b>Recensioni verificate</b><p>Solo chi acquista può recensire. Qualità garantita.</p></div>
      </div>
    </div>` : ''}
    <div class="page" id="market" style="padding-top:${showHero ? '10px' : '34px'}">
      ${showHero ? '' : `<h1 class="page-title" style="margin-bottom:22px">Esplora gli appunti</h1>`}
      <div class="filters">
        <div class="search-box">${icon('search')}<input id="f-q" placeholder="Cerca per titolo, corso o materia…" value="${esc(S.filters.q)}" /></div>
        <select class="select" id="f-uni"><option value="">Tutte le università</option></select>
        <select class="select" id="f-sub"><option value="">Tutte le materie</option></select>
        <select class="select" id="f-sort">
          <option value="recent">Più recenti</option><option value="popular">Più scaricati</option>
          <option value="rating">Migliori recensioni</option><option value="price_asc">Prezzo crescente</option>
          <option value="price_desc">Prezzo decrescente</option>
        </select>
      </div>
      <div class="grid" id="notes-grid">${'<div class="skeleton"></div>'.repeat(8)}</div>
    </div>
    <footer class="footer"><b>NoteMarket</b> — il marketplace degli appunti universitari italiani.<br/>Realizzato con cura, per studenti che puntano al 30 e lode.</footer>`;

  // Popola filtri
  const uniSel = document.getElementById('f-uni'), subSel = document.getElementById('f-sub');
  S.meta.universities.forEach((u) => uniSel.insertAdjacentHTML('beforeend', `<option ${u === S.filters.university ? 'selected' : ''}>${esc(u)}</option>`));
  S.meta.subjects.forEach((s) => subSel.insertAdjacentHTML('beforeend', `<option ${s === S.filters.subject ? 'selected' : ''}>${esc(s)}</option>`));
  document.getElementById('f-sort').value = S.filters.sort;

  let debounce;
  document.getElementById('f-q').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { S.filters.q = e.target.value; loadNotes(); }, 320);
  });
  uniSel.onchange = (e) => { S.filters.university = e.target.value; loadNotes(); };
  subSel.onchange = (e) => { S.filters.subject = e.target.value; loadNotes(); };
  document.getElementById('f-sort').onchange = (e) => { S.filters.sort = e.target.value; loadNotes(); };

  loadNotes();
  if (showHero) loadHeroStats();
}

async function loadHeroStats() {
  try {
    const { notes } = await api('/notes?sort=popular');
    const unis = new Set(notes.map((n) => n.university)).size;
    const el = document.getElementById('hero-stats');
    if (el) el.innerHTML = `
      <div class="hero-stat"><b>${notes.length}+</b><span>appunti pubblicati</span></div>
      <div class="hero-stat"><b>${Math.max(unis, 1)}</b><span>università attive</span></div>
      <div class="hero-stat"><b>${S.meta.universities.length}</b><span>atenei supportati</span></div>`;
  } catch {}
}

async function loadNotes() {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;
  const p = new URLSearchParams();
  if (S.filters.q) p.set('q', S.filters.q);
  if (S.filters.university) p.set('university', S.filters.university);
  if (S.filters.subject) p.set('subject', S.filters.subject);
  p.set('sort', S.filters.sort);
  try {
    const { notes } = await api('/notes?' + p);
    if (!notes.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${icon('search')}</div><b>Nessun risultato</b>Prova a modificare i filtri di ricerca.</div>`;
      return;
    }
    grid.innerHTML = notes.map(noteCard).join('');
  } catch (e) { toast(e.message, 'err'); }
}

function noteCard(n) {
  return `
  <article class="note-card fade-in" onclick="nav('#/note/${n.id}')">
    <div class="note-cover" style="background:${grad(n.subject)}">
      ${icon(subjIcon(n.subject))}
      <span class="subject-tag">${esc(n.subject)}</span>
    </div>
    <div class="note-body">
      <h3 class="note-title">${esc(n.title)}</h3>
      <div class="note-uni">${icon('uni')} ${esc(n.university)}</div>
      <div class="note-meta">
        <span>${icon('file', 'sm')} ${n.pages || '—'} pag.</span>
        <span>${icon('download', 'sm')} ${n.downloads}</span>
        ${n.rating ? `<span class="rating"><svg class="icon"><use href="#i-star"/></svg>${n.rating}<span class="muted">(${n.rating_count})</span></span>` : ''}
      </div>
      <div class="note-footer">
        <span class="note-price">${eur(n.price)}</span>
        <span style="font-size:12.5px;color:var(--text-3)">${esc(n.seller_name)}</span>
      </div>
    </div>
  </article>`;
}

/* ================= Dettaglio nota ================= */
async function pageNote([id]) {
  $app.innerHTML = `<div class="page"><div class="skeleton" style="height:420px"></div></div>`;
  let data;
  try { data = await api('/notes/' + id); } catch (e) {
    $app.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">${icon('x')}</div><b>Appunti non trovati</b></div></div>`;
    return;
  }
  const { note: n, reviews, owned, inCart } = data;
  const canReview = S.user && owned && S.user.id !== n.seller_id;

  $app.innerHTML = `
  <div class="page fade-in">
    <button class="btn btn-ghost btn-sm" onclick="history.back()" style="margin-bottom:18px">${icon('back', 'sm')} Indietro</button>
    <div class="detail-grid">
      <div>
        <div class="detail-hero" style="background:${grad(n.subject)}">
          <span class="subject-tag">${esc(n.subject)}</span>
          <h1>${esc(n.title)}</h1>
          <p style="margin-top:12px;opacity:.9;font-size:15px">${esc(n.university)}${n.course ? ' · ' + esc(n.course) : ''}</p>
          <svg class="icon big-icon"><use href="#i-${subjIcon(n.subject)}"/></svg>
        </div>
        <div class="card card-pad" style="margin-top:22px">
          <h2 class="section-title">${icon('file')} Descrizione</h2>
          <p style="color:var(--text-2);line-height:1.75">${esc(n.description) || 'Nessuna descrizione fornita.'}</p>
          <div class="divider"></div>
          <h2 class="section-title">${icon('star')} Recensioni ${n.rating ? starsHtml(n.rating, n.rating_count) : ''}</h2>
          <div id="reviews">
            ${reviews.length ? reviews.map((r) => `
              <div class="review">
                <div class="review-head">
                  ${avatarHtml({ name: r.user_name, avatar: r.user_avatar }, 'nav-avatar')}
                  <div><b style="font-size:14px">${esc(r.user_name)}</b><div>${starsHtml(r.stars)}</div></div>
                  <span style="margin-left:auto;color:var(--text-3);font-size:12.5px">${fmtDate(r.created_at)}</span>
                </div>
                ${r.comment ? `<p style="font-size:14.5px;color:var(--text-2)">${esc(r.comment)}</p>` : ''}
              </div>`).join('') : `<p style="color:var(--text-3);font-size:14px">Ancora nessuna recensione.</p>`}
          </div>
          ${canReview ? `
          <div class="divider"></div>
          <h3 style="font-size:16px;margin-bottom:12px">Lascia una recensione</h3>
          <div class="star-input stars" id="star-input">${[1,2,3,4,5].map((i) => `<svg class="icon off" data-star="${i}"><use href="#i-star"/></svg>`).join('')}</div>
          <textarea class="input" id="rev-comment" placeholder="Com'erano questi appunti?" style="margin:12px 0"></textarea>
          <button class="btn btn-primary btn-sm" id="rev-send">${icon('check', 'sm')} Pubblica recensione</button>` : ''}
        </div>
      </div>
      <div class="buy-box">
        <div class="card card-pad">
          <div class="buy-price">${eur(n.price)}</div>
          <div class="meta-list">
            <div class="row">${icon('file')} ${n.pages || '—'} pagine · PDF · ${fmtSize(n.file_size)}</div>
            <div class="row">${icon('uni')} ${esc(n.university)}</div>
            ${n.year ? `<div class="row">${icon('clock')} Anno accademico ${esc(n.year)}</div>` : ''}
            <div class="row">${icon('download')} ${n.downloads} download</div>
            <div class="row">${icon('clock')} Pubblicato il ${fmtDate(n.created_at)}</div>
          </div>
          <button class="btn btn-secondary btn-block" style="margin-bottom:10px" onclick="openPreview(${n.id}, '${esc(n.title).replace(/'/g, "\\'")}')">${icon('eye')} Anteprima</button>
          ${owned
            ? `<a class="btn btn-primary btn-block" href="/api/notes/${n.id}/download?token=${S.token}">${icon('download')} Scarica PDF</a>
               <p style="text-align:center;color:var(--green);font-size:13px;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px">${icon('check', 'sm')} ${S.user && S.user.id === n.seller_id ? 'Sono i tuoi appunti' : 'Già acquistato'}</p>`
            : inCart
            ? `<button class="btn btn-primary btn-block" onclick="nav('#/cart')">${icon('cart')} Vai al carrello</button>`
            : `<button class="btn btn-primary btn-block" id="add-cart">${icon('cart')} Aggiungi al carrello</button>`}
          <div class="seller-row">
            ${avatarHtml({ name: n.seller_name, avatar: n.seller_avatar })}
            <div><b>${esc(n.seller_name)}</b><span>${esc(n.seller_university || 'Venditore')}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const addBtn = document.getElementById('add-cart');
  if (addBtn) addBtn.onclick = async () => {
    if (!S.user) { toast('Accedi per aggiungere al carrello', 'err'); nav('#/login'); return; }
    try {
      const r = await api('/cart', { method: 'POST', body: { note_id: n.id } });
      S.cartCount = r.count; renderNav('note');
      toast('Aggiunto al carrello');
      addBtn.outerHTML = `<button class="btn btn-primary btn-block" onclick="nav('#/cart')">${icon('cart')} Vai al carrello</button>`;
    } catch (e) { toast(e.message, 'err'); }
  };

  if (canReview) {
    let sel = 5;
    const paint = () => document.querySelectorAll('#star-input .icon').forEach((el) =>
      el.classList.toggle('off', +el.dataset.star > sel));
    paint();
    document.querySelectorAll('#star-input .icon').forEach((el) =>
      el.addEventListener('click', () => { sel = +el.dataset.star; paint(); }));
    document.getElementById('rev-send').onclick = async () => {
      try {
        await api(`/notes/${n.id}/reviews`, { method: 'POST', body: { stars: sel, comment: document.getElementById('rev-comment').value } });
        toast('Recensione pubblicata'); pageNote([id]);
      } catch (e) { toast(e.message, 'err'); }
    };
  }
}

window.openPreview = (id, title) => {
  openModal(`
    <div class="modal-head"><h3>${icon('eye')} Anteprima — ${esc(title)}</h3>
      <button class="icon-btn" onclick="closeModal()">${icon('x')}</button></div>
    <iframe class="preview-frame" style="height:66vh;margin:0" src="/api/notes/${id}/preview"></iframe>
    <p style="color:var(--text-3);font-size:12.5px;margin-top:12px;text-align:center">Il download del file completo è disponibile dopo l'acquisto.</p>`);
};

/* ================= Carrello ================= */
async function pageCart() {
  if (!S.user) { nav('#/login'); return; }
  $app.innerHTML = `<div class="page page-narrow"><div class="skeleton" style="height:300px"></div></div>`;
  const { items, total } = await api('/cart');
  S.cartCount = items.length; renderNav('cart');
  const pct = S.meta.commission_pct ?? 15;

  if (!items.length) {
    $app.innerHTML = `<div class="page page-narrow fade-in">
      <h1 class="page-title">Carrello</h1>
      <div class="empty"><div class="empty-icon">${icon('cart')}</div><b>Il tuo carrello è vuoto</b>Gli appunti che aggiungi restano salvati qui, anche se esci.<br/><br/>
      <button class="btn btn-primary" onclick="nav('#/')">${icon('search')} Esplora gli appunti</button></div></div>`;
    return;
  }
  $app.innerHTML = `
  <div class="page page-narrow fade-in">
    <h1 class="page-title">Carrello</h1>
    <p class="page-sub">${items.length} ${items.length === 1 ? 'articolo' : 'articoli'} — salvati automaticamente sul tuo account</p>
    <div class="card card-pad" style="margin-top:22px">
      ${items.map((n) => `
        <div class="cart-item">
          <div class="cart-thumb" style="background:${grad(n.subject)}">${icon(subjIcon(n.subject))}</div>
          <div class="cart-info" style="cursor:pointer" onclick="nav('#/note/${n.id}')">
            <b>${esc(n.title)}</b>
            <span>${esc(n.university)} · ${esc(n.seller_name)}</span>
          </div>
          <b style="font-size:16px;white-space:nowrap">${eur(n.price)}</b>
          <button class="icon-btn" title="Rimuovi" onclick="removeFromCart(${n.id})">${icon('trash', 'sm')}</button>
        </div>`).join('')}
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div><b style="font-size:18px">Totale</b><div style="font-size:12.5px;color:var(--text-3)">IVA inclusa dove applicabile</div></div>
        <b style="font-size:26px;letter-spacing:-0.8px">${eur(total)}</b>
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="checkout">${icon('card')} Completa l'acquisto</button>
    </div>
  </div>`;

  document.getElementById('checkout').onclick = async () => {
    const btn = document.getElementById('checkout');
    btn.disabled = true; btn.innerHTML = 'Elaborazione…';
    try {
      const r = await api('/checkout', { method: 'POST' });
      S.cartCount = 0;
      openModal(`
        <div style="text-align:center;padding:14px">
          <div style="width:70px;height:70px;border-radius:50%;background:rgba(48,164,108,.12);color:var(--green);display:grid;place-items:center;margin:0 auto 18px">${icon('check', 'lg')}</div>
          <h3 style="font-size:22px;letter-spacing:-0.5px">Acquisto completato</h3>
          <p style="color:var(--text-2);margin:10px 0 24px">${r.purchased} ${r.purchased === 1 ? 'appunto acquistato' : 'appunti acquistati'} per ${eur(r.total)}.<br/>Li trovi nella sezione «I miei acquisti».</p>
          <button class="btn btn-primary" onclick="closeModal();nav('#/purchases')">${icon('bag')} Vai ai miei acquisti</button>
        </div>`, true);
      renderNav('cart');
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.innerHTML = 'Completa l\'acquisto'; }
  };
}
window.removeFromCart = async (id) => {
  const r = await api('/cart/' + id, { method: 'DELETE' });
  S.cartCount = r.count; toast('Rimosso dal carrello'); pageCart();
};

/* ================= Auth ================= */
function authShell(inner) {
  $app.innerHTML = `<div class="auth-wrap fade-in"><div class="auth-logo"><div class="logo-mark">${icon('book')}</div></div><div class="card auth-card">${inner}</div></div>`;
}
function pageLogin() {
  authShell(`
    <h2>Bentornato</h2><p class="sub">Accedi al tuo account NoteMarket</p>
    <div class="field"><label>Email</label><input class="input" id="l-email" type="email" placeholder="nome@università.it" /></div>
    <div class="field"><label>Password</label><input class="input" id="l-pass" type="password" placeholder="••••••••" /></div>
    <button class="btn btn-primary btn-block" id="l-btn">Accedi</button>
    <div class="auth-switch">Non hai un account? <a onclick="nav('#/register')">Registrati</a></div>
    <div class="demo-hint"><b>Account demo</b><br/>
      Admin: <code>admin@notemarket.it</code> / <code>admin123</code><br/>
      Venditore: <code>marco@demo.it</code> / <code>demo123</code><br/>
      Studente: <code>giulia@demo.it</code> / <code>demo123</code></div>`);
  const go = async () => {
    try {
      const r = await api('/login', { method: 'POST', body: { email: document.getElementById('l-email').value, password: document.getElementById('l-pass').value } });
      S.token = r.token; S.user = r.user; localStorage.setItem('nm_token', r.token);
      await refreshSession(); toast('Bentornato, ' + r.user.name.split(' ')[0]); nav('#/');
    } catch (e) { toast(e.message, 'err'); }
  };
  document.getElementById('l-btn').onclick = go;
  document.getElementById('l-pass').addEventListener('keydown', (e) => e.key === 'Enter' && go());
}
function pageRegister() {
  authShell(`
    <h2>Crea il tuo account</h2><p class="sub">Gratis, in meno di un minuto</p>
    <div class="field"><label>Nome e cognome</label><input class="input" id="r-name" placeholder="Mario Rossi" /></div>
    <div class="field"><label>Email</label><input class="input" id="r-email" type="email" placeholder="nome@università.it" /></div>
    <div class="field"><label>Password</label><input class="input" id="r-pass" type="password" placeholder="Minimo 6 caratteri" /></div>
    <div class="field"><label>La tua università</label><select class="input" id="r-uni"><option value="">Seleziona…</option>${S.meta.universities.map((u) => `<option>${esc(u)}</option>`).join('')}</select></div>
    <button class="btn btn-primary btn-block" id="r-btn">Registrati</button>
    <div class="auth-switch">Hai già un account? <a onclick="nav('#/login')">Accedi</a></div>`);
  document.getElementById('r-btn').onclick = async () => {
    try {
      const r = await api('/register', { method: 'POST', body: {
        name: document.getElementById('r-name').value, email: document.getElementById('r-email').value,
        password: document.getElementById('r-pass').value, university: document.getElementById('r-uni').value } });
      S.token = r.token; S.user = r.user; localStorage.setItem('nm_token', r.token);
      toast('Benvenuto su NoteMarket'); nav('#/');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ================= Vendi / Upload con anteprima ================= */
let uploadFile = null;
async function pageSell() {
  if (!S.user) { nav('#/login'); return; }
  uploadFile = null;
  $app.innerHTML = `
  <div class="page page-narrow fade-in">
    <h1 class="page-title">Vendi i tuoi appunti</h1>
    <p class="page-sub">Carica un PDF, imposta il prezzo e inizia a guadagnare. Commissione della piattaforma: <b>${S.meta.commission_pct}%</b>.</p>
    <div class="card card-pad" style="margin-top:24px">
      <div class="dropzone" id="dz">
        <div class="dz-icon">${icon('upload', 'lg')}</div>
        <b>Trascina qui il tuo PDF</b>
        <span>oppure clicca per selezionarlo — max 40 MB</span>
        <input type="file" id="dz-input" accept="application/pdf" hidden />
      </div>
      <div id="dz-file"></div>
      <div id="dz-preview"></div>
      <div class="divider"></div>
      <div class="field"><label>Titolo *</label><input class="input" id="s-title" placeholder="Es. Analisi Matematica 1 — Teoria completa ed esercizi" /></div>
      <div class="form-row">
        <div class="field"><label>Università *</label><select class="input" id="s-uni"><option value="">Seleziona…</option>${S.meta.universities.map((u) => `<option ${u === S.user.university ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
        <div class="field"><label>Materia *</label><select class="input" id="s-sub"><option value="">Seleziona…</option>${S.meta.subjects.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Corso di laurea</label><input class="input" id="s-course" placeholder="Es. Ingegneria Informatica" /></div>
        <div class="field"><label>Anno accademico</label><input class="input" id="s-year" placeholder="Es. 2024/2025" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Prezzo (€) *</label><input class="input" id="s-price" type="number" min="0.5" max="200" step="0.5" placeholder="9,90" />
          <div class="form-hint" id="s-net">Riceverai il ${100 - S.meta.commission_pct}% di ogni vendita.</div></div>
        <div class="field"><label>Numero di pagine</label><input class="input" id="s-pages" type="number" min="1" placeholder="48" /></div>
      </div>
      <div class="field"><label>Descrizione</label><textarea class="input" id="s-desc" placeholder="Racconta cosa contengono i tuoi appunti: argomenti, esercizi svolti, schemi…"></textarea></div>
      <button class="btn btn-primary btn-block btn-lg" id="s-publish">${icon('upload')} Pubblica gli appunti</button>
    </div>
  </div>`;

  const dz = document.getElementById('dz'), input = document.getElementById('dz-input');
  dz.onclick = () => input.click();
  ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => e.dataTransfer.files[0] && setFile(e.dataTransfer.files[0]));
  input.onchange = () => input.files[0] && setFile(input.files[0]);

  function setFile(f) {
    if (f.type !== 'application/pdf') { toast('Sono ammessi solo file PDF', 'err'); return; }
    if (f.size > 40 * 1024 * 1024) { toast('Il file supera i 40 MB', 'err'); return; }
    uploadFile = f;
    document.getElementById('dz-file').innerHTML = `
      <div class="file-chip">${icon('file')}<div style="flex:1"><b>${esc(f.name)}</b><span>${fmtSize(f.size)} · PDF</span></div>
      <button class="icon-btn" id="dz-remove">${icon('x', 'sm')}</button></div>`;
    document.getElementById('dz-preview').innerHTML = `
      <p style="font-size:13px;font-weight:600;color:var(--text-2);margin-top:16px;display:flex;align-items:center;gap:7px">${icon('eye', 'sm')} Anteprima del documento</p>
      <iframe class="preview-frame" src="${URL.createObjectURL(f)}"></iframe>`;
    document.getElementById('dz-remove').onclick = (e) => {
      e.stopPropagation(); uploadFile = null;
      document.getElementById('dz-file').innerHTML = ''; document.getElementById('dz-preview').innerHTML = '';
    };
  }

  const priceEl = document.getElementById('s-price');
  priceEl.addEventListener('input', () => {
    const p = parseFloat(priceEl.value);
    const hint = document.getElementById('s-net');
    if (!isNaN(p) && p > 0) {
      const net = p * (1 - S.meta.commission_pct / 100);
      hint.innerHTML = `Riceverai <b style="color:var(--green)">${eur(net)}</b> per ogni vendita (commissione ${S.meta.commission_pct}%).`;
    } else hint.textContent = `Riceverai il ${100 - S.meta.commission_pct}% di ogni vendita.`;
  });

  document.getElementById('s-publish').onclick = async () => {
    if (!uploadFile) { toast('Carica prima un file PDF', 'err'); return; }
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('title', document.getElementById('s-title').value);
    fd.append('university', document.getElementById('s-uni').value);
    fd.append('subject', document.getElementById('s-sub').value);
    fd.append('course', document.getElementById('s-course').value);
    fd.append('year', document.getElementById('s-year').value);
    fd.append('price', document.getElementById('s-price').value);
    fd.append('pages', document.getElementById('s-pages').value);
    fd.append('description', document.getElementById('s-desc').value);
    const btn = document.getElementById('s-publish');
    btn.disabled = true; btn.textContent = 'Pubblicazione in corso…';
    try {
      const { note } = await api('/notes', { method: 'POST', body: fd });
      toast('Appunti pubblicati con successo'); nav('#/note/' + note.id);
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('upload')} Pubblica gli appunti`; }
  };
}

/* ================= Dashboard venditore ================= */
async function pageDashboard() {
  if (!S.user) { nav('#/login'); return; }
  $app.innerHTML = `<div class="page"><div class="skeleton" style="height:400px"></div></div>`;
  const d = await api('/dashboard');
  $app.innerHTML = `
  <div class="page fade-in">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px">
      <div><h1 class="page-title">La tua dashboard</h1><p class="page-sub">Vendite, guadagni e appunti pubblicati</p></div>
      <button class="btn btn-primary" onclick="nav('#/sell')">${icon('plus')} Nuovi appunti</button>
    </div>
    <div class="stat-grid" style="margin-top:26px">
      <div class="card stat-card"><div class="stat-icon tint-green">${icon('wallet')}</div><b>${eur(d.balance)}</b><span>Saldo disponibile</span></div>
      <div class="card stat-card"><div class="stat-icon tint-blue">${icon('bag')}</div><b>${d.stats.total_sales}</b><span>Vendite totali</span></div>
      <div class="card stat-card"><div class="stat-icon tint-purple">${icon('euro')}</div><b>${eur(d.stats.earnings)}</b><span>Guadagni netti</span></div>
      <div class="card stat-card"><div class="stat-icon tint-amber">${icon('file')}</div><b>${d.notes.length}</b><span>Appunti pubblicati</span></div>
    </div>

    <h2 class="section-title" style="margin-top:38px">${icon('file')} I tuoi appunti</h2>
    ${d.notes.length ? `
    <div class="card table-wrap"><table class="tbl">
      <thead><tr><th>Titolo</th><th>Prezzo</th><th>Download</th><th>Valutazione</th><th>Pubblicato</th><th></th></tr></thead>
      <tbody>${d.notes.map((n) => `
        <tr>
          <td><a style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="nav('#/note/${n.id}')">${esc(n.title)}</a>
            <div style="font-size:12px;color:var(--text-3)">${esc(n.subject)} · ${esc(n.university)}</div></td>
          <td><b>${eur(n.price)}</b></td>
          <td>${n.downloads}</td>
          <td>${n.rating ? `<span class="rating"><svg class="icon"><use href="#i-star"/></svg>${n.rating}</span>` : '<span style="color:var(--text-3)">—</span>'}</td>
          <td style="color:var(--text-2)">${fmtDate(n.created_at)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteNote(${n.id})">${icon('trash', 'sm')} Elimina</button></td>
        </tr>`).join('')}</tbody>
    </table></div>` : `<div class="card"><div class="empty"><div class="empty-icon">${icon('upload')}</div><b>Nessun appunto pubblicato</b>Carica i tuoi primi appunti e inizia a guadagnare.<br/><br/><button class="btn btn-primary" onclick="nav('#/sell')">${icon('upload')} Carica appunti</button></div></div>`}

    <h2 class="section-title" style="margin-top:38px">${icon('chart')} Ultime vendite</h2>
    ${d.sales.length ? `
    <div class="card table-wrap"><table class="tbl">
      <thead><tr><th>Appunti</th><th>Acquirente</th><th>Prezzo</th><th>Commissione</th><th>Netto</th><th>Data</th></tr></thead>
      <tbody>${d.sales.map((s) => `
        <tr><td style="font-weight:600">${esc(s.title)}</td><td>${esc(s.buyer_name)}</td>
        <td>${eur(s.price)}</td><td style="color:var(--text-3)">−${eur(s.commission)}</td>
        <td><b style="color:var(--green)">${eur(s.seller_net)}</b></td><td style="color:var(--text-2)">${fmtDate(s.created_at)}</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="card"><div class="empty" style="padding:44px"><div class="empty-icon">${icon('chart')}</div><b>Ancora nessuna vendita</b>Le tue vendite appariranno qui.</div></div>`}
  </div>`;
}
window.deleteNote = async (id) => {
  if (!confirm('Eliminare definitivamente questi appunti?')) return;
  try { await api('/notes/' + id, { method: 'DELETE' }); toast('Appunti eliminati'); router(); }
  catch (e) { toast(e.message, 'err'); }
};

/* ================= I miei acquisti ================= */
async function pagePurchases() {
  if (!S.user) { nav('#/login'); return; }
  $app.innerHTML = `<div class="page page-narrow"><div class="skeleton" style="height:300px"></div></div>`;
  const { purchases } = await api('/purchases');
  $app.innerHTML = `
  <div class="page page-narrow fade-in">
    <h1 class="page-title">I miei acquisti</h1>
    <p class="page-sub">Tutti gli appunti che hai acquistato, sempre disponibili per il download.</p>
    ${purchases.length ? `<div class="card card-pad" style="margin-top:22px">
      ${purchases.map((p) => `
        <div class="cart-item">
          <div class="cart-thumb" style="background:${grad(p.subject)}">${icon(subjIcon(p.subject))}</div>
          <div class="cart-info" style="cursor:pointer" onclick="nav('#/note/${p.id}')">
            <b>${esc(p.title)}</b>
            <span>${esc(p.university)} · acquistato il ${fmtDate(p.purchased_at)} · ${eur(p.paid)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openPreview(${p.id}, '${esc(p.title).replace(/'/g, "\\'")}')">${icon('eye', 'sm')}</button>
          <a class="btn btn-primary btn-sm" href="/api/notes/${p.id}/download?token=${S.token}">${icon('download', 'sm')} PDF</a>
        </div>`).join('')}
    </div>` : `<div class="card" style="margin-top:22px"><div class="empty"><div class="empty-icon">${icon('bag')}</div><b>Nessun acquisto</b>Gli appunti che compri appariranno qui.<br/><br/><button class="btn btn-primary" onclick="nav('#/')">${icon('search')} Esplora il marketplace</button></div></div>`}
  </div>`;
}

/* ================= Profilo ================= */
async function pageProfile() {
  if (!S.user) { nav('#/login'); return; }
  const u = S.user;
  $app.innerHTML = `
  <div class="page page-narrow fade-in">
    <div class="card card-pad">
      <div class="profile-head">
        <div class="profile-avatar-wrap">
          ${avatarHtml(u, 'profile-avatar')}
          <div class="avatar-edit" title="Cambia immagine del profilo" onclick="document.getElementById('avatar-input').click()">${icon('camera')}</div>
          <input type="file" id="avatar-input" accept="image/*" hidden />
        </div>
        <div>
          <h1 style="font-size:26px;letter-spacing:-0.7px">${esc(u.name)}</h1>
          <p style="color:var(--text-2);font-size:14.5px">${esc(u.email)}</p>
          ${u.role === 'admin' ? `<span class="pill tint-purple" style="margin-top:8px">${icon('shield', 'sm')} Amministratore</span>` : `<span class="pill tint-blue" style="margin-top:8px">${icon('user', 'sm')} Studente & venditore</span>`}
        </div>
        <div style="margin-left:auto">
          <button class="btn btn-secondary btn-sm" id="logout">${icon('logout', 'sm')} Esci</button>
        </div>
      </div>
      <div class="divider"></div>
      <div class="field"><label>Nome e cognome</label><input class="input" id="p-name" value="${esc(u.name)}" /></div>
      <div class="field"><label>Università</label><select class="input" id="p-uni"><option value="">Seleziona…</option>${S.meta.universities.map((x) => `<option ${x === u.university ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Bio</label><textarea class="input" id="p-bio" placeholder="Racconta qualcosa di te…">${esc(u.bio)}</textarea></div>
      <button class="btn btn-primary" id="p-save">${icon('check')} Salva modifiche</button>
    </div>
  </div>`;

  document.getElementById('avatar-input').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData(); fd.append('avatar', f);
    try {
      const { user } = await api('/me/avatar', { method: 'POST', body: fd });
      S.user = user; toast('Immagine del profilo aggiornata'); renderNav('profile'); pageProfile();
    } catch (err) { toast(err.message, 'err'); }
  };
  document.getElementById('p-save').onclick = async () => {
    try {
      const { user } = await api('/me', { method: 'PUT', body: {
        name: document.getElementById('p-name').value,
        university: document.getElementById('p-uni').value,
        bio: document.getElementById('p-bio').value } });
      S.user = user; toast('Profilo aggiornato'); renderNav('profile');
    } catch (e) { toast(e.message, 'err'); }
  };
  document.getElementById('logout').onclick = async () => {
    try { await api('/logout', { method: 'POST' }); } catch {}
    S.token = null; S.user = null; S.cartCount = 0; localStorage.removeItem('nm_token');
    toast('Sei uscito dall\'account'); nav('#/');
  };
}

/* ================= Admin ================= */
async function pageAdmin() {
  if (!S.user || S.user.role !== 'admin') { nav('#/'); return; }
  $app.innerHTML = `<div class="page"><div class="skeleton" style="height:420px"></div></div>`;
  const [{ stats, recentSales }, { users }] = await Promise.all([api('/admin/stats'), api('/admin/users')]);

  $app.innerHTML = `
  <div class="page fade-in">
    <h1 class="page-title">Amministrazione</h1>
    <p class="page-sub">Controllo completo della piattaforma NoteMarket</p>

    <div class="stat-grid" style="margin-top:26px">
      <div class="card stat-card"><div class="stat-icon tint-blue">${icon('users')}</div><b>${stats.users}</b><span>Utenti registrati</span></div>
      <div class="card stat-card"><div class="stat-icon tint-purple">${icon('file')}</div><b>${stats.notes}</b><span>Appunti in vendita</span></div>
      <div class="card stat-card"><div class="stat-icon tint-amber">${icon('bag')}</div><b>${stats.sales}</b><span>Transazioni</span></div>
      <div class="card stat-card"><div class="stat-icon tint-green">${icon('euro')}</div><b>${eur(stats.volume)}</b><span>Volume totale</span></div>
      <div class="card stat-card"><div class="stat-icon tint-red">${icon('wallet')}</div><b>${eur(stats.commission_earned)}</b><span>Commissioni incassate</span></div>
    </div>

    <div class="card card-pad" style="margin-top:26px;max-width:560px">
      <h2 class="section-title">${icon('settings')} Commissione della piattaforma</h2>
      <p style="color:var(--text-2);font-size:14px;margin-bottom:16px">Percentuale trattenuta su ogni vendita. Attuale: <b>${stats.commission_pct}%</b></p>
      <div style="display:flex;gap:12px;align-items:center">
        <input class="input" id="adm-pct" type="number" min="0" max="50" step="0.5" value="${stats.commission_pct}" style="max-width:140px" />
        <span style="color:var(--text-2)">%</span>
        <button class="btn btn-primary" id="adm-pct-save">${icon('check')} Aggiorna</button>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:38px">${icon('users')} Utenti</h2>
    <div class="card table-wrap"><table class="tbl">
      <thead><tr><th>Utente</th><th>Università</th><th>Appunti</th><th>Acquisti</th><th>Saldo</th><th>Stato</th><th></th></tr></thead>
      <tbody>${users.map((u) => `
        <tr>
          <td><div style="display:flex;align-items:center;gap:10px">${avatarHtml(u)}<div><b>${esc(u.name)}</b>${u.role === 'admin' ? ` <span class="pill tint-purple" style="padding:2px 8px;font-size:10.5px">ADMIN</span>` : ''}<div style="font-size:12px;color:var(--text-3)">${esc(u.email)}</div></div></div></td>
          <td style="color:var(--text-2);font-size:13px">${esc(u.university || '—')}</td>
          <td>${u.notes_count}</td><td>${u.purchases_count}</td><td><b>${eur(u.balance)}</b></td>
          <td>${u.blocked ? `<span class="pill tint-red">${icon('block', 'sm')} Sospeso</span>` : `<span class="pill tint-green">${icon('check', 'sm')} Attivo</span>`}</td>
          <td>${u.role !== 'admin' ? `<button class="btn ${u.blocked ? 'btn-secondary' : 'btn-danger'} btn-sm" onclick="toggleBlock(${u.id})">${u.blocked ? 'Riattiva' : 'Sospendi'}</button>` : ''}</td>
        </tr>`).join('')}</tbody>
    </table></div>

    <h2 class="section-title" style="margin-top:38px">${icon('chart')} Transazioni recenti</h2>
    ${recentSales.length ? `<div class="card table-wrap"><table class="tbl">
      <thead><tr><th>Appunti</th><th>Acquirente</th><th>Venditore</th><th>Prezzo</th><th>Commissione</th><th>Data</th></tr></thead>
      <tbody>${recentSales.map((s) => `
        <tr><td style="font-weight:600">${esc(s.title)}</td><td>${esc(s.buyer_name)}</td><td>${esc(s.seller_name)}</td>
        <td>${eur(s.price)}</td><td style="color:var(--green)"><b>${eur(s.commission)}</b></td><td style="color:var(--text-2)">${fmtDate(s.created_at)}</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="card"><div class="empty" style="padding:40px"><b>Nessuna transazione</b></div></div>`}
  </div>`;

  document.getElementById('adm-pct-save').onclick = async () => {
    try {
      const r = await api('/admin/settings', { method: 'PUT', body: { commission_pct: document.getElementById('adm-pct').value } });
      S.meta.commission_pct = r.commission_pct;
      toast('Commissione aggiornata al ' + r.commission_pct + '%'); pageAdmin();
    } catch (e) { toast(e.message, 'err'); }
  };
}
window.toggleBlock = async (id) => {
  try { await api(`/admin/users/${id}/block`, { method: 'PUT' }); toast('Stato utente aggiornato'); pageAdmin(); }
  catch (e) { toast(e.message, 'err'); }
};

/* ================= Boot ================= */
(async function boot() {
  try { S.meta = await api('/meta'); } catch {}
  await refreshSession();
  router();
})();
