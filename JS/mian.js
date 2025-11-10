// ======= Datos base (2 específicos + 198 generados) =======
const baseGames = [
    { title: 'The Legend of Zelda: Breath of the Wild', year: 2017, genre: 'Aventura', platforms: ['Nintendo Switch'], type: 'Físico', format: 'Estándar' },
    { title: 'The Legend of Zelda: Tears of the Kingdom', year: 2023, genre: 'Aventura', platforms: ['Nintendo Switch'], type: 'Físico', format: 'Deluxe' },
];

// Semillas
const adjectives = ['Crimson', 'Neon', 'Lost', 'Iron', 'Quantum', 'Eternal', 'Shadow', 'Solar', 'Cyber', 'Phantom', 'Arcane', 'Prime', 'Infinite', 'Wild', 'Hidden', 'Turbo', 'Silent', 'Galactic', 'Mythic', 'Turbo'];
const nouns = ['Odyssey', 'Frontier', 'Legends', 'Protocol', 'Horizon', 'Outlaws', 'Chronicles', 'Drift', 'Echoes', 'Kingdoms', 'Rift', 'Voyage', 'Uprising', 'Citadel', 'Reckoning', 'Origins', 'Apex', 'Spectrum', 'Vertex', 'Run'];
const genresSeed = ['Acción', 'Aventura', 'RPG', 'Estrategia', 'Shooter', 'Plataformas', 'Carreras', 'Simulación', 'Lucha', 'Indie'];
const platsSeed = ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch'];
const storesAll = ['Steam', 'Epic Games Store', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop'];
const typesSeed = ['Físico', 'Digital', 'Otro'];
const formatsSeed = ['Estándar', 'Deluxe', 'Coleccionista'];

// Generador títulos únicos
const used = new Set(baseGames.map(g => g.title.toLowerCase()));
function uniqueTitle() {
    let t;
    do {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const suffix = Math.random() < 0.35 ? ' ' + (2000 + Math.floor(Math.random() * 26)) : '';
        t = `${adj} ${noun}${suffix}`;
    } while (used.has(t.toLowerCase()));
    used.add(t.toLowerCase());
    return t;
}

while (baseGames.length < 200) {
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

// ======= UI =======
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

function slug(s) {
    return s.toLowerCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-');
}
function money(n) {
    try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(n); }
    catch { return `$${n.toFixed(2)}`; }
}

// Genera precios y ratings – mantiene lista de tiendas por juego
function enrich(game) {
    const regular = 19 + Math.random() * 51; // 19-70
    const stores = [...storesAll].sort(() => Math.random() - 0.5).slice(0, 3);
    const storePrices = stores.map(name => ({ name, price: +(regular * (0.6 + Math.random() * 0.35)).toFixed(2) }));
    const best = storePrices.reduce((a, b) => a.price <= b.price ? a : b);
    const discountPct = Math.max(0, Math.round((1 - best.price / regular) * 100));
    const mc = Math.floor(55 + Math.random() * 43); // 55 - 97
    return { ...game, regular: +regular.toFixed(2), storePrices, best, discountPct, mc };
}

const pricedGames = baseGames.map(enrich);

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
        const contentArea = document.querySelector('.content-area');
        contentArea.appendChild(pager);
        // estilos mínimos de la paginación
        const style = document.createElement('style');
        style.textContent = `.pager{display:flex;gap:6px;justify-content:center;margin:18px 0 6px}` +
            `.pager button{background:var(--panel);border:1px solid rgba(255,255,255,.08);` +
            `color:var(--text);padding:8px 10px;border-radius:10px;cursor:pointer}` +
            `.pager button[disabled]{opacity:.5;cursor:not-allowed}` +
            `.pager .is-active{outline:2px solid var(--ring);}`;
        document.head.appendChild(style);
    }
    return pager;
}

function renderPagination(totalPages) {
    const pager = ensurePager();
    pager.innerHTML = '';
    const mkBtn = (label, page, disabled = false, active = false) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (disabled) b.disabled = true;
        if (active) b.classList.add('is-active');
        b.addEventListener('click', () => { goToPage(page); });
        return b;
    };
    pager.appendChild(mkBtn('«', Math.max(1, currentPage - 1), currentPage === 1));
    for (let p = 1; p <= totalPages; p++) pager.appendChild(mkBtn(String(p), p, false, p === currentPage));
    pager.appendChild(mkBtn('»', Math.min(totalPages, currentPage + 1), currentPage === totalPages));
}

