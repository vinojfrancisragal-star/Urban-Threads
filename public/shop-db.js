/**
 * shop-db.js — Product loader for shop.html
 *
 * Targets #product-grid and integrates with the existing sidebar
 * (search, sort, price-filter, sale checkbox, category accordion).
 * Uses the SAME CSS classes as app.js so styling is identical.
 */
(function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  const grid       = document.getElementById('product-grid');
  if (!grid) return;                              // exit if no target div

  const searchEl   = document.getElementById('catalog-search');
  const sortEl     = document.getElementById('catalog-sort');
  const minPriceEl = document.getElementById('catalog-min-price');
  const maxPriceEl = document.getElementById('catalog-max-price');
  const applyBtn   = document.getElementById('catalog-price-apply');
  const saleEl     = document.getElementById('catalog-sale-only');
  const pageTitle  = document.getElementById('shop-page-title');

  /* ── URL state ────────────────────────────────────────────────────────── */
  const params   = new URLSearchParams(location.search);
  let   activeCat = params.get('category')    || '';
  let   activeSub = params.get('subcategory') || '';

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  /** Escape a value for safe HTML attribute/text use */
  const esc  = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /** Format LKR price */
  const money = n => new Intl.NumberFormat('en-LK', {style:'currency', currency:'LKR', maximumFractionDigits:0}).format(n);

  /** Build image src — falls back to placeholder */
  const imgSrc = p => p.image ? '../images/products/' + encodeURIComponent(p.image) : '../images/placeholder.svg';

  /* ── Sidebar: page title ──────────────────────────────────────────────── */
  const TITLES = {
    men:'Men\'s Clothing', women:'Women\'s Clothing', kids:'Kids Collection',
    footwear:'Footwear Catalog', accessories:'Accessories', festive:'Festive Collection'
  };
  if (pageTitle && activeCat) pageTitle.textContent = TITLES[activeCat] || 'The Collection';

  /* ── Sidebar: highlight active category links ─────────────────────────── */
  document.querySelectorAll('#category-filter-list a').forEach(link => {
    const lCat = link.dataset.category || '';
    const lSub = link.dataset.subcategory || '';
    if (lSub) {
      if (lCat === activeCat && lSub === activeSub) {
        link.style.color      = 'var(--accent)';
        link.style.fontWeight = '700';
      }
    } else {
      const isAll = !lCat && !activeCat && !activeSub;
      const isCat = lCat === activeCat && !activeSub;
      if (isAll || isCat) link.classList.add('active');
      else                 link.classList.remove('active');
    }
  });

  /* ── Sidebar: accordion toggles ──────────────────────────────────────── */
  document.querySelectorAll('.category-group').forEach(group => {
    const headerLink = group.querySelector('.category-header a');
    const subList    = group.querySelector('.subcategories-list');
    const toggle     = group.querySelector('.toggle-sub');

    if (headerLink && subList && headerLink.dataset.category === activeCat) {
      subList.style.display = 'flex';
      if (toggle) toggle.textContent = '▲';
    }

    if (toggle && subList) {
      toggle.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const open = subList.style.display === 'flex';
        subList.style.display = open ? 'none' : 'flex';
        toggle.textContent    = open ? '▼' : '▲';
      });
    }
  });

  /* ── Product card HTML ────────────────────────────────────────────────── */
  function renderBadge(p) {
    if (p.stock <= 0)           return '<span class="product-card-tag" style="background:#a83c32;">Sold Out</span>';
    if (p.discount_percent > 0) return `<span class="product-card-tag" style="background:#a83c32;">Sale -${p.discount_percent}%</span>`;
    return '';
  }

  function renderPrice(p) {
    if (p.discount_percent > 0) {
      const final = Math.round(p.price * (1 - p.discount_percent / 100));
      return `<span class="product-card-price" style="color:var(--accent);">
                <span style="text-decoration:line-through;color:var(--text-light);font-size:.85rem;margin-right:6px;font-weight:500;">${money(p.price)}</span>
                ${money(final)}
              </span>`;
    }
    return `<span class="product-card-price">${money(p.price)}</span>`;
  }

  function renderStars(rating, count) {
    const r = Math.round(rating || 0);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += `<span style="color:${i<=r?'#dfba73':'var(--line)'};font-size:1rem;line-height:1;">★</span>`;
    }
    return `<div class="product-stars-row" style="display:flex;align-items:center;gap:4px;margin-top:4px;">
              <div style="display:flex;">${stars}</div>
              <span style="font-size:.8rem;color:var(--text-light);font-weight:500;margin-left:2px;">(${count||0})</span>
            </div>`;
  }

  function cardHTML(p) {
    const inStock = p.stock > 0;
    const cartBtn = inStock
      ? `onclick="typeof quickAddToCart==='function'?quickAddToCart(${p.id}):dbAddCart(${p.id})"`
      : `disabled style="opacity:.5;cursor:not-allowed;"`;
    return `
      <article class="product-card">
        <div class="product-card-img-wrapper" style="position:relative;">
          <a href="product.html?id=${p.id}" class="product-card-img">
            ${renderBadge(p)}
            <img src="${imgSrc(p)}" alt="${esc(p.name)}" loading="lazy">
          </a>
        </div>
        <div class="product-card-body">
          <div class="product-card-category">${esc(p.category_label || p.category_name || '')}</div>
          <h3><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
          ${renderStars(p.average_rating, p.review_count)}
          <div class="product-card-footer">
            ${renderPrice(p)}
            <button class="product-card-btn" ${cartBtn}>Add To Cart</button>
          </div>
        </div>
      </article>`;
  }

  /* ── Product detail view (shop.html?id=X) ─────────────────────────────── */
  function detailHTML(p) {
    const inStock = p.stock > 0;
    return `
      <div class="product-detail-wrapper" style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;">
        <div style="position:relative;">
          ${renderBadge(p)}
          <img src="${imgSrc(p)}" alt="${esc(p.name)}" style="width:100%;border-radius:var(--radius-md);">
        </div>
        <div>
          <p style="font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-light);margin-bottom:8px;">
            ${esc(p.category_label||'')} ${p.subcategory_name ? '› '+esc(p.subcategory_name) : ''}
          </p>
          <h1 style="font-family:var(--font-serif,'Playfair Display',serif);font-size:2rem;margin-bottom:12px;">${esc(p.name)}</h1>
          ${renderStars(p.average_rating, p.review_count)}
          <div style="font-size:1.5rem;color:var(--accent);font-weight:700;margin:16px 0;">${renderPrice(p)}</div>
          <p style="line-height:1.7;color:var(--text-muted);margin-bottom:20px;">${esc(p.description)}</p>
          <p style="margin-bottom:20px;font-size:.9rem;">${inStock ? '✓ In stock ('+p.stock+' available)' : '✗ Out of stock'}</p>
          ${inStock ? `<button class="btn btn-primary" style="width:100%;height:48px;font-size:.95rem;text-transform:uppercase;"
              onclick="typeof quickAddToCart==='function'?quickAddToCart(${p.id}):dbAddCart(${p.id})">Add To Shopping Bag</button>` 
            : `<button class="btn btn-primary" disabled style="opacity:.5;cursor:not-allowed;width:100%;height:48px;">Out Of Stock</button>`}
          <p style="margin-top:16px;"><a href="shop.html" style="color:var(--accent);">← Back to shop</a></p>
        </div>
      </div>`;
  }

  /* ── Fallback cart (guest localStorage) if app.js not loaded ─────────── */
  window.dbAddCart = function(id) {
    try {
      let c = JSON.parse(localStorage.getItem('urbanThreadsGuestCart') || '[]');
      const idx = c.findIndex(i => i.id === id && i.size === 'M');
      if (idx > -1) { c[idx].quantity++; } else { c.push({id, size:'M', color:'Default', quantity:1}); }
      localStorage.setItem('urbanThreadsGuestCart', JSON.stringify(c));
      alert('Added to cart (guest session).');
    } catch(e) { alert('Could not add to cart.'); }
  };

  /* ── Main fetch and render ────────────────────────────────────────────── */
  async function loadProducts() {
    grid.innerHTML = '<div class="empty-state">Loading products…</div>';

    try {
      // Single product detail
      if (params.has('id')) {
        const r = await fetch('../api/products.php?id=' + encodeURIComponent(params.get('id')));
        if (!r.ok) throw new Error('not found');
        const p = await r.json();
        if (p.error) throw new Error(p.error);
        grid.innerHTML = detailHTML(p);
        return;
      }

      // Product listing
      const q = new URLSearchParams();
      if (activeCat)                   q.set('category',    activeCat);
      if (activeSub)                   q.set('subcategory', activeSub);
      if (searchEl?.value)             q.set('search',      searchEl.value);
      if (sortEl?.value)               q.set('sort',        sortEl.value);
      if (minPriceEl?.value)           q.set('minPrice',    minPriceEl.value);
      if (maxPriceEl?.value)           q.set('maxPrice',    maxPriceEl.value);

      const r    = await fetch('../api/products.php?' + q);
      const list = await r.json();

      if (!Array.isArray(list) || list.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No products found</h3><p>Try adjusting your filters.</p></div>';
        return;
      }

      grid.innerHTML = '<div class="products-grid" style="display:contents;">' +
        list.map(cardHTML).join('') + '</div>';

    } catch (err) {
      grid.innerHTML = '<div class="empty-state">Could not load products. Is WAMP running? ' + esc(err.message) + '</div>';
    }
  }

  /* ── Event listeners (debounced) ─────────────────────────────────────── */
  let debTimer;
  const debounce = fn => { clearTimeout(debTimer); debTimer = setTimeout(fn, 280); };

  searchEl?.addEventListener('input',  () => debounce(loadProducts));
  sortEl?.addEventListener('change',   loadProducts);
  applyBtn?.addEventListener('click',  loadProducts);
  saleEl?.addEventListener('change',   loadProducts);   // note: sale filter not in API yet – reserved
  minPriceEl?.addEventListener('keydown', e => e.key === 'Enter' && loadProducts());
  maxPriceEl?.addEventListener('keydown', e => e.key === 'Enter' && loadProducts());

  /* ── Initial load ─────────────────────────────────────────────────────── */
  loadProducts();
})();
