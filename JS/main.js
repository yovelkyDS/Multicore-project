// main.js (ESM) — requiere que index.html lo cargue con: <script type="module" src="JS/main.js"></script>

// ======= Imports Firestore (CDN v10) =======
import {
    collection,
    getDocs,
    writeBatch,
    doc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ======= Utilidades =======
const moneyFmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });
const slug = (s) => s.toLowerCase().trim().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-');

// ======= Datos locales (fallback) =======
const storesAll = ['Steam', 'Epic Games Store', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop'];
const genresSeed = ['Acción', 'Aventura', 'RPG', 'Estrategia', 'Shooter', 'Plataformas', 'Carreras', 'Simulación', 'Lucha', 'Indie'];
const platsSeed = ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch'];
const typesSeed = ['Físico', 'Digital', 'Otro'];
const formatsSeed = ['Estándar', 'Deluxe', 'Coleccionista'];
const adjectives = ['Crimson', 'Neon', 'Lost', 'Iron', 'Quantum', 'Hidden', 'Turbo', 'Silent', 'Galactic', 'Mythic'];
const nouns = ['Odyssey', 'Frontier', 'Legends', 'Protocol', 'Horizon', 'Eclipse', 'Voyage', 'Chronicles', 'Apex', 'Spectrum'];

const baseGames = [
    { title: 'The Legend of Zelda: Breath of the Wild', year: 2017, genre: 'Aventura', platforms: ['Nintendo Switch'], type: 'Físico', format: 'Estándar' },
    { title: 'The Legend of Zelda: Tears of the Kingdom', year: 2023, genre: 'Aventura', platforms: ['Nintendo Switch'], type: 'Físico', format: 'Deluxe' },
];

function uniqueTitleFactory() {
    const used = new Set(baseGames.map(g => g.title.toLowerCase()));
    return function uniqueTitle() {
        let t;
        do {
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const suffix = Math.random() < 0.35 ? ' ' + (2000 + Math.floor(Math.random() * 26)) : '';
            t = `${adj} ${noun}${suffix}`;
        } while (used.has(t.toLowerCase()));
        used.add(t.toLowerCase());
        return t;
    };
}
const uniqueTitle = uniqueTitleFactory();

// Genera ~60 juegos locales
while (baseGames.length < 60) {
    baseGames.push({
        title: uniqueTitle(),
        year: 2000 + Math.floor(Math.random() * 26),
        genre: genresSeed[Math.floor(Math.random() * genresSeed.length)],
        type: typesSeed[Math.floor(Math.random() * typesSeed.length)],
        format: formatsSeed[Math.floor(Math.random() * formatsSeed.length)],
        platforms: [...new Set([
            platsSeed[Math.floor(Math.random() * platsSeed.length)],
            ...(Math.random() < 0.35 ? [platsSeed[Math.floor(Math.random() * platsSeed.length)]] : [])
        ])]
    });
}

// ======= Enriquecedor (precios, descuento, MC) =======
function enrich(game) {
    const regular = 9000 + Math.random() * 41000; // 9k - 50k CRC aprox
    const stores = [...storesAll].sort(() => Math.random() - 0.5).slice(0, 3);
    const storePrices = stores.map(name => ({ name, price: +(regular * (0.6 + Math.random() * 0.35)).toFixed(0) }));
    const best = storePrices.reduce((a, b) => a.price <= b.price ? a : b);
    const discountPct = Math.max(0, Math.round((1 - best.price / regular) * 100));
    const mc = Math.floor(55 + Math.random() * 43); // 55 - 97
    return { ...game, regular: Math.round(regular), storePrices, best, discountPct, mc };
}

let pricedGames = baseGames.map(enrich);

// ======= UI refs =======
const grid = document.getElementById('grid');
const tpl = document.getElementById('card-tpl');
const q = document.getElementById('q');
const filters = document.getElementById('filters');
const sort = document.getElementById('sort');
const count = document.getElementById('count');

const filtersTypes = document.getElementById('filters-types');
const filtersPlatforms = document.getElementById('filters-platforms');
const filtersFormats = document.getElementById('filters-formats');
const filtersStores = document.getElementById('filters-stores');

// ======= Checklists =======
function buildChecklist(container, items, groupName) {
    if (!container) return;
    const uniq = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'es'));
    container.innerHTML = '';
    uniq.forEach(val => {
        const id = `${groupName}-${slug(val)}`;
        const label = document.createElement('label');
        label.className = 'checkbox';
        label.innerHTML = `
      <input type="checkbox" value="${val}" id="${id}">
      <span>${val}</span>
    `;
        container.appendChild(label);
    });
}

