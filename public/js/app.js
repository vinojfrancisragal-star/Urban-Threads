const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

function renderStars(rating, count) {
  const rounded = Math.round(rating || 0);
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<span style="color: ${i <= rounded ? '#dfba73' : 'var(--line)'}; font-size: 1rem; line-height: 1;">★</span>`;
  }
  return `
    <div class="product-stars-row" style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
      <div style="display: flex;">${stars}</div>
      <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500; margin-left: 2px;">(${count || 0})</span>
    </div>
  `;
}

function renderCardPrice(product) {
  if (product.discount_percent > 0) {
    const finalPrice = Math.round(product.price * (1 - product.discount_percent / 100));
    return `
      <span class="product-card-price" style="color: var(--accent);">
        <span style="text-decoration: line-through; color: var(--text-light); font-size: 0.85rem; margin-right: 6px; font-weight: 500;">
          ${currency.format(product.price)}
        </span>
        ${currency.format(finalPrice)}
      </span>
    `;
  }
  return `<span class="product-card-price">${currency.format(product.price)}</span>`;
}

function renderCardBadge(product) {
  if (product.stock <= 0) {
    return '<span class="product-card-tag" style="background:#a83c32;">Sold Out</span>';
  }
  if (product.discount_percent > 0) {
    return `<span class="product-card-tag" style="background:#a83c32;">Sale -${product.discount_percent}%</span>`;
  }
  return '';
}

// Run initialization based on current HTML file path
document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname.split("/").pop() || "index.html";

  if (page.includes("index.html") || page === "") {
    initHome();
  } else if (page.includes("shop.html")) {
    initShop();
  } else if (page.includes("product.html")) {
    initProductDetails();
  } else if (page.includes("cart.html")) {
    initCart();
  } else if (page.includes("checkout.html")) {
    initCheckout();
  } else if (page.includes("login.html")) {
    initLogin();
  } else if (page.includes("register.html")) {
    initRegister();
  } else if (page.includes("profile.html")) {
    initProfile();
  } else if (page.includes("reviews.html")) {
    initReviews();
  } else if (page.includes("admin.html")) {
    initAdmin();
  } else if (page.includes("track-order.html")) {
    initOrderTracking();
  }
});

// Helper to check user auth details
async function getAuthSession() {
  try {
    const res = await fetch("/api/auth/me");
    return await res.json();
  } catch (e) {
    return { loggedIn: false };
  }
}

// ----------------------------------------------------
// 1. HOMEPAGE DYNAMICS
// ----------------------------------------------------
async function initHome() {
  const container = document.getElementById("featured-products-target");
  if (!container) return;

  try {
    const res = await fetch("/api/products");
    const products = await res.json();
    // Grab 4 items for featured row (e.g. indices 0, 17, 33, 49 if they exist)
    const featured = [products[0], products[17], products[33], products[49]].filter(Boolean);

    // Fetch wishlist to display heart states
    const auth = await getAuthSession();
    let favoritedIds = [];
    if (auth.loggedIn) {
      try {
        const wishRes = await fetch("/api/wishlist");
        const wishItems = await wishRes.json();
        favoritedIds = wishItems.map(item => item.id);
      } catch (e) {
        console.error(e);
      }
    } else {
      favoritedIds = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    }

    container.innerHTML = featured.map(product => {
      const isFav = favoritedIds.includes(product.id);
      return `
        <article class="product-card">
          <div class="product-card-img-wrapper" style="position: relative;">
            <a href="product.html?id=${product.id}" class="product-card-img">
              ${renderCardBadge(product)}
              <img src="${product.image}" alt="${product.name}" loading="lazy">
            </a>
            <button class="wishlist-card-btn ${isFav ? 'active' : ''}" onclick="toggleWishlistItem(event, ${product.id})" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.9); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease; z-index: 10;">
              <svg class="heart-icon" viewBox="0 0 24 24" width="18" height="18" fill="${isFav ? '#a83c32' : 'none'}" stroke="${isFav ? '#a83c32' : 'var(--text-dark)'}" stroke-width="2" style="transition: fill 0.3s ease, stroke 0.3s ease;">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <div class="product-card-body">
            <div class="product-card-category">${product.category_label}</div>
            <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
            ${renderStars(product.average_rating, product.review_count)}
            <div class="product-card-footer">
              ${renderCardPrice(product)}
              <button class="product-card-btn" onclick="quickAddToCart(${product.id})">Add To Cart</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Could not load featured products.</div>`;
  }
}

// ----------------------------------------------------
// 2. SHOP CATALOG DYNAMICS
// ----------------------------------------------------
async function initShop() {
  const container = document.getElementById("catalog-products-target");
  const searchInput = document.getElementById("catalog-search");
  const sortSelect = document.getElementById("catalog-sort");
  const minPriceInput = document.getElementById("catalog-min-price");
  const maxPriceInput = document.getElementById("catalog-max-price");
  const applyPriceBtn = document.getElementById("catalog-price-apply");
  const categoryFilters = document.querySelectorAll("#category-filter-list a");
  const pageTitle = document.getElementById("shop-page-title");

  if (!container) return;

  // Read URL parameters
  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get("category") || "";
  let activeSubcategory = params.get("subcategory") || "";

  // Highlight active category and subcategory filter links
  categoryFilters.forEach(link => {
    const cat = link.getAttribute("data-category");
    const sub = link.getAttribute("data-subcategory");

    if (sub) {
      if (cat === activeCategory && sub === activeSubcategory) {
        link.style.color = "var(--accent)";
        link.style.fontWeight = "700";
      } else {
        link.style.color = "";
        link.style.fontWeight = "";
      }
    } else {
      if (cat === activeCategory && !activeSubcategory) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    }
  });

  // Setup accordion folder toggle events
  document.querySelectorAll(".category-group").forEach(group => {
    const headerLink = group.querySelector(".category-header a");
    const subList = group.querySelector(".subcategories-list");
    const toggle = group.querySelector(".toggle-sub");

    if (headerLink && subList) {
      const cat = headerLink.getAttribute("data-category");
      if (cat === activeCategory) {
        subList.style.display = "flex";
        if (toggle) toggle.textContent = "▲";
      }
    }

    if (toggle && subList) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (subList.style.display === "flex") {
          subList.style.display = "none";
          toggle.textContent = "▼";
        } else {
          subList.style.display = "flex";
          toggle.textContent = "▲";
        }
      });
    }
  });

  // Set title dynamically based on category
  const categoryTitles = { men: "Men's Clothing", women: "Women's Clothing", kids: "Kids Collection", accessories: "Accessories", footwear: "Footwear Catalog", festive: "Festive Collection" };
  if (activeCategory) {
    pageTitle.textContent = categoryTitles[activeCategory] || "The Collection";
  }

  // Load and render product catalog
  async function loadCatalog() {
    container.innerHTML = `<div class="empty-state">Loading products...</div>`;
    const searchVal = searchInput?.value || "";
    const sortVal = sortSelect?.value || "";
    const minVal = minPriceInput?.value || "";
    const maxVal = maxPriceInput?.value || "";

    const saleOnlyCheck = document.getElementById("catalog-sale-only");
    const saleVal = saleOnlyCheck?.checked ? "true" : "false";

    const url = `/api/products?category=${activeCategory}&subcategory=${activeSubcategory}&search=${encodeURIComponent(searchVal)}&sort=${sortVal}&minPrice=${minVal}&maxPrice=${maxVal}&sale=${saleVal}`;

    try {
      const res = await fetch(url);
      const products = await res.json();

      if (products.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No products found</h3><p>Try modifying your search or filter options.</p></div>`;
        return;
      }

      // Fetch wishlist to display heart states
      const auth = await getAuthSession();
      let favoritedIds = [];
      if (auth.loggedIn) {
        try {
          const wishRes = await fetch("/api/wishlist");
          const wishItems = await wishRes.json();
          favoritedIds = wishItems.map(item => item.id);
        } catch (e) {
          console.error(e);
        }
      } else {
        favoritedIds = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
      }

      container.innerHTML = products.map(product => {
        const isFav = favoritedIds.includes(product.id);
        return `
          <article class="product-card">
            <div class="product-card-img-wrapper" style="position: relative;">
              <a href="product.html?id=${product.id}" class="product-card-img">
                ${renderCardBadge(product)}
                <img src="${product.image}" alt="${product.name}" loading="lazy">
              </a>
              <button class="wishlist-card-btn ${isFav ? 'active' : ''}" onclick="toggleWishlistItem(event, ${product.id})" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.9); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease; z-index: 10;">
                <svg class="heart-icon" viewBox="0 0 24 24" width="18" height="18" fill="${isFav ? '#a83c32' : 'none'}" stroke="${isFav ? '#a83c32' : 'var(--text-dark)'}" stroke-width="2" style="transition: fill 0.3s ease, stroke 0.3s ease;">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>
            <div class="product-card-body">
              <div class="product-card-category">${product.category_label}</div>
              <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
              ${renderStars(product.average_rating, product.review_count)}
              <div class="product-card-footer">
                ${renderCardPrice(product)}
                <button class="product-card-btn" ${product.stock <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="quickAddToCart(${product.id})">Add To Cart</button>
              </div>
            </div>
          </article>
        `;
      }).join("");
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Error loading products.</div>`;
    }
  }

  // Setup live event listeners
  searchInput?.addEventListener("input", debounce(loadCatalog, 300));
  sortSelect?.addEventListener("change", loadCatalog);
  applyPriceBtn?.addEventListener("click", loadCatalog);
  minPriceInput?.addEventListener("keypress", (e) => { if (e.key === "Enter") loadCatalog(); });
  maxPriceInput?.addEventListener("keypress", (e) => { if (e.key === "Enter") loadCatalog(); });
  document.getElementById("catalog-sale-only")?.addEventListener("change", loadCatalog);

  // Load catalog on start
  loadCatalog();
}

// ----------------------------------------------------
// 3. PRODUCT DETAILS DYNAMICS
// ----------------------------------------------------
let currentProduct = null;
async function initProductDetails() {
  const container = document.getElementById("product-detail-target");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    container.innerHTML = `<div class="empty-state">No product ID specified.</div>`;
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`);
    const product = await res.json();
    currentProduct = product;

    if (product.error) {
      container.innerHTML = `<div class="empty-state">Product not found.</div>`;
      return;
    }

    // 1. Log to Recently Viewed stack
    let recentlyViewed = JSON.parse(localStorage.getItem("urbanThreadsRecentlyViewed") || "[]");
    recentlyViewed = recentlyViewed.filter(rvId => Number(rvId) !== Number(id));
    recentlyViewed.unshift(Number(id));
    recentlyViewed = recentlyViewed.slice(0, 4); // max 4 items
    localStorage.setItem("urbanThreadsRecentlyViewed", JSON.stringify(recentlyViewed));

    // 2. Fetch active favorite status
    const auth = await getAuthSession();
    let favoritedIds = [];
    if (auth.loggedIn) {
      try {
        const wishRes = await fetch("/api/wishlist");
        const wishItems = await wishRes.json();
        favoritedIds = wishItems.map(item => item.id);
      } catch (e) {
        console.error(e);
      }
    } else {
      favoritedIds = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    }
    const isFav = favoritedIds.includes(product.id);

    // 3. Setup multi-angle gallery previews
    const categoryAltImages = {
      men: [
        product.image,
        "https://images.unsplash.com/photo-1490367532201-b9bc1dc483f6?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=500&q=80"
      ],
      women: [
        product.image,
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=500&q=80"
      ],
      kids: [
        product.image,
        "https://images.unsplash.com/photo-1519457431-44ccd64a579b?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?auto=format&fit=crop&w=500&q=80"
      ],
      accessories: [
        product.image,
        "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=500&q=80"
      ]
    };
    const gallery = categoryAltImages[product.category] || [product.image, product.image, product.image];

    const stockHTML = product.stock > 0 
      ? `<span class="stock-status in-stock">● In Stock (${product.stock} items remaining)</span>`
      : `<span class="stock-status out-of-stock">● Sold Out</span>`;

    // 4. Fetch related recommendations
    let relatedHTML = "";
    try {
      const relatedRes = await fetch(`/api/products?category=${product.category}`);
      const allRelated = await relatedRes.json();
      const relatedProducts = allRelated.filter(p => p.id !== product.id).slice(0, 4);

      if (relatedProducts.length > 0) {
        relatedHTML = `
          <div class="related-products-section" style="margin-top: 60px; border-top: 1px solid var(--line); padding-top: 40px; width: 100%;">
            <h2 style="font-family: var(--font-serif); font-size: 1.8rem; font-weight: 500; margin-bottom: 25px; color: var(--text-dark); text-align: center;">You May Also Like</h2>
            <div class="products-grid">
              ${relatedProducts.map(p => {
                const isItemFav = favoritedIds.includes(p.id);
                return `
                  <article class="product-card">
                    <div class="product-card-img-wrapper" style="position: relative;">
                      <a href="product.html?id=${p.id}" class="product-card-img">
                        ${renderCardBadge(p)}
                        <img src="${p.image}" alt="${p.name}" loading="lazy">
                      </a>
                      <button class="wishlist-card-btn ${isItemFav ? 'active' : ''}" onclick="toggleWishlistItem(event, ${p.id})" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.9); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease; z-index: 10;">
                        <svg class="heart-icon" viewBox="0 0 24 24" width="18" height="18" fill="${isItemFav ? '#a83c32' : 'none'}" stroke="${isItemFav ? '#a83c32' : 'var(--text-dark)'}" stroke-width="2" style="transition: fill 0.3s ease, stroke 0.3s ease;">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                      </button>
                    </div>
                    <div class="product-card-body">
                      <div class="product-card-category">${p.category_label}</div>
                      <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
                      ${renderStars(p.average_rating, p.review_count)}
                      <div class="product-card-footer">
                        ${renderCardPrice(p)}
                        <button class="product-card-btn" onclick="quickAddToCart(${p.id})">Add To Cart</button>
                      </div>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error("Error loading related recommendations:", e);
    }

    // 5. Fetch recently viewed details
    let recentlyViewedHTML = "";
    try {
      const rvIds = JSON.parse(localStorage.getItem("urbanThreadsRecentlyViewed") || "[]").filter(rvId => Number(rvId) !== Number(id));
      if (rvIds.length > 0) {
        const rvProducts = [];
        for (const rvId of rvIds) {
          const rvRes = await fetch(`/api/products/${rvId}`);
          const rvProduct = await rvRes.json();
          if (!rvProduct.error) {
            rvProducts.push(rvProduct);
          }
        }

        if (rvProducts.length > 0) {
          recentlyViewedHTML = `
            <div class="recently-viewed-section" style="margin-top: 60px; border-top: 1px solid var(--line); padding-top: 40px; width: 100%;">
              <h2 style="font-family: var(--font-serif); font-size: 1.8rem; font-weight: 500; margin-bottom: 25px; color: var(--text-dark); text-align: center;">Recently Viewed</h2>
              <div class="products-grid">
                ${rvProducts.map(p => {
                  const isItemFav = favoritedIds.includes(p.id);
                  return `
                    <article class="product-card">
                      <div class="product-card-img-wrapper" style="position: relative;">
                        <a href="product.html?id=${p.id}" class="product-card-img">
                          ${renderCardBadge(p)}
                          <img src="${p.image}" alt="${p.name}" loading="lazy">
                        </a>
                        <button class="wishlist-card-btn ${isItemFav ? 'active' : ''}" onclick="toggleWishlistItem(event, ${p.id})" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.9); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease; z-index: 10;">
                          <svg class="heart-icon" viewBox="0 0 24 24" width="18" height="18" fill="${isItemFav ? '#a83c32' : 'none'}" stroke="${isItemFav ? '#a83c32' : 'var(--text-dark)'}" stroke-width="2" style="transition: fill 0.3s ease, stroke 0.3s ease;">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                        </button>
                      </div>
                      <div class="product-card-body">
                        <div class="product-card-category">${p.category_label}</div>
                        <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
                        ${renderStars(p.average_rating, p.review_count)}
                        <div class="product-card-footer">
                          ${renderCardPrice(p)}
                          <button class="product-card-btn" onclick="quickAddToCart(${p.id})">Add To Cart</button>
                        </div>
                      </div>
                    </article>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error("Error loading recently viewed history:", e);
    }

    container.innerHTML = `
      <div class="product-detail-layout" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 60px; margin-bottom: 40px;">
        <div class="product-gallery">
          <div class="gallery-main-wrapper" style="border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface);">
            <img src="${product.image}" alt="${product.name}" id="main-product-img" style="width: 100%; display: block; height: auto; transition: all 0.3s ease;">
          </div>
          <div class="gallery-thumbnails" style="display: flex; gap: 10px; margin-top: 15px;">
            ${gallery.map((imgUrl, index) => `
              <div class="thumb-wrapper ${index === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${imgUrl}')" style="flex: 1; aspect-ratio: 1; border: 1px solid ${index === 0 ? 'var(--accent)' : 'var(--line)'}; border-radius: var(--radius-md); overflow: hidden; cursor: pointer; background: var(--surface); transition: all 0.2s ease;">
                <img src="${imgUrl}" alt="Preview angle ${index + 1}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
              </div>
            `).join("")}
          </div>
        </div>
        <div class="product-info-panel">
          <span class="eyebrow">${product.category_label}</span>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 5px; margin-bottom: 8px;">
            <h1 style="margin: 0; font-size: 2.2rem; font-family: var(--font-serif); font-weight: 500;">${product.name}</h1>
            <button class="wishlist-detail-btn ${isFav ? 'active' : ''}" onclick="toggleWishlistDetail(this, ${product.id})" style="background: none; border: 1px solid var(--line); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="${isFav ? '#a83c32' : 'none'}" stroke="${isFav ? '#a83c32' : 'var(--text-dark)'}" stroke-width="2" style="transition: fill 0.3s ease, stroke 0.3s ease;">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <div class="price" style="font-size: 1.6rem; color: var(--accent); font-weight: 700; margin-bottom: 6px;">
            ${product.discount_percent > 0 
              ? `<span style="text-decoration: line-through; color: var(--text-light); font-size: 1.1rem; margin-right: 10px; font-weight: 500;">${currency.format(product.price)}</span>
                 ${currency.format(Math.round(product.price * (1 - product.discount_percent / 100)))}
                 <span style="background: #a83c32; color: #fff; font-size: 0.75rem; padding: 3px 8px; border-radius: var(--radius-sm); margin-left: 10px; vertical-align: middle; font-weight: 700; display: inline-block;">-${product.discount_percent}% OFF</span>`
              : currency.format(product.price)
            }
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            ${renderStars(product.average_rating, product.review_count)}
            <a href="#reviews-anchor" style="font-size: 0.85rem; color: var(--accent); font-weight: 600; text-decoration: underline;">See reviews</a>
          </div>
          <div style="margin-bottom: 15px;">${stockHTML}</div>
          
          <p class="product-description" style="line-height: 1.7; color: var(--text-muted); margin-bottom: 25px;">${product.description}</p>

          ${product.stock > 0 ? `
            <div class="product-options" style="display: flex; flex-direction: column; gap: 18px; margin-bottom: 25px; border-top: 1px solid var(--line); padding-top: 20px;">
              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 10px;">Select Size</label>
                <div class="size-swatches" style="display: flex; gap: 10px;">
                  ${['S', 'M', 'L', 'XL'].map(sz => `
                    <button type="button" class="swatch size-swatch ${sz === 'M' ? 'active' : ''}" onclick="selectSizeSwatch(this, '${sz}')" style="min-width: 44px; height: 44px; border: 1px solid ${sz === 'M' ? 'var(--accent)' : 'var(--line)'}; background: ${sz === 'M' ? 'var(--accent-light)' : 'var(--surface)'}; color: ${sz === 'M' ? 'var(--accent)' : 'var(--text-dark)'}; font-weight: 600; font-family: inherit; cursor: pointer; border-radius: var(--radius-sm); transition: all 0.2s ease;">${sz}</button>
                  `).join("")}
                </div>
                <input type="hidden" id="detail-size" value="M">
              </div>

              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 10px;">Select Color</label>
                <div class="color-swatches" style="display: flex; gap: 12px; align-items: center;">
                  ${[
                    { name: 'Obsidian Black', hex: '#1a1a1a' },
                    { name: 'Charcoal', hex: '#4a4a4a' },
                    { name: 'Off-White', hex: '#f7f5f0' },
                    { name: 'Champagne Gold', hex: '#dfba73' }
                  ].map(col => `
                    <button type="button" class="swatch color-swatch ${col.name === 'Off-White' ? 'active' : ''}" onclick="selectColorSwatch(this, '${col.name}')" title="${col.name}" style="width: 34px; height: 34px; border-radius: 50%; border: 2px solid ${col.name === 'Off-White' ? 'var(--accent)' : 'transparent'}; background-color: ${col.hex}; cursor: pointer; box-shadow: 0 0 0 1px var(--line); transform: scale(${col.name === 'Off-White' ? '1.15' : '1'}); transition: all 0.2s ease;"></button>
                  `).join("")}
                </div>
                <input type="hidden" id="detail-color" value="Off-White">
              </div>
            </div>
          ` : ''}

          <div class="purchase-actions" style="display: flex; gap: 15px; align-items: center; border-top: 1px solid var(--line); padding-top: 25px;">
            ${product.stock > 0 ? `
              <div class="quantity-picker" style="height: 48px;">
                <button onclick="adjustDetailQty(-1)">-</button>
                <input type="number" id="detail-qty" value="1" min="1" max="${product.stock}" readonly style="height: 46px; font-size: 1.1rem; width: 44px;">
                <button onclick="adjustDetailQty(1)">+</button>
              </div>
              <button class="btn btn-primary" onclick="addDetailToCart(${product.id})" style="flex: 1; height: 48px; font-size: 0.95rem; letter-spacing: 0.05em; text-transform: uppercase;">Add To Shopping Bag</button>
            ` : `
              <button class="btn btn-primary" disabled style="opacity:0.5; cursor:not-allowed; width: 100%; height: 48px; text-transform: uppercase;">Out Of Stock</button>
            `}
          </div>
          <div id="detail-notice-target" style="margin-top: 15px;"></div>
        </div>
      </div>

      <!-- Reviews & Ratings Section -->
      <div id="reviews-anchor" class="product-reviews-section" style="margin-top: 60px; border-top: 1px solid var(--line); padding-top: 40px; width: 100%;">
        <div style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 50px;">
          <!-- Review Stats & Summary -->
          <div class="reviews-summary-col">
            <h2 style="font-family: var(--font-serif); font-size: 1.8rem; font-weight: 500; margin-bottom: 15px; color: var(--text-dark);">Customer Reviews</h2>
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
              <span style="font-size: 3rem; font-weight: 700; color: var(--text-dark); line-height: 1;">${Number(product.average_rating).toFixed(1)}</span>
              <div>
                <div style="display: flex; font-size: 1.2rem; color: #dfba73;">
                  ${Array.from({ length: 5 }, (_, i) => `<span style="color: ${i < Math.round(product.average_rating) ? '#dfba73' : 'var(--line)'};">★</span>`).join("")}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 2px;">Based on ${product.review_count} reviews</div>
              </div>
            </div>

            <!-- Review Eligibility / Write Review Section -->
            <div id="review-write-box-target" style="margin-top: 30px; padding: 20px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface);">
              <div class="empty-state" style="padding: 10px; border: 0;">Checking eligibility to write a review...</div>
            </div>
          </div>

          <!-- Reviews Feed List -->
          <div class="reviews-list-col">
            <h3 style="font-size: 1.2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dark); margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 10px;">Reviews Feed</h3>
            <div id="reviews-feed-target">
              <div class="empty-state" style="padding: 20px; border: 0;">Loading reviews...</div>
            </div>
          </div>
        </div>
      </div>

      ${relatedHTML}
      ${recentlyViewedHTML}
    `;

    // Load reviews feed list and write review eligibility box
    loadProductReviews(product.id);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Error loading product details.</div>`;
  }
}

function adjustDetailQty(delta) {
  const input = document.getElementById("detail-qty");
  if (!input || !currentProduct) return;
  const currentVal = parseInt(input.value) || 1;
  const newVal = currentVal + delta;
  if (newVal >= 1 && newVal <= currentProduct.stock) {
    input.value = newVal;
  }
}

async function addDetailToCart(productId) {
  const input = document.getElementById("detail-qty");
  const noticeTarget = document.getElementById("detail-notice-target");
  const qty = parseInt(input?.value) || 1;

  const sizeEl = document.getElementById("detail-size");
  const colorEl = document.getElementById("detail-color");
  const size = sizeEl ? sizeEl.value : "M";
  const color = colorEl ? colorEl.value : "Off-White";

  if (currentProduct && qty > currentProduct.stock) {
    showStatusNotice(noticeTarget, "Not enough items in stock", "error");
    return;
  }

  const auth = await getAuthSession();
  if (auth.loggedIn) {
    // Add to DB cart
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size, color, quantity: qty })
      });
      const result = await res.json();
      if (result.success) {
        showStatusNotice(noticeTarget, "Added successfully to your cart", "success");
        updateGlobalCartCount();
      } else {
        showStatusNotice(noticeTarget, result.error || "Could not add to cart", "error");
      }
    } catch (e) {
      showStatusNotice(noticeTarget, "Failed to connect to server", "error");
    }
  } else {
    // Guest cart in localStorage
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    const existingIndex = guestCart.findIndex(item => item.id === productId && item.size === size && item.color === color);
    if (existingIndex > -1) {
      guestCart[existingIndex].quantity += qty;
    } else {
      guestCart.push({ id: productId, size, color, quantity: qty });
    }
    localStorage.setItem("urbanThreadsGuestCart", JSON.stringify(guestCart));
    showStatusNotice(noticeTarget, "Added successfully to cart (Guest Session)", "success");
    updateGlobalCartCount();
  }
}

// ----------------------------------------------------
// 4. SHOPPING CART PAGE
// ----------------------------------------------------
async function initCart() {
  const container = document.getElementById("cart-items-target");
  const summaryContainer = document.getElementById("cart-summary-target");
  if (!container || !summaryContainer) return;

  const auth = await getAuthSession();
  let cartItems = [];

  if (auth.loggedIn) {
    // Fetch cart from database
    try {
      const res = await fetch("/api/cart");
      cartItems = await res.json();
    } catch (e) {
      console.error(e);
    }
  } else {
    // Load guest cart from LocalStorage, fetching info from db
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    
    for (const item of guestCart) {
      try {
        const res = await fetch(`/api/products/${item.id}`);
        const product = await res.json();
        if (!product.error) {
          cartItems.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            category_label: product.category_label,
            size: item.size,
            color: item.color,
            quantity: item.quantity
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Render items
  if (cartItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="border:0; padding:40px 0;">
        <h3>Your shopping bag is empty</h3>
        <p style="margin-bottom:20px;">Choose a collection and add some timeless pieces.</p>
        <a href="shop.html" class="btn btn-primary">Browse Shop</a>
      </div>
    `;
    updateCartSummary(0);
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <article class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-details">
        <h3><a href="product.html?id=${item.id}">${item.name}</a></h3>
        <p>${item.category_label} · Size: <strong>${item.size}</strong> · Color: <strong>${item.color}</strong></p>
      </div>
      <div class="quantity-picker" style="height:36px;">
        <button onclick="updateCartItemQty(${item.id}, '${item.size}', '${item.color}', -1)">-</button>
        <input type="text" value="${item.quantity}" readonly style="height:34px; width:36px;">
        <button onclick="updateCartItemQty(${item.id}, '${item.size}', '${item.color}', 1)">+</button>
      </div>
      <div class="cart-item-price">${currency.format(item.price * item.quantity)}</div>
      <button class="cart-item-remove" onclick="removeCartItem(${item.id}, '${item.size}', '${item.color}')">Remove</button>
    </article>
  `).join("");

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  updateCartSummary(subtotal);
}

function updateCartSummary(subtotal) {
  const summaryContainer = document.getElementById("cart-summary-target");
  if (!summaryContainer) return;

  const delivery = subtotal > 0 ? 550 : 0;
  const total = subtotal + delivery;

  summaryContainer.innerHTML = `
    <div class="summary-row"><span>Subtotal</span><strong>${currency.format(subtotal)}</strong></div>
    <div class="summary-row"><span>Delivery Fee</span><strong>${currency.format(delivery)}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>${currency.format(total)}</strong></div>
    ${subtotal > 0 ? `<a href="checkout.html" class="btn btn-primary" style="width: 100%; text-align: center; display: block;">Proceed to Checkout</a>` : `
      <button class="btn btn-primary" disabled style="width: 100%; opacity:0.5; cursor:not-allowed;">Bag Empty</button>
    `}
  `;
}

async function updateCartItemQty(productId, size, color, delta) {
  const auth = await getAuthSession();
  
  if (auth.loggedIn) {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size, color, quantity: delta })
    });
  } else {
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    const idx = guestCart.findIndex(item => item.id === productId && item.size === size && item.color === color);
    if (idx > -1) {
      guestCart[idx].quantity += delta;
      if (guestCart[idx].quantity <= 0) {
        guestCart.splice(idx, 1);
      }
      localStorage.setItem("urbanThreadsGuestCart", JSON.stringify(guestCart));
    }
  }
  
  initCart();
  updateGlobalCartCount();
}

async function removeCartItem(productId, size, color) {
  const auth = await getAuthSession();

  if (auth.loggedIn) {
    await fetch(`/api/cart/${productId}?size=${encodeURIComponent(size)}&color=${encodeURIComponent(color)}`, { method: "DELETE" });
  } else {
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    guestCart = guestCart.filter(item => !(item.id === productId && item.size === size && item.color === color));
    localStorage.setItem("urbanThreadsGuestCart", JSON.stringify(guestCart));
  }

  initCart();
  updateGlobalCartCount();
}

// ----------------------------------------------------
// 5. CHECKOUT PAGE
// ----------------------------------------------------
async function initCheckout() {
  const previewContainer = document.getElementById("checkout-preview-target");
  const form = document.getElementById("checkout-form");
  const noticeTarget = document.getElementById("checkout-notice-target");

  if (!previewContainer || !form) return;

  const auth = await getAuthSession();
  
  // Fill user profile details if logged in
  if (auth.loggedIn) {
    document.getElementById("checkout-name").value = auth.user.name;
    document.getElementById("checkout-email").value = auth.user.email;
  }

  let cartItems = [];

  // Load cart items for preview
  if (auth.loggedIn) {
    const res = await fetch("/api/cart");
    cartItems = await res.json();
  } else {
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    for (const item of guestCart) {
      const res = await fetch(`/api/products/${item.id}`);
      const product = await res.json();
      if (!product.error) {
        cartItems.push({
          id: product.id,
          name: product.name,
          price: product.price,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          image: product.image
        });
      }
    }
  }

  if (cartItems.length === 0) {
    previewContainer.innerHTML = `<div class="empty-state">No items to place.</div>`;
    return;
  }

  // Render preview list
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = subtotal > 0 ? 550 : 0;

  let activePromoCode = "";
  let activeDiscountPercent = 0;

  function renderCheckoutTotals() {
    const discountAmount = Math.round(subtotal * (activeDiscountPercent / 100));
    const total = subtotal - discountAmount + delivery;

    let discountHTML = "";
    if (discountAmount > 0) {
      discountHTML = `
        <div class="summary-row" style="color: #1e7a43; font-weight: 600;">
          <span>Discount (${activePromoCode} - ${activeDiscountPercent}%)</span>
          <strong>- ${currency.format(discountAmount)}</strong>
        </div>
      `;
    }

    previewContainer.innerHTML = `
      <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 15px;">
        ${cartItems.map(item => `
          <div class="summary-row" style="font-size:0.9rem;">
            <span>${item.name} (${item.size} / ${item.color}) x${item.quantity}</span>
            <span>${currency.format(item.price * item.quantity)}</span>
          </div>
        `).join("")}
      </div>
      <div class="summary-row"><span>Subtotal</span><strong>${currency.format(subtotal)}</strong></div>
      ${discountHTML}
      <div class="summary-row"><span>Delivery</span><strong>${currency.format(delivery)}</strong></div>
      <div class="summary-row total"><span>Total</span><strong>${currency.format(total)}</strong></div>
    `;
  }

  window.applyCheckoutCoupon = async () => {
    const input = document.getElementById("coupon-input");
    const notice = document.getElementById("coupon-notice-target");
    if (!input || !notice) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
      notice.textContent = "Please enter a promo code.";
      notice.style.color = "var(--accent)";
      return;
    }

    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (data.success) {
        activePromoCode = code;
        activeDiscountPercent = data.value;
        notice.textContent = `Promo code "${code}" applied! (${data.value}% discount)`;
        notice.style.color = "#1e7a43";
      } else {
        activePromoCode = "";
        activeDiscountPercent = 0;
        notice.textContent = data.error || "Invalid promo code.";
        notice.style.color = "var(--accent)";
      }
      renderCheckoutTotals();
    } catch (e) {
      notice.textContent = "Error validating promo code.";
      notice.style.color = "var(--accent)";
    }
  };

  // Initial render
  renderCheckoutTotals();

  // Submit Order handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("checkout-name").value;
    const email = document.getElementById("checkout-email").value;
    const phone = document.getElementById("checkout-phone").value;
    const address = document.getElementById("checkout-address").value;
    const paymentMethod = document.getElementById("checkout-payment").value;

    // Check payment method. If credit card, redirect to Stripe
    if (paymentMethod === "Credit / Debit Card") {
      try {
        const res = await fetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            address,
            phone,
            items: cartItems,
            promoCode: activePromoCode
          })
        });
        const result = await res.json();

        if (result.success && result.url) {
          // Redirect to Stripe Checkout page
          window.location.href = result.url;
        } else {
          showStatusNotice(noticeTarget, result.error || "Could not launch payment session", "error");
        }
      } catch (err) {
        showStatusNotice(noticeTarget, "Failed to connect to payment server.", "error");
      }
      return;
    }

    // Otherwise standard COD order
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          address,
          phone,
          paymentMethod,
          items: cartItems,
          promoCode: activePromoCode
        })
      });
      const result = await res.json();

      if (result.success) {
        // Clear guest cart if guest order
        if (!auth.loggedIn) {
          localStorage.removeItem("urbanThreadsGuestCart");
        }
        showStatusNotice(noticeTarget, `Order placed successfully! Reference ID: UT-${result.orderId}`, "success");
        updateGlobalCartCount();
        form.reset();
        
        // Redirect to tracking page or index after delay
        setTimeout(() => {
          window.location.href = `track-order.html?id=UT-${result.orderId}&email=${encodeURIComponent(email)}`;
        }, 2200);
      } else {
        showStatusNotice(noticeTarget, result.error || "Could not place order", "error");
      }
    } catch (err) {
      showStatusNotice(noticeTarget, "Failed to submit order. Check server connection.", "error");
    }
  });
}

// ----------------------------------------------------
// 6. LOGIN & REGISTRATION DYNAMICS
// ----------------------------------------------------
function initLogin() {
  const form = document.getElementById("login-form");
  const noticeTarget = document.getElementById("login-notice-target");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        showStatusNotice(noticeTarget, "Login successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = data.user.role === "admin" ? "admin.html" : "index.html";
        }, 800);
      } else {
        showStatusNotice(noticeTarget, data.error || "Invalid username or password", "error");
      }
    } catch (err) {
      showStatusNotice(noticeTarget, "Server connection failed", "error");
    }
  });
}

function initRegister() {
  const form = document.getElementById("register-form");
  const noticeTarget = document.getElementById("register-notice-target");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    if (password.length < 6) {
      showStatusNotice(noticeTarget, "Password must be at least 6 characters long", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (data.success) {
        showStatusNotice(noticeTarget, "Registration complete! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);
      } else {
        showStatusNotice(noticeTarget, data.error || "Registration failed", "error");
      }
    } catch (err) {
      showStatusNotice(noticeTarget, "Server connection failed", "error");
    }
  });
}

// ----------------------------------------------------
// 7. CUSTOMER PROFILE (ORDERS HISTORY) DYNAMICS
// ----------------------------------------------------
async function initProfile() {
  const container = document.getElementById("orders-list-target");
  const title = document.getElementById("profile-welcome-title");
  if (!container) return;

  const auth = await getAuthSession();
  if (!auth.loggedIn) {
    window.location.href = "login.html";
    return;
  }

  title.textContent = `Hello, ${auth.user.name}!`;

  try {
    const res = await fetch("/api/orders");
    const orders = await res.json();

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="border:0; padding:20px 0;">
          <h3>You haven't placed any orders yet</h3>
          <p style="margin-bottom:20px;">Any transaction invoices you submit will appear here.</p>
          <a href="shop.html" class="btn btn-primary">Start Shopping</a>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const date = new Date(order.created_at).toLocaleDateString("en-LK", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const statusClass = order.status.toLowerCase();

      return `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <h3>Order ID: UT-${order.id}</h3>
              <p style="font-size:0.8rem; color:var(--text-light); margin-top:2px;">Placed on ${date}</p>
            </div>
            <span class="order-status ${statusClass}">${order.status}</span>
          </div>
          <div class="order-items-list">
            ${order.items.map(item => `
              <div class="order-item-row">
                <img src="${item.image}" alt="${item.name}">
                <div class="order-item-info">
                  <h4>${item.name}</h4>
                  <p>Quantity: ${item.quantity} · Price: ${currency.format(item.price)}</p>
                </div>
              </div>
            `).join("")}
          </div>
          <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--line); padding-top:12px; font-size:0.95rem;">
            <span style="color:var(--text-muted);">Payment: ${order.payment_method}</span>
            <strong>Total Invoice: ${currency.format(order.total)}</strong>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Error loading your orders.</div>`;
  }
}

// ----------------------------------------------------
// 8. CUSTOMER REVIEWS DYNAMICS
// ----------------------------------------------------
async function initReviews() {
  const listContainer = document.getElementById("reviews-list-target");
  if (!listContainer) return;

  // Load reviews list
  async function loadReviews() {
    listContainer.innerHTML = `<div class="empty-state">Loading reviews...</div>`;
    try {
      const res = await fetch("/api/reviews");
      const reviews = await res.json();

      if (reviews.length === 0) {
        listContainer.innerHTML = `<div class="empty-state">No reviews posted yet. Be the first!</div>`;
        return;
      }

      listContainer.innerHTML = reviews.map(rev => {
        const starsStr = "★".repeat(rev.rating) + "☆".repeat(5 - rev.rating);
        const date = new Date(rev.created_at).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
        return `
          <article class="review-card" style="margin-bottom: 20px;">
            <div class="review-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span class="review-author" style="font-weight: 600;">
                ${rev.reviewer_name}
                <span style="font-size: 0.8rem; color: var(--accent); font-weight: 600; margin-left: 6px; display: inline-flex; align-items: center; gap: 4px; background: #e6f4ea; color: #1e7a43; padding: 2px 8px; border-radius: 99px; border: 1px solid #1e7a43; font-size: 0.7rem; text-transform: uppercase;">
                  Verified buyer of <a href="product.html?id=${rev.product_id}" style="text-decoration: underline; color: inherit; margin-left: 3px; font-weight: 700;">${rev.product_name || 'Product'}</a>
                </span>
                <span style="font-size:0.75rem; color:var(--text-light); font-weight:normal; margin-left:6px;">on ${date}</span>
              </span>
              <span class="review-stars" style="color: var(--accent); font-size: 0.95rem;">${starsStr}</span>
            </div>
            <p class="review-text" style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; margin: 0;">${rev.review_text}</p>
          </article>
        `;
      }).join("");
    } catch (e) {
      listContainer.innerHTML = `<div class="empty-state">Error loading reviews from database.</div>`;
    }
  }

  loadReviews();
}

// ----------------------------------------------------
// 9. ADMIN PANEL PORTAL
// ----------------------------------------------------
async function initAdmin() {
  const auth = await getAuthSession();
  if (!auth.loggedIn || auth.user.role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  const ordersTarget = document.getElementById("admin-orders-target");
  const inventoryTarget = document.getElementById("admin-inventory-target");
  const addForm = document.getElementById("admin-add-product-form");
  const addNotice = document.getElementById("admin-add-notice");

  // Load Statistics Indicators
  async function loadStats() {
    try {
      const res = await fetch("/api/admin/stats");
      const stats = await res.json();
      document.getElementById("stat-revenue").textContent = currency.format(stats.totalSales);
      document.getElementById("stat-orders").textContent = stats.totalOrders;
      document.getElementById("stat-customers").textContent = stats.totalCustomers;
      document.getElementById("stat-products").textContent = stats.totalProducts;
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  }

  // Load and render Customer Orders Table
  async function loadAdminOrders() {
    ordersTarget.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading orders...</td></tr>`;
    try {
      const res = await fetch("/api/admin/orders");
      const orders = await res.json();

      if (orders.length === 0) {
        ordersTarget.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-light);">No transactions found.</td></tr>`;
        return;
      }

      ordersTarget.innerHTML = orders.map(ord => {
        const itemsSummary = ord.items.map(it => `${it.name} (x${it.quantity})`).join(", ");
        const date = new Date(ord.created_at).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        const statuses = ["Pending", "Processing", "Shipped", "Completed", "Cancelled"];
        const selectOptions = statuses.map(st => `
          <option value="${st}" ${st === ord.status ? "selected" : ""}>${st}</option>
        `).join("");

        return `
          <tr>
            <td><strong>UT-${ord.id}</strong></td>
            <td>${ord.customer_name}<br><span style="font-size:0.75rem; color:var(--text-light);">${ord.customer_email}</span></td>
            <td><span style="font-size:0.8rem; display:block; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${itemsSummary}">${itemsSummary}</span></td>
            <td><strong>${currency.format(ord.total)}</strong></td>
            <td>${date}</td>
            <td>
              <select id="status-select-${ord.id}" style="padding:6px; border-radius:var(--radius-sm); font-family:inherit;">
                ${selectOptions}
              </select>
            </td>
            <td>
              <button class="product-card-btn" onclick="updateOrderStatus(${ord.id})" style="padding:6px 12px; font-size:0.7rem;">Update</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (e) {
      ordersTarget.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#a83c32;">Error loading orders.</td></tr>`;
    }
  }

  // Load and render Inventory Catalog Table
  async function loadAdminInventory() {
    inventoryTarget.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading products catalog...</td></tr>`;
    try {
      const res = await fetch("/api/products");
      const products = await res.json();

      inventoryTarget.innerHTML = products.map(prod => `
        <tr>
          <td>
            <strong>${prod.name}</strong><br>
            <span style="font-size:0.75rem; color:var(--text-light);">${prod.category_label} · Slug: ${prod.slug}</span>
          </td>
          <td>
            <input type="number" id="inv-price-${prod.id}" value="${prod.price}">
          </td>
          <td>
            <input type="number" id="inv-stock-${prod.id}" value="${prod.stock}">
          </td>
          <td>
            <button class="product-card-btn" onclick="updateInventoryItem(${prod.id})" style="padding:6px 10px; font-size:0.7rem; margin-right:4px;">Save</button>
            <button class="product-card-btn" onclick="deleteInventoryItem(${prod.id})" style="padding:6px 10px; font-size:0.7rem; border-color:#a83c32; color:#a83c32;">Delete</button>
          </td>
        </tr>
      `).join("");
    } catch (e) {
      inventoryTarget.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a83c32;">Error loading inventory.</td></tr>`;
    }
  }

  // Hook submit for Add Product form
  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-prod-name").value;
    const category = document.getElementById("admin-prod-category").value;
    const price = document.getElementById("admin-prod-price").value;
    const stock = document.getElementById("admin-prod-stock").value;
    const image = document.getElementById("admin-prod-image").value;
    const description = document.getElementById("admin-prod-desc").value;

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, price, stock, image, description })
      });
      const result = await res.json();
      if (result.success) {
        showStatusNotice(addNotice, "Product added successfully!", "success");
        addForm.reset();
        loadStats();
        loadAdminInventory();
      } else {
        showStatusNotice(addNotice, result.error || "Failed to add product", "error");
      }
    } catch (err) {
      showStatusNotice(addNotice, "Server communication error", "error");
    }
  });

  // Global window exposing admin buttons
  window.updateOrderStatus = async (orderId) => {
    const select = document.getElementById(`status-select-${orderId}`);
    const status = select?.value;
    if (!status) return;

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const result = await res.json();
      if (result.success) {
        alert(`Order UT-${orderId} updated to ${status}`);
        loadStats();
        loadAdminOrders();
      }
    } catch (e) {
      alert("Error updating order status.");
    }
  };

  window.updateInventoryItem = async (productId) => {
    const price = document.getElementById(`inv-price-${productId}`)?.value;
    const stock = document.getElementById(`inv-stock-${productId}`)?.value;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, stock })
      });
      const result = await res.json();
      if (result.success) {
        alert("Product settings saved.");
        loadStats();
        loadAdminInventory();
      }
    } catch (e) {
      alert("Error updating product.");
    }
  };

  window.deleteInventoryItem = async (productId) => {
    if (!confirm("Are you sure you want to delete this product from the inventory?")) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        alert("Product deleted.");
        loadStats();
        loadAdminInventory();
      }
    } catch (e) {
      alert("Error deleting product.");
    }
  };

  // Load sales dashboard tables (Low stock, sales trend, best sellers)
  async function loadDashboardDetails() {
    const lowStockTarget = document.getElementById("admin-low-stock-target");
    const trendTarget = document.getElementById("admin-sales-trend-target");
    const bestSellersTarget = document.getElementById("admin-best-sellers-target");

    try {
      const res = await fetch("/api/admin/dashboard-details");
      const data = await res.json();

      // 1. Low Stock Alerts
      if (data.lowStock && data.lowStock.length > 0) {
        lowStockTarget.innerHTML = data.lowStock.map(p => `
          <tr style="background: rgba(168, 60, 50, 0.05);">
            <td><strong>${p.name}</strong></td>
            <td><span style="color: #a83c32; font-weight: 700;">${p.stock} units</span></td>
            <td>${p.category_label}</td>
          </tr>
        `).join("");
      } else {
        lowStockTarget.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; color: #1e7a43; font-weight: 600;">✅ No items low on stock!</td>
          </tr>
        `;
      }

      // 2. Sales Trend Daily Log
      if (data.dailySales && data.dailySales.length > 0) {
        trendTarget.innerHTML = data.dailySales.map(s => `
          <tr>
            <td>${new Date(s.date).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}</td>
            <td>${s.orders}</td>
            <td><strong>${currency.format(s.sales)}</strong></td>
          </tr>
        `).join("");
      } else {
        trendTarget.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; color: var(--text-light);">No daily revenue log found.</td>
          </tr>
        `;
      }

      // 3. Best Sellers
      if (data.bestSellers && data.bestSellers.length > 0) {
        bestSellersTarget.innerHTML = data.bestSellers.map(b => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${b.image}" alt="${b.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line);">
                <div>
                  <strong>${b.name}</strong><br>
                  <span style="font-size: 0.75rem; color: var(--text-light);">${b.category_label}</span>
                </div>
              </div>
            </td>
            <td><strong>${b.totalSold} sold</strong></td>
            <td><strong>${currency.format(b.revenue)}</strong></td>
          </tr>
        `).join("");
      } else {
        bestSellersTarget.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; color: var(--text-light);">No items sold yet.</td>
          </tr>
        `;
      }
    } catch (e) {
      console.error("Error loading dashboard details:", e);
    }
  }

  // Hook CSV Upload Interactions
  function initCSVUploader() {
    const dragZone = document.getElementById("csv-drag-zone");
    const fileInput = document.getElementById("csv-file-input");
    const notice = document.getElementById("csv-upload-notice");

    if (!dragZone || !fileInput || !notice) return;

    // Prevent defaults on drag/drop
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
      dragZone.addEventListener(eventName, e => e.preventDefault(), false);
    });

    // Highlight drop zone
    ["dragenter", "dragover"].forEach(eventName => {
      dragZone.addEventListener(eventName, () => {
        dragZone.style.borderColor = "var(--accent)";
        dragZone.style.background = "var(--accent-light)";
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      dragZone.addEventListener(eventName, () => {
        dragZone.style.borderColor = "var(--line)";
        dragZone.style.background = "var(--surface-light)";
      }, false);
    });

    // Handle dropped files
    dragZone.addEventListener("drop", e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleCSVFile(files[0]);
      }
    }, false);

    // Handle selected files
    fileInput.addEventListener("change", e => {
      if (fileInput.files.length > 0) {
        handleCSVFile(fileInput.files[0]);
      }
    });

    async function handleCSVFile(file) {
      if (!file.name.endsWith(".csv")) {
        showStatusNotice(notice, "Please upload a valid .csv file.", "error");
        return;
      }

      notice.textContent = "Reading CSV file...";
      notice.className = "notice info";
      notice.style.color = "var(--accent)";

      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvText = event.target.result;
        notice.textContent = "Uploading catalog bulk items...";

        try {
          const res = await fetch("/api/admin/products/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csvText })
          });
          const result = await res.json();

          if (result.success) {
            showStatusNotice(notice, `Bulk Upload Successful! Imported: ${result.successCount} items, Failed: ${result.failCount}`, "success");
            // Refresh dashboard and inventory catalog lists
            loadStats();
            loadAdminInventory();
            loadDashboardDetails();
          } else {
            showStatusNotice(notice, result.error || "Failed to process bulk CSV catalog.", "error");
          }
        } catch (err) {
          showStatusNotice(notice, "Communication failed with servers.", "error");
        }
      };
      reader.readAsText(file);
    }
  }

  // Run admin initializers
  loadStats();
  loadAdminOrders();
  loadAdminInventory();
  loadDashboardDetails();
  initCSVUploader();
}

