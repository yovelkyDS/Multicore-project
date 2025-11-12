// main.js (ESM) — cárgalo en index.html así: <script type="module" src="JS/main.js"></script>

import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

// ================== Utilidades ==================
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const slug = (s) => s.toLowerCase().trim().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-');

// ================== Imágenes ==================
// Se buscarán imágenes dentro de /imagenes (al nivel de index.html)
const IMAGE_DIRS = ['imagenes'];
const IMAGE_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'avif'];
let DEBUG_IMAGES = false; // pon true para ver intentos/éxitos en consola

// Limpia inválidos Windows, apóstrofes y comprime espacios
function simpleSanitize(name) {
    return name
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/['’`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function combosFromBase(s) {
    return Array.from(new Set([
        s,
        s.replace(/\s+/g, '_'),
        s.replace(/\s+/g, '-'),
        s.replace(/\s+/g, '')
    ]));
}

// === Normalizador y overrides para casos difíciles ===
function normKey(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, ''); // solo letras y números
}

// Mapa (estático) de casos problemáticos (título EN LA CARD -> archivo en /imagenes)
const OVERRIDE_COVERS = new Map([
    // Call of Duty: Modern Warfare III (2022) — por si en alguna parte aparece “III”
    ['callofdutymodernwarfareiii', './imagenes/Call_of_Duty_Modern_Warfare_III_2022.png'],
    // Call of Duty: Modern Warfare II (2022) — título real que usas
    ['callofdutymodernwarfareii2022', './imagenes/Call_of_Duty_Modern_Warfare_III_2022.png'],
    ['callofdutymodernwarfareii', './imagenes/Call_of_Duty_Modern_Warfare_III_2022.png'],

    // Destiny 2: The Final Shape (expansión de pago)
    ['destiny2thefinalshapeexpansiondepago', './imagenes/Destiny_2_The_Final_Shape.png'],
    ['destiny2thefinalshape', './imagenes/Destiny_2_The_Final_Shape.png'],

    // Hades II (Early Access) — acepta II o 2
    ['hadesiiearlyaccess', './imagenes/Hades_II_Early Access.webp'],
    ['hades2earlyaccess', './imagenes/Hades_II_Early Access.webp'],

    // Horizon Forbidden West (el archivo tiene typo "Frobidden")
    ['horizonforbiddenwest', './imagenes/Horizon_Frobidden_West.jpg'],

    // Microsoft Flight Simulator 2024 (con espacios raros en el nombre real)
    ['microsoftflightsimulator2024', './imagenes/Microsoft_Flight _Simulator _2024.jpg'],

    // Remnant II / Remnant 2
    ['remnantii', './imagenes/Remnant_2.jpg'],
    ['remnant2', './imagenes/Remnant_2.jpg'],

    // The Lord of the Rings: Return to Moria (archivo en orden invertido + espacio en "of the")
    ['thelordoftheringsreturntomoria', './imagenes/Return_to_Moria_The_Lord_of the_Rings.png'],
    ['returntomoriathelordoftherings', './imagenes/Return_to_Moria_The_Lord_of the_Rings.png'],

    // Super Mario 3D World + Bowser's Fury
    ['supermario3dworldbowsersfury', './imagenes/Super_Mario_3D_World_Bowsers_Fury.jpg'],

    // The Witcher 3: Wild Hunt — Complete Edition (en dash “–” en el archivo)
    ['thewitcher3wildhuntcompleteedition', './imagenes/The_Witcher_3_Wild_Hunt–Complete_Edition.jpg'],
]);