function readChecked(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
}

// Construye filtros (inicial y cada vez que cambien los datos de origen)
function rebuildFilters() {
    const platforms = Array.from(new Set(pricedGames.flatMap(g => g.platforms)));
    const types = Array.from(new Set(pricedGames.map(g => g.type)));
    const formats = Array.from(new Set(pricedGames.map(g => g.format)));
    const stores = Array.from(new Set(pricedGames.flatMap(g => g.storePrices.map(s => s.name))));
    buildChecklist(filtersTypes, types, 'type');
    buildChecklist(filtersPlatforms, platforms, 'plat');
    buildChecklist(filtersFormats, formats, 'fmt');
    buildChecklist(filtersStores, stores, 'store');
}
rebuildFilters();

// ======= Render tarjetas =======
function render(list) {
    grid.innerHTML = '';
    list.forEach((g) => {
        const node = tpl.content.cloneNode(true);
        const img = node.querySelector('img');
        const platsWrap = node.querySelector('.platforms');
        const title = node.querySelector('.title');
        const yr = node.querySelector('.year');
        const gen = node.querySelector('.genre');
        const mcEl = node.querySelector('.metacritic');
        const mcScoreEl = node.querySelector('.mc-score');
        const bestPrice = node.querySelector('.best-price');
        const bestStore = node.querySelector('.best-store');
        const regularPrice = node.querySelector('.regular-price');
        const discountBadge = node.querySelector('.badge-discount');

        title.textContent = g.title;
        yr.textContent = g.year;
        gen.textContent = g.genre;

        mcScoreEl.textContent = g.mc;
        mcEl.classList.remove('ok', 'warn', 'bad');
        if (g.mc >= 75) mcEl.classList.add('ok');
        else if (g.mc >= 60) mcEl.classList.add('warn');
        else mcEl.classList.add('bad');

        platsWrap.innerHTML = '';
        g.platforms.forEach(p => {
            const b = document.createElement('span');
            b.className = 'badge';
            b.textContent = p;
            platsWrap.appendChild(b);
        });

        bestPrice.textContent = moneyFmt.format(g.best.price);
        bestStore.textContent = g.best.name;
        regularPrice.textContent = moneyFmt.format(g.regular);

        if (g.discountPct > 0) {
            discountBadge.style.display = '';
            discountBadge.textContent = `−${g.discountPct}%`;
        } else {
            discountBadge.style.display = 'none';
        }

        if (img) {
            const seed = encodeURIComponent(slug(g.title));
            img.alt = g.title;
            img.loading = 'lazy';
            img.src = `https://picsum.photos/seed/${seed}/400/225`;
            img.width = 400; img.height = 225;
        }

        grid.appendChild(node);
    });
}

// ======= Paginación =======
const PAGE_SIZE = 20;
let currentPage = 1;
let lastFiltered = [];

function ensurePager() {
    let pager = document.getElementById('pager');
    if (!pager) {
        pager = document.createElement('nav');
        pager.id = 'pager';
        pager.className = 'pager';
        const contentArea = document.querySelector('.content-area') || document.body;
        contentArea.appendChild(pager);

        const style = document.createElement('style');
        style.textContent =
            `.pager{display:flex;gap:6px;justify-content:center;margin:18px 0 6px}` +
            `.pager button{background:var(--panel);border:1px solid rgba(255,255,255,.08);color:var(--text);padding:8px 10px;border-radius:10px;cursor:pointer}` +
            `.pager button[disabled]{opacity:.5;cursor:not-allowed}`;
        document.head.appendChild(style);
    }
    pager.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));

    const mkBtn = (txt, disabled, onClick) => {
        const b = document.createElement('button');
        b.textContent = txt;
        if (disabled) b.disabled = true;
        if (onClick) b.addEventListener('click', onClick);
        return b;
    };
    pager.appendChild(mkBtn('⟨', currentPage === 1, () => goToPage(currentPage - 1)));
    for (let i = 1; i <= totalPages; i++) {
        const b = mkBtn(String(i), i === currentPage, () => goToPage(i));
        pager.appendChild(b);
    }
    pager.appendChild(mkBtn('⟩', currentPage === totalPages, () => goToPage(currentPage + 1)));
}