// ----------------------------------------------------
// WISHLIST, SWATCHES & VIEWED GALLERY HELPERS
// ----------------------------------------------------
window.selectSizeSwatch = (btn, size) => {
  document.querySelectorAll(".size-swatch").forEach(el => {
    el.style.borderColor = "var(--line)";
    el.style.background = "var(--surface)";
    el.style.color = "var(--text-dark)";
  });
  btn.style.borderColor = "var(--accent)";
  btn.style.background = "var(--accent-light)";
  btn.style.color = "var(--accent)";
  document.getElementById("detail-size").value = size;
};

window.selectColorSwatch = (btn, color) => {
  document.querySelectorAll(".color-swatch").forEach(el => {
    el.style.borderColor = "transparent";
    el.style.transform = "scale(1)";
  });
  btn.style.borderColor = "var(--accent)";
  btn.style.transform = "scale(1.15)";
  document.getElementById("detail-color").value = color;
};

window.changeMainImage = (thumb, imgUrl) => {
  document.querySelectorAll(".thumb-wrapper").forEach(el => {
    el.style.borderColor = "var(--line)";
  });
  thumb.style.borderColor = "var(--accent)";
  document.getElementById("main-product-img").src = imgUrl;
};

window.toggleWishlistItem = async (event, productId) => {
  event.preventDefault();
  event.stopPropagation();
  const btn = event.currentTarget;
  const svg = btn.querySelector("svg");
  const auth = await getAuthSession();
  let isFav = btn.classList.contains("active");

  if (auth.loggedIn) {
    try {
      if (isFav) {
        const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          btn.classList.remove("active");
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "var(--text-dark)");
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId })
        });
        const data = await res.json();
        if (data.success) {
          btn.classList.add("active");
          svg.setAttribute("fill", "#a83c32");
          svg.setAttribute("stroke", "#a83c32");
        }
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    let guestWishlist = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    if (isFav) {
      guestWishlist = guestWishlist.filter(id => id !== productId);
      btn.classList.remove("active");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "var(--text-dark)");
    } else {
      if (!guestWishlist.includes(productId)) {
        guestWishlist.push(productId);
      }
      btn.classList.add("active");
      svg.setAttribute("fill", "#a83c32");
      svg.setAttribute("stroke", "#a83c32");
    }
    localStorage.setItem("urbanThreadsWishlist", JSON.stringify(guestWishlist));
  }
};