// Mapa (dinámico) que podemos cargar desde ./imagenes/map.json (opcional)
const RUNTIME_COVERS = new Map();
async function loadImageMap() {
    try {
        const res = await fetch('./imagenes/map.json', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        for (const [k, v] of Object.entries(json)) {
            if (typeof v === 'string' && v.trim()) {
                const path = (v.startsWith('http') || v.startsWith('./') || v.startsWith('/')) ? v : `./imagenes/${v}`;
                RUNTIME_COVERS.set(normKey(k), path);
            }
        }
        if (DEBUG_IMAGES) console.log('[IMG map.json] cargado', RUNTIME_COVERS);
    } catch (e) {
        if (DEBUG_IMAGES) console.warn('[IMG map.json] no encontrado o inválido', e);
    }
}

function coverOverrideForTitle(title) {
    const key = normKey(title);
    return RUNTIME_COVERS.get(key) || OVERRIDE_COVERS.get(key) || null;
}

// Genera variantes de nombre con/sin año y sin paréntesis
function filenameVariantsWithYears(title, year) {
    const raw1 = simpleSanitize(title);                       // "Astro Bot (2024)"
    const noPar = raw1.replace(/[(){}\[\]]/g, '').trim();      // "Astro Bot 2024"
    const lower = raw1.toLowerCase();
    const lowerNP = noPar.toLowerCase();
    const noAcc = lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const noAccNP = lowerNP.normalize('NFD').replace(/\p{Diacritic}/gu, '');

    // También probamos el slug y una variante del slug con "_"
    const s = slug(title);               // "astro-bot-2024"
    const sUnd = s.replace(/-/g, '_');      // "astro_bot_2024"

    // Bases sobre las que generamos combinaciones
    theBases: ;
    const bases = [raw1, noPar, lower, lowerNP, noAcc, noAccNP, s, sUnd];

    // Años a probar: el del juego + algunos recientes
    const yrs = [];
    if (Number.isFinite(year) && year > 1970 && year < 2100) yrs.push(year);
    [2021, 2022, 2023, 2024, 2025].forEach(y => { if (!yrs.includes(y)) yrs.push(y); });

    const set = new Set();

    // Variantes sin año
    for (const b of bases) combosFromBase(b).forEach(v => set.add(v));

    // Variantes con año
    for (const b of bases) {
        for (const y of yrs) {
            const withYear = [
                `${b} ${y}`, `${b}_${y}`, `${b}-${y}`, `${b}(${y})`
            ];
            withYear.forEach(w => combosFromBase(w).forEach(v => set.add(v)));
        }
    }

    return [...set];
}

function imageCandidatesForGame(game) {
    const names = filenameVariantsWithYears(game.title, Number(game.year));
    const cands = [];
    for (const dir of IMAGE_DIRS) {
        for (const n of names) {
            for (const ext of IMAGE_EXTS) {
                cands.push(`./${dir}/${n}.${ext}`);
                cands.push(`./${dir}/${n}.${ext.toUpperCase()}`); // .JPG/.PNG/etc
            }
        }
    }
    return cands;
}

// cover explícita/override -> archivos locales -> placeholder
function setCardImage(imgEl, game) {
    const override = coverOverrideForTitle(game.title);
    const manual = override
        ? [override]
        : (game.cover && typeof game.cover === 'string') ? [game.cover] : [];

    const fallback = `https://picsum.photos/seed/${slug(game.title)}/400/225`;
    const rawCandidates = [...manual, ...imageCandidatesForGame(game), fallback];

    // Asegura URLs válidas (espacios y caracteres raros)
    const candidates = rawCandidates.map(src => encodeURI(src));

    let i = 0;
    const tryNext = () => {
        if (i >= candidates.length) return;
        const src = candidates[i++];
        if (DEBUG_IMAGES) console.log('[IMG try]', game.title, '->', src);
        imgEl.src = src;
    };

    imgEl.onerror = tryNext;
    imgEl.onload = () => { if (DEBUG_IMAGES) console.log('[IMG ok ]', game.title, '->', imgEl.currentSrc || imgEl.src); };

    imgEl.alt = game.title;
    imgEl.loading = 'lazy'; // lazy nativo
    imgEl.width = 400;
    imgEl.height = 225;

    tryNext();
}

// ================== Datos locales (fallback) ==================
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

// ================== Enriquecedor (precios, descuento, MC) ==================
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

// ================== UI refs ==================
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

// ================== Checklists ==================
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

// ========= Abrir detalle en nueva pestaña =========
function openDetails(game) {
    // guardamos el juego con un token único
    const key = 'sel-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem(key, JSON.stringify(game));

    // abrimos details.html con el token en la query
    window.open('details.html?key=' + encodeURIComponent(key), '_blank'); // puedes añadir 'noopener' si quieres
}

// ================== Render tarjetas ==================
function render(list) {
    grid.innerHTML = '';
    list.forEach((g) => {
        const node = tpl.content.cloneNode(true);

        // Click en toda la card para abrir detalles
        const cardEl = node.querySelector('.card') || node.firstElementChild || node;
        cardEl.addEventListener('click', () => openDetails(g));

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

        if (img) setCardImage(img, g);
        grid.appendChild(node);
    });
}

// ================== Paginación ==================
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

// ================== Carga desde Realtime Database ==================
async function loadFromRealtimeDB() {
    const db = window.__RTDB__; // asegúrate en index.html de hacer: window.__RTDB__ = getDatabase(app);
    if (!db) return;

    const snapshot = await get(ref(db, "juegos"));
    if (!snapshot.exists()) {
        console.warn("No hay datos en Realtime Database");
        return;
    }

    const data = snapshot.val();

    const items = Object.values(data).map(j => {
        const amazon = j?.precios?.amazon?.precio ?? null;
        const psn = j?.precios?.playstation?.precio ?? null;

        const storePrices = [
            ...(amazon ? [{ name: "Amazon", price: Math.round(amazon), url: j?.precios?.amazon?.url || null }] : []),
            ...(psn ? [{ name: "PlayStation Store", price: Math.round(psn), url: j?.precios?.playstation?.url || null }] : []),
        ];

        const best = storePrices.length
            ? storePrices.reduce((a, b) => (a.price <= b.price ? a : b))
            : { name: "N/D", price: 0 };

        const regular = storePrices.length
            ? Math.max(...storePrices.map(s => s.price))
            : 0;

        const discountPct = regular > 0 ? Math.max(0, Math.round((1 - best.price / regular) * 100)) : 0;

        return {
            title: j.nombreJuego ?? "Sin título",
            genre: j.genero ?? "Otro",
            year: Number(j.anio) || 2024,
            platforms: Array.isArray(j.plataformas) && j.plataformas.length ? j.plataformas : ["PC"],
            type: j.tipo ?? "Digital",
            format: j.formato ?? "Estándar",

            // Imagen prioritaria si viene en la BD (URL o nombre de archivo)
            cover: j.imagen
                ? (j.imagen.startsWith('http') || j.imagen.startsWith('./') || j.imagen.startsWith('/'))
                    ? j.imagen
                    : `./imagenes/${j.imagen}`
                : null,

            storePrices,
            best,
            regular,
            discountPct,
            mc: Number(j.mc) || 70,

            // (Opcional) tiempos HLTB si los guardas en la BD
            hltb: j.hltb || null,
        };
    });

    if (items.length) {
        pricedGames = items;
        rebuildFilters();
        applyFilters();
    }
}

// ================== Filtros y orden ==================
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

// ================== Eventos ==================
q.addEventListener('input', applyFilters);
sort.addEventListener('change', applyFilters);
filters.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) applyFilters(); });
q.addEventListener('focus', () => q.parentElement.classList.add('ring'));
q.addEventListener('blur', () => q.parentElement.classList.remove('ring'));

// ================== Carga inicial (local) ==================
applyFilters();

// ================== Carga remota + mapa de imágenes ==================
window.addEventListener("load", () => {
    // Carga primero el mapa dinámico si existe, luego datos
    loadImageMap()
        .catch(console.warn)
        .finally(() => {
            loadFromRealtimeDB().catch(console.error);
        });
});