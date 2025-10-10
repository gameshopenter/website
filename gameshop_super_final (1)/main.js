/* =============================================================
   GameShop Enter – JavaScript
   Handelt navigatie, productlijst, productdetails, winkelwagen
   en checkout via Mollie af.
============================================================= */

const GSE = (() => {
  /**
   * Slugify a string to generate a URL‑friendly identifier.
   * @param {string} str
   * @returns {string}
   */
  function slugify(str) {
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
  }

  /**
   * Get the shopping cart from localStorage.
   * @returns {{items: Array}}
   */
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem('GSE_CART') || '{"items":[]}');
    } catch (e) {
      return { items: [] };
    }
  }

  /**
   * Save the shopping cart to localStorage.
   * @param {object} cart
   */
  function saveCart(cart) {
    localStorage.setItem('GSE_CART', JSON.stringify(cart));
  }

  /**
   * Update cart count in the navigation.
   */
  function updateCartCount() {
    const cart = getCart();
    const total = cart.items.reduce((sum, it) => sum + it.qty, 0);
    document.querySelectorAll('#cartCount').forEach(el => {
      el.textContent = total;
    });
  }

  /**
   * Normalize image paths. If the provided path starts with http(s), it is returned as‑is.
   * Otherwise the relative path is returned, trimming leading slashes.
   * If no path is provided, a placeholder image is used.
   * @param {string} p
   * @returns {string}
   */
  function fixImage(p) {
    if (!p) return 'images/products/IMG_6131.jpeg';
    const t = String(p).trim();
    if (/^(https?:)?\/\//i.test(t)) return t;
    return t.replace(/^\/+/, '');
  }

  /**
   * Add an item to the cart. The item object should include
   * title, priceCents, image, slug, category and optionally other properties.
   * @param {object} item
   */
  function addToCart(item) {
    const cart = getCart();
    const key = item.slug;
    const existing = cart.items.find(x => x.slug === key && x.priceCents === item.priceCents);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.items.push({ ...item, qty: 1 });
    }
    saveCart(cart);
    updateCartCount();
    // Optional: provide visual feedback
    alert(`${item.title} toegevoegd aan je winkelwagen.`);
  }

  /**
   * Load the product listing page. Fetches inventory and renders product cards.
   */
  async function loadProducts() {
    updateCartCount();
    const res = await fetch('inventory_local.json', { cache: 'no-store' });
    const items = await res.json();
    const searchInput = document.getElementById('search');
    const categorySelect = document.getElementById('category');
    const grid = document.getElementById('product-grid');
    // Unique categories
    const categories = [...new Set(items.map(it => it.category || 'Overig'))].sort();
    categorySelect.innerHTML = '<option value="">Alle categorieën</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    function render() {
      const q = searchInput.value.toLowerCase().trim();
      const cat = categorySelect.value;
      grid.innerHTML = '';
      const filtered = items.filter(it => {
        const matchQ = !q || it.title.toLowerCase().includes(q);
        const matchC = !cat || (it.category === cat);
        return matchQ && matchC;
      });
      if (!filtered.length) {
        const p = document.createElement('p');
        p.className = 'no-results';
        p.textContent = 'Geen resultaten…';
        grid.appendChild(p);
        return;
      }
      for (const it of filtered) {
        const slug = slugify(it.title);
        const price = Number(it.price) || 0;
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
          <a href="product.html?slug=${encodeURIComponent(slug)}" class="product-thumb-link">
            <img src="${fixImage(it.image)}" alt="${it.title}" class="product-thumb">
          </a>
          <div class="product-info">
            <h3><a href="product.html?slug=${encodeURIComponent(slug)}">${it.title}</a></h3>
            <p class="price">€ ${price.toFixed(2)}</p>
            <p class="condition">Gebruikt – voorbeeldfoto</p>
          </div>
          <button class="btn-small" data-slug="${slug}" data-title="${it.title}" data-price="${price}" data-image="${fixImage(it.image)}" data-category="${it.category || ''}">In winkelwagen</button>
        `;
        grid.appendChild(card);
      }
      // Bind add to cart buttons
      grid.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', e => {
          const t = e.currentTarget;
          const priceCents = Math.round(parseFloat(t.dataset.price) * 100);
          addToCart({
            title: t.dataset.title,
            priceCents,
            image: t.dataset.image,
            slug: t.dataset.slug,
            category: t.dataset.category
          });
        });
      });
    }
    searchInput.addEventListener('input', render);
    categorySelect.addEventListener('change', render);
    render();
  }

  /**
   * Load the product detail page based on slug in query string.
   */
  async function loadProductDetail() {
    updateCartCount();
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const container = document.getElementById('product-detail');
    if (!slug) {
      container.textContent = 'Product niet gevonden.';
      return;
    }
    const res = await fetch('inventory_local.json', { cache: 'no-store' });
    const items = await res.json();
    const item = items.find(it => slugify(it.title) === slug);
    if (!item) {
      container.textContent = 'Product niet gevonden.';
      return;
    }
    const price = Number(item.price) || 0;
    const priceCents = Math.round(price * 100);
    container.innerHTML = `
      <div class="product-detail-wrapper">
        <div class="product-detail-image">
          <img src="${fixImage(item.image)}" alt="${item.title}">
        </div>
        <div class="product-detail-info">
          <h2>${item.title}</h2>
          <p class="price">€ ${price.toFixed(2)}</p>
          <p class="condition">Gebruikt – voorbeeldfoto</p>
          <p class="description">Dit is een algemene productbeschrijving voor <strong>${item.title}</strong>. Alle tweedehands games en consoles worden door ons zorgvuldig getest en schoongemaakt. De getoonde afbeelding dient als voorbeeld; de daadwerkelijke staat kan licht afwijken. We verzenden elk product stevig verpakt; afhalen is niet mogelijk.</p>
          <button id="add-to-cart-detail" class="btn">In winkelwagen</button>
        </div>
      </div>
    `;
    document.getElementById('add-to-cart-detail').addEventListener('click', () => {
      addToCart({ title: item.title, priceCents, image: fixImage(item.image), slug, category: item.category || '' });
    });
  }

  /**
   * Render the cart page.
   */
  function loadCartPage() {
    updateCartCount();
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('cart-checkout');
    const cart = getCart();
    container.innerHTML = '';
    if (!cart.items.length) {
      container.innerHTML = '<p>Je winkelwagen is leeg.</p>';
      totalEl.textContent = '€0,00';
      return;
    }
    cart.items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${fixImage(it.image)}" alt="${it.title}">
        <div class="cart-item-info">
          <div>${it.title}</div>
          <div>€ ${(it.priceCents / 100).toFixed(2)}</div>
        </div>
        <div class="cart-item-controls">
          <button data-idx="${idx}" data-delta="-1">−</button>
          <span>${it.qty}</span>
          <button data-idx="${idx}" data-delta="1">+</button>
          <button data-idx="${idx}" data-delta="delete">×</button>
        </div>
      `;
      container.appendChild(row);
    });
    // Update total
    const totalCents = cart.items.reduce((sum, it) => sum + it.priceCents * it.qty, 0);
    totalEl.textContent = `€ ${(totalCents / 100).toFixed(2)}`;
    // Bind quantity buttons
    container.querySelectorAll('.cart-item-controls button').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(btn.dataset.idx);
        const delta = btn.dataset.delta;
        if (delta === 'delete') {
          cart.items.splice(idx, 1);
        } else {
          const d = parseInt(delta);
          cart.items[idx].qty += d;
          if (cart.items[idx].qty <= 0) cart.items.splice(idx, 1);
        }
        saveCart(cart);
        loadCartPage();
      });
    });
    // Checkout handler
    checkoutBtn.onclick = async () => {
      if (!cart.items.length) {
        alert('Je winkelwagen is leeg.');
        return;
      }
      // Prepare payload for Mollie
      const payload = {
        items: cart.items.map(it => ({
          title: it.title,
          priceCents: it.priceCents,
          qty: it.qty,
          image: it.image,
          slug: it.slug,
          category: it.category || ''
        })),
        customer: {}
      };
      try {
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.checkoutUrl) {
          // Clear cart after sending to payment page
          // Optionally only clear after success via webhook
          saveCart({ items: [] });
          window.location.href = data.checkoutUrl;
        } else {
          alert('Er is iets misgegaan bij het starten van de betaling.');
        }
      } catch (err) {
        alert('Er is iets misgegaan bij het starten van de betaling.');
      }
    };
  }

  /**
   * Initialize navigation: highlight active link based on pathname.
   */
  function initNavigation() {
    const path = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
  }

  /**
   * Expose public methods.
   */
  return {
    slugify,
    getCart,
    saveCart,
    updateCartCount,
    addToCart,
    loadProducts,
    loadProductDetail,
    loadCartPage,
    initNavigation
  };
})();

// Initialize common UI on page load
document.addEventListener('DOMContentLoaded', () => {
  GSE.initNavigation();
  GSE.updateCartCount();
  // Contactformulier handler
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    const statusEl = document.getElementById('contactStatus');
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      // Simuleer het versturen van het formulier
      if (statusEl) {
        statusEl.textContent = 'Bedankt! We nemen zo snel mogelijk contact met je op.';
      }
      contactForm.reset();
    });
  }
});