window.toggleWishlistDetail = async (btn, productId) => {
  const svg = btn.querySelector("svg");
  const auth = await getAuthSession();
  let isFav = btn.classList.contains("active");

  if (auth.loggedIn) {
    try {
      if (isFav) {
        const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          btn.classList.remove("active");
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "var(--text-dark)");
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId })
        });
        const data = await res.json();
        if (data.success) {
          btn.classList.add("active");
          svg.setAttribute("fill", "#a83c32");
          svg.setAttribute("stroke", "#a83c32");
        }
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    let guestWishlist = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    if (isFav) {
      guestWishlist = guestWishlist.filter(id => id !== productId);
      btn.classList.remove("active");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "var(--text-dark)");
    } else {
      if (!guestWishlist.includes(productId)) {
        guestWishlist.push(productId);
      }
      btn.classList.add("active");
      svg.setAttribute("fill", "#a83c32");
      svg.setAttribute("stroke", "#a83c32");
    }
    localStorage.setItem("urbanThreadsWishlist", JSON.stringify(guestWishlist));
  }
};

window.switchProfileTab = (tabName) => {
  const ordersBtn = document.getElementById("tab-orders-btn");
  const wishlistBtn = document.getElementById("tab-wishlist-btn");
  const ordersContent = document.getElementById("tab-orders-content");
  const wishlistContent = document.getElementById("tab-wishlist-content");

  if (!ordersBtn || !wishlistBtn) return;

  if (tabName === 'orders') {
    ordersBtn.classList.add("active");
    ordersBtn.style.borderBottomColor = "var(--accent)";
    ordersBtn.style.color = "var(--text-dark)";
    
    wishlistBtn.classList.remove("active");
    wishlistBtn.style.borderBottomColor = "transparent";
    wishlistBtn.style.color = "var(--text-muted)";

    ordersContent.style.display = "block";
    wishlistContent.style.display = "none";
  } else {
    wishlistBtn.classList.add("active");
    wishlistBtn.style.borderBottomColor = "var(--accent)";
    wishlistBtn.style.color = "var(--text-dark)";

    ordersBtn.classList.remove("active");
    ordersBtn.style.borderBottomColor = "transparent";
    ordersBtn.style.color = "var(--text-muted)";

    ordersContent.style.display = "none";
    wishlistContent.style.display = "block";
    initProfileWishlist();
  }
};