function goToPage(p) {
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, p), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = lastFiltered.slice(start, start + PAGE_SIZE);
    render(pageItems);
    renderPagination(totalPages);
}

// ==== Construcción de checklists ====
function buildChecklist(container, items, name) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(val => {
        const id = `${name}-${slug(String(val))}`;
        const label = document.createElement('label');
        label.className = 'checkbox';
        label.setAttribute('for', id);
        label.innerHTML = `<input type="checkbox" id="${id}" value="${val}"><span>${val}</span>`;
        container.appendChild(label);
    });
}

(function initFilters() {
    const platforms = Array.from(new Set(pricedGames.flatMap(g => g.platforms)));
    const types = Array.from(new Set(pricedGames.map(g => g.type)));
    const formats = Array.from(new Set(pricedGames.map(g => g.format)));
    const stores = Array.from(new Set(pricedGames.flatMap(g => g.storePrices.map(s => s.name))));
    buildChecklist(filtersTypes, types, 'type');
    buildChecklist(filtersPlatforms, platforms, 'plat');
    buildChecklist(filtersFormats, formats, 'fmt');
    buildChecklist(filtersStores, stores, 'store');
})();

// Lazy-load con IntersectionObserver
const io = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { const img = entry.target; img.src = img.dataset.src; io.unobserve(img); } });
}, { rootMargin: '200px 0px' });

function getCheckedValues(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
}

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
        if (g.mc >= 75) mcEl.classList.add('ok');
        else if (g.mc >= 60) mcEl.classList.add('warn');
        else mcEl.classList.add('bad');

        g.platforms.forEach(p => { const b = document.createElement('span'); b.className = 'badge'; b.textContent = p; platsWrap.appendChild(b); });

        bestPrice.textContent = money(g.best.price) + ' • mejor precio';
        bestStore.textContent = g.best.name;
        regularPrice.textContent = money(g.regular);
        discountBadge.textContent = `-${g.discountPct}%`;

        const seed = slug(g.title);
        img.dataset.src = `https://picsum.photos/seed/${seed}/600/338`;
        img.alt = `Portada de ${g.title}`;
        io.observe(img);

        grid.appendChild(node);
    });
    // Total global
    count.textContent = 'GGs a los precios altos';
}

function applyFilters() {
    const term = q.value.trim().toLowerCase();
    const typesSel = getCheckedValues(filtersTypes);
    const platsSel = getCheckedValues(filtersPlatforms);
    const fmtsSel = getCheckedValues(filtersFormats);
    const storesSel = getCheckedValues(filtersStores);

    let filtered = pricedGames.slice();
    filtered = filtered.filter(g => {
        const matchTerm = !term || g.title.toLowerCase().includes(term) || (g.genre || '').toLowerCase().includes(term);
        const matchType = !typesSel.length || typesSel.includes(g.type);
        const matchPlat = !platsSel.length || (g.platforms || []).some(p => platsSel.includes(p));
        const matchFmt = !fmtsSel.length || fmtsSel.includes(g.format);
        const matchStore = !storesSel.length || (g.storePrices || [{ name: g.best?.name }]).some(s => storesSel.includes(s.name));
        return matchTerm && matchType && matchPlat && matchFmt && matchStore;
    });

    switch (sort.value) {
        case 'name-asc': filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'name-desc': filtered.sort((a, b) => b.title.localeCompare(a.title)); break;
        case 'price-asc': filtered.sort((a, b) => a.best.price - b.best.price); break;
        case 'price-desc': filtered.sort((a, b) => b.best.price - a.best.price); break;
        case 'discount-desc': filtered.sort((a, b) => b.discountPct - a.discountPct); break;
        case 'discount-asc': filtered.sort((a, b) => a.discountPct - b.discountPct); break;
        case 'mc-desc': filtered.sort((a, b) => b.mc - a.mc); break;
        case 'mc-asc': filtered.sort((a, b) => a.mc - b.mc); break;
    }

    lastFiltered = filtered;
    currentPage = 1; // reset a la primera página con cada cambio
    goToPage(currentPage);
}

q.addEventListener('input', applyFilters);
sort.addEventListener('change', applyFilters);
filters.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) applyFilters(); });

q.addEventListener('focus', () => q.parentElement.classList.add('ring'));
q.addEventListener('blur', () => q.parentElement.classList.remove('ring'));

// Render inicial
applyFilters();