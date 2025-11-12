// details.js (ESM)

// ====== Utils ======
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const slug = (s) => s.toLowerCase().trim().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-');

// --- lee el token que viene en la URL (ver main.js/openDetails) ---
const params = new URLSearchParams(location.search);
const key = params.get('key');

let game = null;
try {
    if (key) {
        const raw = localStorage.getItem(key);
        if (raw) {
            game = JSON.parse(raw);
            localStorage.removeItem(key);
        }
    }
    if (!game) game = JSON.parse(sessionStorage.getItem('selectedGame') || 'null');
} catch { /* ignore */ }

if (!game) {
    document.body.innerHTML = '<div style="max-width:700px;margin:40px auto;color:#e9edf1">No hay juego seleccionado. Regresa y haz click en una tarjeta.</div>';
    throw new Error('No selected game');
}

// ---------- Imagen (resolver compacto como en main) ----------
function simpleSanitize(name) { return name.replace(/[\\/:*?"<>|]/g, ' ').replace(/['’`]/g, '').replace(/\s+/g, ' ').trim(); }
function combosFromBase(s) { return Array.from(new Set([s, s.replace(/\s+/g, '_'), s.replace(/\s+/g, '-'), s.replace(/\s+/g, '')])); }
function filenameVariantsWithYears(title, year) {
    const raw1 = simpleSanitize(title), noPar = raw1.replace(/[(){}\[\]]/g, '').trim();
    const lower = raw1.toLowerCase(), lowerNP = noPar.toLowerCase();
    const noAcc = lower.normalize('NFD').replace(/\p{Diacritic}/gu, ''), noAccNP = lowerNP.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const s = slug(title), sUnd = s.replace(/-/g, '_');
    const bases = [raw1, noPar, lower, lowerNP, noAcc, noAccNP, s, sUnd];
    const yrs = []; if (Number.isFinite(+year) && +year > 1970 && +year < 2100) yrs.push(+year);
    [2021, 2022, 2023, 2024, 2025].forEach(y => { if (!yrs.includes(y)) yrs.push(y) });
    const set = new Set(); for (const b of bases) combosFromBase(b).forEach(v => set.add(v));
    for (const b of bases) {
        for (const y of yrs) {
            [`${b} ${y}`, `${b}_${y}`, `${b}-${y}`, `${b}(${y})`].forEach(w => combosFromBase(w).forEach(v => set.add(v)));
        }
    }
    return [...set];
}
function imageCandidatesForGame(g) {
    const names = filenameVariantsWithYears(g.title, Number(g.year));
    const dirs = ['imagenes']; const exts = ['webp', 'jpg', 'jpeg', 'png', 'avif'];
    const c = [];
    for (const d of dirs) for (const n of names) for (const e of exts) {
        c.push(`./${d}/${n}.${e}`); c.push(`./${d}/${n}.${e.toUpperCase()}`);
    }
    return c;
}
function setCover(imgEl, g) {
    const manual = (g.cover && typeof g.cover === 'string') ? [g.cover] : [];
    const fallback = `https://picsum.photos/seed/${slug(g.title)}/800/450`;
    const candidates = [...manual, ...imageCandidatesForGame(g), fallback].map(encodeURI);
    let i = 0; const next = () => { if (i >= candidates.length) return; imgEl.src = candidates[i++]; };
    imgEl.onerror = next; next();
}

// ---------- Tiendas / URLs ----------
function storeSearchUrl(store, title) {
    const q = encodeURIComponent(title);
    const m = {
        'Amazon': `https://www.amazon.com/s?k=${q}`,
        'Steam': `https://store.steampowered.com/search/?term=${q}`,
        'GOG': `https://www.gog.com/en/games?query=${q}`,
        'Epic Games Store': `https://store.epicgames.com/en-US/browse?q=${q}`,
        'PlayStation Store': `https://store.playstation.com/es-es/search/${q}`,
        'Xbox Store': `https://www.xbox.com/es-ES/search?q=${q}`,
        'Nintendo eShop': `https://www.nintendo.com/search/#q=${q}`
    };
    return m[store] || `https://www.google.com/search?q=${q}`;
}

// ---------- HLTB helpers ----------
function fmtHrs(val) {
    if (!val && val !== 0) return '—';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') {
        const mins = val > 100 ? val : Math.round(val * 60); // admite horas o minutos
        const h = Math.floor(mins / 60), m = mins % 60;
        return m ? `${h} h ${m} min` : `${h} h`;
    }
    if (typeof val === 'object' && 'min' in val) return fmtHrs(val.min);
    return '—';
}

// ---------- Pintado ----------
const $ = (s) => document.querySelector(s);

$('#title').textContent = game.title;
$('#subtitle').textContent = [(game.genre || '').trim(), game.year || ''].filter(Boolean).join(' · ');
$('#msrp').textContent = game.regular ? moneyFmt.format(game.regular) : '—';
$('#score').textContent = (game.mc ?? '—');

setCover($('#cover'), game);

// ---- Lista de precios: oferta, original (tachado) y % ----
const prices = (Array.isArray(game.storePrices) ? [...game.storePrices] : []).sort((a, b) => a.price - b.price);
const container = $('#prices');

if (!prices.length) {
    container.innerHTML = '<div class="muted">No hay precios disponibles.</div>';
} else {
    prices.forEach(p => {
        const a = document.createElement('a');
        a.className = 'price-row';
        a.target = '_blank';
        a.rel = 'noopener';
        a.href = p.url || storeSearchUrl(p.name, game.title);

        // tomamos el "regular" global si es mayor al precio de la tienda
        const original = (game.regular && game.regular > p.price) ? game.regular : null;
        const pct = original ? Math.max(0, Math.round((1 - p.price / original) * 100)) : 0;

        a.innerHTML = `
      <div class="store">${p.name}</div>
      <div class="price-right">
        <div class="offer" aria-label="Precio de oferta">${moneyFmt.format(p.price)}</div>
        ${original ? `<div class="original" aria-label="Precio original">${moneyFmt.format(original)}</div>` : ''}
        ${pct ? `<span class="disc" aria-label="Descuento">-${pct}%</span>` : ''}
      </div>
    `;
        container.appendChild(a);
    });
}

// HLTB (si en tu BD viene como game.hltb = { main, extra, completionist })
const h = game.hltb || {};
$('#hltb-main').textContent = fmtHrs(h.main);
$('#hltb-extra').textContent = fmtHrs(h.extra);
$('#hltb-comp').textContent = fmtHrs(h.completionist || h.comp);

// Botón wishlist (placeholder)
document.getElementById('wish').addEventListener('click', () => {
    alert('Añadido a wishlist (demo).');
});