async function initProfileWishlist() {
  const container = document.getElementById("wishlist-list-target");
  if (!container) return;

  const auth = await getAuthSession();
  let items = [];

  if (auth.loggedIn) {
    try {
      const res = await fetch("/api/wishlist");
      items = await res.json();
    } catch (e) {
      console.error(e);
    }
  } else {
    const guestWishlist = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    for (const id of guestWishlist) {
      try {
        const res = await fetch(`/api/products/${id}`);
        const product = await res.json();
        if (!product.error) {
          items.push(product);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; border:0; padding:40px 0; text-align:center; width:100%;">
        <h3>Your favorites list is empty</h3>
        <p style="margin-bottom:20px;">Save timeless pieces to your wishlist for later.</p>
        <a href="shop.html" class="btn btn-primary">Browse Shop</a>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(p => `
    <article class="product-card" id="wishlist-card-${p.id}">
      <div class="product-card-img-wrapper" style="position: relative;">
        <a href="product.html?id=${p.id}" class="product-card-img">
          ${renderCardBadge(p)}
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </a>
        <button class="wishlist-card-btn active" onclick="removeFromWishlistPage(event, ${p.id})" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.9); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#a83c32" stroke="#a83c32" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
      <div class="product-card-body">
        <div class="product-card-category">${p.category_label}</div>
        <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
        ${renderStars(p.average_rating, p.review_count)}
        <div class="product-card-footer">
          ${renderCardPrice(p)}
          <button class="product-card-btn" onclick="quickAddToCart(${p.id})">Add To Cart</button>
        </div>
      </div>
    </article>
  `).join("");
}

window.removeFromWishlistPage = async (event, productId) => {
  event.preventDefault();
  event.stopPropagation();
  const auth = await getAuthSession();

  if (auth.loggedIn) {
    await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
  } else {
    let guestWishlist = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]").map(Number);
    guestWishlist = guestWishlist.filter(id => id !== productId);
    localStorage.setItem("urbanThreadsWishlist", JSON.stringify(guestWishlist));
  }

  initProfileWishlist();
};

// ----------------------------------------------------
// GLOBAL HELPERS & UTILITIES
// ----------------------------------------------------
window.quickAddToCart = async (productId) => {
  const auth = await getAuthSession();
  
  // Grab product detail to ensure it's in stock
  const prodRes = await fetch(`/api/products/${productId}`);
  const product = await prodRes.json();
  if (product.stock <= 0) {
    alert("This product is sold out.");
    return;
  }

  const defaultSize = "M";
  const defaultColor = "Off-White";

  if (auth.loggedIn) {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size: defaultSize, color: defaultColor, quantity: 1 })
      });
      const data = await res.json();
      if (data.success) {
        alert("Added to cart successfully.");
        updateGlobalCartCount();
      } else {
        alert(data.error || "Could not add to cart.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to add to cart.");
    }
  } else {
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
    }
    const existingIndex = guestCart.findIndex(item => item.id === productId && item.size === defaultSize && item.color === defaultColor);
    if (existingIndex > -1) {
      guestCart[existingIndex].quantity += 1;
    } else {
      guestCart.push({ id: productId, size: defaultSize, color: defaultColor, quantity: 1 });
    }
    localStorage.setItem("urbanThreadsGuestCart", JSON.stringify(guestCart));
    alert("Added to cart (Guest Session).");
    updateGlobalCartCount();
  }
};