function goToPage(n) {
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, n), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = lastFiltered.slice(start, start + PAGE_SIZE);
    render(page);
    ensurePager();
    count.textContent = `${lastFiltered.length} ${lastFiltered.length === 1 ? 'resultado' : 'resultados'}`;
}

// ======= Filtros y orden =======
function applyFilters() {
    const term = q.value.trim().toLowerCase();
    const selTypes = readChecked(filtersTypes);
    const selPlats = readChecked(filtersPlatforms);
    const selFormats = readChecked(filtersFormats);
    const selStores = readChecked(filtersStores);

    let filtered = pricedGames.filter(g => {
        const hayTerm = !term || (
            g.title.toLowerCase().includes(term) ||
            (g.genre || '').toLowerCase().includes(term) ||
            g.platforms.some(p => p.toLowerCase().includes(term))
        );

        const typeOk = !selTypes.length || selTypes.includes(g.type);
        const platOk = !selPlats.length || g.platforms.some(p => selPlats.includes(p));
        const fmtOk = !selFormats.length || selFormats.includes(g.format);
        const storeOk = !selStores.length || g.storePrices.some(s => selStores.includes(s.name));

        return hayTerm && typeOk && platOk && fmtOk && storeOk;
    });

    // Orden
    const s = sort.value;
    const cmp = {
        'name-asc': (a, b) => a.title.localeCompare(b.title, 'es'),
        'name-desc': (a, b) => b.title.localeCompare(a.title, 'es'),
        'year-asc': (a, b) => a.year - b.year,
        'year-desc': (a, b) => b.year - a.year,
        'price-asc': (a, b) => a.best.price - b.best.price,
        'price-desc': (a, b) => b.best.price - a.best.price,
        'discount-asc': (a, b) => a.discountPct - b.discountPct,
        'discount-desc': (a, b) => b.discountPct - a.discountPct,
        'mc-asc': (a, b) => a.mc - b.mc,
        'mc-desc': (a, b) => b.mc - a.mc,
    }[s] || ((a, b) => a.title.localeCompare(b.title, 'es'));

    filtered.sort(cmp);

    lastFiltered = filtered;
    currentPage = 1;
    goToPage(currentPage);
}

// ======= Eventos =======
q.addEventListener('input', applyFilters);
sort.addEventListener('change', applyFilters);
filters.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) applyFilters(); });
q.addEventListener('focus', () => q.parentElement.classList.add('ring'));
q.addEventListener('blur', () => q.parentElement.classList.remove('ring'));

// ======= Carga inicial (local) =======
applyFilters();

// ======= Firestore: cargar y sembrar sólo si está vacío =======
async function loadFromFirestoreAndMaybeSeed() {
    const db = window.__DB__;
    if (!db) return; // si aún no cargó el bootstrap de Firebase

    const colRef = collection(db, "games");
    const snap = await getDocs(colRef);

    // Si la colección está vacía, sembramos una única vez usando baseGames
    if (snap.empty) {
        const batch = writeBatch(db);
        baseGames.forEach(g => {
            batch.set(doc(colRef), {
                title: g.title,
                year: g.year,
                genre: g.genre,
                platforms: g.platforms,
                type: g.type,
                format: g.format
            });
        });
        await batch.commit();
    }

    // Leemos (segunda pasada si se sembró, o la primera si ya existían docs)
    const fresh = await getDocs(colRef);
    const items = [];
    fresh.forEach(d => {
        const x = d.data();
        items.push(enrich({
            title: x.title ?? "Sin título",
            year: x.year ?? 2024,
            genre: x.genre ?? "Otro",
            platforms: Array.isArray(x.platforms) ? x.platforms : [x.platforms].filter(Boolean),
            type: x.type ?? "Digital",
            format: x.format ?? "Estándar"
        }));
    });

    if (items.length) {
        pricedGames = items;
        rebuildFilters();
        applyFilters();
    }
}

// Intenta cargar desde Firestore (si index.html ya expuso window.__DB__)
loadFromFirestoreAndMaybeSeed().catch(console.error);