function showStatusNotice(target, message, type) {
  if (!target) return;
  target.className = `notice ${type}`;
  target.textContent = message;
  target.style.display = "block";
  
  window.clearTimeout(target.timer);
  target.timer = window.setTimeout(() => {
    target.style.display = "none";
  }, 3500);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ----------------------------------------------------
// PRODUCT REVIEW LOAD & SUBMIT HELPERS
// ----------------------------------------------------
async function loadProductReviews(productId) {
  const feedTarget = document.getElementById("reviews-feed-target");
  const writeTarget = document.getElementById("review-write-box-target");

  if (!feedTarget || !writeTarget) return;

  // 1. Fetch and render reviews list
  try {
    const res = await fetch(`/api/products/${productId}/reviews`);
    const reviews = await res.json();

    if (reviews.length === 0) {
      feedTarget.innerHTML = `
        <div class="empty-state" style="border: 0; padding: 40px 0; text-align: center;">
          <p>No reviews yet for this product. Be the first to purchase and review!</p>
        </div>
      `;
    } else {
      feedTarget.innerHTML = reviews.map(r => {
        const dateStr = new Date(r.created_at).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
        const starHTML = Array.from({ length: 5 }, (_, i) => `<span style="color: ${i < r.rating ? '#dfba73' : 'var(--line)'}; font-size: 0.95rem; line-height: 1;">★</span>`).join("");
        
        const badgeHTML = r.verified 
          ? `<span class="verified-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; background: #e6f4ea; color: #1e7a43; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 10px; border: 1px solid #1e7a43; vertical-align: middle;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" style="stroke-linecap: round; stroke-linejoin: round;"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified Buyer</span>`
          : "";

        return `
          <div class="review-item" style="border-bottom: 1px solid var(--line); padding: 20px 0; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center;">
                <strong style="font-size: 0.95rem; color: var(--text-dark);">${r.reviewer_name}</strong>
                ${badgeHTML}
              </div>
              <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">${dateStr}</span>
            </div>
            <div style="display: flex;">${starHTML}</div>
            <p style="margin: 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">${r.review_text}</p>
          </div>
        `;
      }).join("");
    }
  } catch (e) {
    feedTarget.innerHTML = `<div class="empty-state" style="border:0;">Error loading reviews feed.</div>`;
  }

  // 2. Fetch and render review eligibility form
  try {
    const res = await fetch(`/api/products/${productId}/eligibility`);
    const eligibility = await res.json();

    if (eligibility.canReview) {
      writeTarget.innerHTML = `
        <h3 style="font-size: 1.05rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; color: var(--text-dark);">Share Your Feedback</h3>
        <form id="product-review-form" onsubmit="submitProductReview(event, ${productId})" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group" style="gap: 4px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">Your Display Name</label>
            <input type="text" id="review-reviewer-name" required placeholder="e.g. John Doe" style="padding: 8px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-family: inherit; font-size: 0.9rem; background: var(--surface);">
          </div>
          <div class="form-group" style="gap: 4px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">Rating</label>
            <select id="review-rating" required style="padding: 8px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-family: inherit; font-size: 0.9rem; background: var(--surface);">
              <option value="5">★★★★★ - Excellent</option>
              <option value="4">★★★★☆ - Very Good</option>
              <option value="3">★★★☆☆ - Good</option>
              <option value="2">★★☆☆☆ - Fair</option>
              <option value="1">★☆☆☆☆ - Poor</option>
            </select>
          </div>
          <div class="form-group" style="gap: 4px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">Review Comments</label>
            <textarea id="review-text-comments" required rows="3" placeholder="What did you like or dislike about this item?..." style="padding: 8px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-family: inherit; font-size: 0.9rem; background: var(--surface); resize: vertical; min-height: 70px;"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.8rem; text-transform: uppercase; font-family: inherit; letter-spacing: 0.05em;">Submit Verified Review</button>
        </form>
      `;
    } else {
      writeTarget.innerHTML = `
        <h3 style="font-size: 1.05rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; color: var(--text-dark);">Write a Review</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">${eligibility.reason}</p>
        ${eligibility.reason.includes("log in") ? `<a href="login.html" class="btn btn-secondary" style="display: block; text-align: center; margin-top: 12px; padding: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Log In Now</a>` : ""}
      `;
    }
  } catch (e) {
    writeTarget.innerHTML = `<div class="empty-state" style="border:0;">Error checking review eligibility.</div>`;
  }
}

window.submitProductReview = async (event, productId) => {
  event.preventDefault();
  const name = document.getElementById("review-reviewer-name")?.value;
  const rating = document.getElementById("review-rating")?.value;
  const text = document.getElementById("review-text-comments")?.value;

  if (!name || !rating || !text) return;

  try {
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rating, text })
    });
    const data = await res.json();
    if (data.success) {
      alert("Thank you! Your verified review has been published.");
      // Reload product details to recalculate ratings/reviews counts and list
      initProductDetails();
    } else {
      alert(data.error || "Failed to submit review.");
    }
  } catch (e) {
    console.error(e);
    alert("Error submitting review.");
  }
};

// ----------------------------------------------------
// 12. GUEST ORDER TRACKING TIMELINE
// ----------------------------------------------------
async function initOrderTracking() {
  const form = document.getElementById("order-lookup-form");
  const noticeTarget = document.getElementById("lookup-notice-target");
  const resultsCard = document.getElementById("tracking-results-card");

  if (!form || !noticeTarget || !resultsCard) return;

  // Handler to fetch and render order tracking progress
  async function fetchTracking(orderId, email) {
    noticeTarget.style.display = "none";
    resultsCard.style.display = "none";

    try {
      const res = await fetch(`/api/orders/track?orderId=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.error) {
        noticeTarget.className = "notice error";
        noticeTarget.textContent = data.error;
        noticeTarget.style.display = "block";
        return;
      }

      const { order, items } = data;

      // 1. Show results card
      resultsCard.style.display = "block";

      // 2. Map status to timeline steps
      // Valid statuses: 'Pending', 'Processing', 'Shipped', 'Delivered'
      const status = (order.status || "Pending").toLowerCase();
      const steps = ["step-pending", "step-processing", "step-shipped", "step-delivered"];
      const activeLine = document.getElementById("timeline-progress-line");

      let currentStepIdx = 0; // 0=Placed, 1=Preparing, 2=Shipped, 3=Delivered
      if (status === "processing" || status === "paid" || status === "unpaid") {
        currentStepIdx = 1;
      } else if (status === "shipped") {
        currentStepIdx = 2;
      } else if (status === "delivered") {
        currentStepIdx = 3;
      }

      // Update stepper colors
      steps.forEach((stepId, index) => {
        const stepEl = document.getElementById(stepId);
        if (!stepEl) return;
        const circle = stepEl.querySelector(".step-circle");
        const label = stepEl.querySelector(".step-label");

        if (index <= currentStepIdx) {
          circle.style.background = "var(--accent)";
          circle.style.color = "#ffffff";
          circle.style.borderColor = "var(--accent)";
          label.style.color = "var(--text-dark)";
        } else {
          circle.style.background = "var(--line)";
          circle.style.color = "var(--text-muted)";
          circle.style.borderColor = "var(--line)";
          label.style.color = "var(--text-light)";
        }
      });

      // Update progress line width
      if (activeLine) {
        activeLine.style.width = `${(currentStepIdx / (steps.length - 1)) * 100}%`;
      }

      // 3. Populate recipient & order info
      document.getElementById("track-recipient").textContent = order.customer_name;
      document.getElementById("track-date").textContent = new Date(order.created_at).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById("track-address").textContent = order.delivery_address;
      document.getElementById("track-paymethod").textContent = order.payment_method;
      document.getElementById("track-paystatus").textContent = order.payment_status;

      // Color payment status
      const payStatusEl = document.getElementById("track-paystatus");
      if (order.payment_status === "Paid") {
        payStatusEl.style.color = "#1e7a43";
      } else {
        payStatusEl.style.color = "var(--accent)";
      }

      // 4. Item summary list
      const itemsList = document.getElementById("track-items-list");
      itemsList.innerHTML = items.map(item => `
        <div style="display: flex; gap: 15px; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 4px;">
          <img src="${item.image}" alt="${item.name}" style="width: 54px; height: 54px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line);">
          <div style="flex: 1;">
            <h5 style="margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--text-dark);">${item.name}</h5>
            <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}</span>
          </div>
          <strong style="font-size: 0.9rem; color: var(--text-dark);">${currency.format(item.price * item.quantity)}</strong>
        </div>
      `).join("");

      // 5. Receipt Invoice
      document.getElementById("track-subtotal").textContent = currency.format(order.subtotal);
      
      const discountRow = document.getElementById("track-discount-row");
      const discountEl = document.getElementById("track-discount");
      if (order.discount_amount > 0) {
        discountRow.style.display = "flex";
        discountEl.textContent = `- ${currency.format(order.discount_amount)}`;
      } else {
        discountRow.style.display = "none";
      }

      document.getElementById("track-delivery").textContent = currency.format(order.delivery);
      document.getElementById("track-total").textContent = currency.format(order.total);

    } catch (err) {
      noticeTarget.className = "notice error";
      noticeTarget.textContent = "Server communication failure.";
      noticeTarget.style.display = "block";
    }
  }

  // Bind Submit Handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const orderId = document.getElementById("lookup-order-id").value.trim();
    const email = document.getElementById("lookup-email").value.trim();
    if (orderId && email) {
      fetchTracking(orderId, email);
    }
  });

  // Pre-load lookup if credentials are in the URL parameters (for links in order emails)
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get("id");
  const paramEmail = urlParams.get("email");

  if (paramId && paramEmail) {
    document.getElementById("lookup-order-id").value = paramId;
    document.getElementById("lookup-email").value = paramEmail;
    fetchTracking(paramId, paramEmail);
  }
}
