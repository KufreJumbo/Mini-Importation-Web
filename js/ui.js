// =============================================================
// CHI-BEST STOREFRONT UI
// Shared chrome (header, search, menus, cart drawer, footer),
// product cards, quick view, toasts and customer-side storage.
// Pages call:  UI.boot({ page: 'home' }).then((ctx) => ...)
// =============================================================
(function () {
  'use strict';

  const I = (n, c) => Icons.svg(n, c);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => DB.util.money(n);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const thumb = (src) => (/images\/catalog\/.+-\d+\.jpg$/.test(src || '') ? src.replace(/\.jpg$/, '-sm.jpg') : src || '');
  const productUrl = (p) => `product.html?p=${encodeURIComponent(p.slug || p.id)}`;
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f1ec"/><path d="M38 40h24v20H38z" fill="none" stroke="#c9c5bc" stroke-width="2"/></svg>');

  // ---------------------------------------------------------------
  // Customer-side storage (cart, wishlist, recently viewed, orders)
  // ---------------------------------------------------------------
  const KEY = 'chibest.';
  const local = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  };

  const Cart = {
    items() { return local.get('cart', []); },
    save(items) { local.set('cart', items); UI.refreshCart(); },
    key(productId, options) { return `${productId}#${DB.util.optionsKey(options)}`; },
    qtyOf(productId) { return Cart.items().filter((i) => i.productId === productId).reduce((s, i) => s + i.qty, 0); },
    add(productId, qty, options) {
      const items = Cart.items();
      const key = Cart.key(productId, options);
      const found = items.find((i) => i.key === key);
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({ key, productId, qty, options: options || {}, addedAt: Date.now() });
      Cart.save(items);
    },
    setQty(key, qty) {
      const items = Cart.items();
      const it = items.find((i) => i.key === key);
      if (!it) return;
      if (qty <= 0) return Cart.remove(key);
      it.qty = Math.min(99, qty);
      Cart.save(items);
    },
    remove(key) { Cart.save(Cart.items().filter((i) => i.key !== key)); },
    clear() { Cart.save([]); },
    count() { return Cart.items().reduce((s, i) => s + i.qty, 0); }
  };

  const Wish = {
    ids() { return local.get('wishlist', []); },
    has(id) { return Wish.ids().includes(id); },
    toggle(id) {
      const ids = Wish.ids();
      const on = !ids.includes(id);
      local.set('wishlist', on ? [id, ...ids] : ids.filter((x) => x !== id));
      UI.refreshWish();
      return on;
    }
  };

  const Recent = {
    push(id) { local.set('recent', [id, ...Recent.ids().filter((x) => x !== id)].slice(0, 16)); },
    ids() { return local.get('recent', []); }
  };

  const MyOrders = {
    add(o) { local.set('myorders', [{ number: o.number, phone: o.customer?.phone || '', total: o.total, createdAt: o.createdAt }, ...MyOrders.list().filter((x) => x.number !== o.number)].slice(0, 20)); },
    list() { return local.get('myorders', []); }
  };

  // ---------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------
  const fmtDate = (iso, opts = {}) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: opts.year === false ? undefined : 'numeric' }) +
      (opts.time ? ' · ' + d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' }) : '');
  };
  const optionText = (opts) => Object.entries(opts || {}).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ');

  function waLink(text) {
    const n = DB.util.digits(UI.ctx?.settings?.whatsapp || '');
    return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  }

  // ---------------------------------------------------------------
  // Product card
  // ---------------------------------------------------------------
  function priceHtml(p, cls = '') {
    const sale = p.compareAtPrice && p.compareAtPrice > p.price;
    const off = sale ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
    return `<div class="pcard-price ${cls}"><span class="price${sale ? ' sale' : ''}">${money(p.price)}</span>${sale ? `<span class="price-was">${money(p.compareAtPrice)}</span><span class="price-off">-${off}%</span>` : ''}</div>`;
  }

  function stockLine(a) {
    if (a.state === 'in') return `<div class="pcard-stock in"><span class="dot"></span>In stock</div>`;
    if (a.state === 'low') return `<div class="pcard-stock low"><span class="dot"></span>${esc(a.label)}</div>`;
    if (a.state === 'pre') return `<div class="pcard-stock pre">${I('plane')}Pre-order · ${esc(a.lead)}</div>`;
    return `<div class="pcard-stock out"><span class="dot"></span>${esc(a.label)}</div>`;
  }

  function productCard(p, { eager = false } = {}) {
    const ctx = UI.ctx;
    const a = DB.util.availability(p, ctx.settings);
    const cat = ctx.catById.get(p.categoryId);
    const img1 = thumb(p.images?.[0]) || PLACEHOLDER;
    const img2 = p.images?.[1] ? thumb(p.images[1]) : '';
    const sale = p.compareAtPrice && p.compareAtPrice > p.price;
    const badges = [];
    if (a.state === 'out') badges.push('<span class="badge badge-light">Sold out</span>');
    else if (a.state === 'pre') badges.push('<span class="badge badge-light">Pre-order</span>');
    if (p.badge) badges.push(`<span class="badge">${esc(p.badge)}</span>`);
    else if (sale) badges.push(`<span class="badge badge-brand">-${Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>`);
    const wished = Wish.has(p.id);
    const hasOptions = (p.options || []).some((g) => g.values?.length > 1);
    return `<article class="pcard${img2 ? ' has-alt' : ''}${a.state === 'out' ? ' is-soldout' : ''}" data-id="${esc(p.id)}">
      <div class="pcard-media">
        <img class="main" src="${esc(img1)}" alt="${esc(p.name)}" width="480" height="480" ${eager ? '' : 'loading="lazy"'} decoding="async">
        ${img2 ? `<img class="alt" src="${esc(img2)}" alt="" width="480" height="480" loading="lazy" decoding="async">` : ''}
        ${badges.length ? `<div class="pcard-badges">${badges.join('')}</div>` : ''}
        <button class="pcard-wish${wished ? ' is-on' : ''}" type="button" data-wish="${esc(p.id)}" aria-pressed="${wished}" aria-label="${wished ? 'Remove from' : 'Save to'} wishlist">${I('heart')}</button>
        ${a.canBuy ? `<button class="pcard-quick" type="button" data-quick="${esc(p.id)}" aria-label="${hasOptions ? 'Choose options for' : 'Add to cart:'} ${esc(p.name)}">${I(hasOptions ? 'plus' : 'bag')}<span>${hasOptions ? 'Choose options' : 'Add to cart'}</span></button>` : ''}
      </div>
      <div class="pcard-body">
        ${cat ? `<span class="pcard-cat">${esc(cat.name)}</span>` : ''}
        <a class="pcard-name" href="${productUrl(p)}">${esc(p.name)}</a>
        ${priceHtml(p)}
        ${stockLine(a)}
      </div>
    </article>`;
  }

  function skeletonCards(n) {
    return Array.from({ length: n }, () => `<div class="sk-card" aria-hidden="true"><div class="skeleton sk-media"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div>`).join('');
  }

  // ---------------------------------------------------------------
  // Option picker (product page + quick view)
  // ---------------------------------------------------------------
  function optionsHtml(p, selected = {}) {
    return (p.options || []).filter((g) => g.values?.length).map((g) => `
      <div class="opt-group" data-opt="${esc(g.name)}">
        <div class="opt-head"><strong>${esc(g.name)}</strong><span data-opt-value>${esc(selected[g.name] || (g.values.length === 1 ? g.values[0] : 'Select'))}</span></div>
        <div class="opt-values" role="radiogroup" aria-label="${esc(g.name)}">
          ${g.values.map((v) => `<button type="button" role="radio" aria-checked="${selected[g.name] === v || g.values.length === 1}" class="${selected[g.name] === v || g.values.length === 1 ? 'is-on' : ''}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}
        </div>
        <div class="opt-error">Please select a ${esc(g.name.toLowerCase())}.</div>
      </div>`).join('');
  }
  function bindOptions(root, onChange) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.opt-values button');
      if (!b) return;
      const g = b.closest('.opt-group');
      $$('button', g).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); });
      $('[data-opt-value]', g).textContent = b.dataset.value;
      g.classList.remove('has-error');
      onChange && onChange(readOptions(root));
    });
  }
  function readOptions(root) {
    const out = {};
    $$('.opt-group', root).forEach((g) => { const on = $('button.is-on', g); if (on) out[g.dataset.opt] = on.dataset.value; });
    return out;
  }
  function validateOptions(root) {
    let ok = true;
    $$('.opt-group', root).forEach((g) => { const on = $('button.is-on', g); g.classList.toggle('has-error', !on); if (!on) ok = false; });
    if (!ok) $('.opt-group.has-error', root)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return ok;
  }

  // ---------------------------------------------------------------
  // Add to cart
  // ---------------------------------------------------------------
  function addToCart(p, qty, options, { openDrawer = false, silent = false } = {}) {
    const a = DB.util.availability(p, UI.ctx.settings);
    if (!a.canBuy) { toast({ type: 'error', title: `${p.name} is sold out` }); return false; }
    const inCart = Cart.qtyOf(p.id);
    if (a.state !== 'pre' && inCart + qty > a.max) {
      const room = Math.max(0, a.max - inCart);
      if (!room) { toast({ type: 'error', title: 'No more stock available', sub: `You already have all ${a.max} in your cart.` }); return false; }
      qty = room;
      toast({ type: 'info', title: `Only ${a.max} available`, sub: `We added ${room} to your cart.` });
    }
    Cart.add(p.id, qty, options);
    if (openDrawer) openCart();
    else if (!silent) toast({ title: 'Added to cart', sub: p.name, image: thumb(p.images?.[0]), action: { label: 'View cart', onClick: openCart } });
    return true;
  }

  // ---------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------
  function toast({ title, sub = '', type = 'success', image = '', action = null, duration = 3800 }) {
    const host = $('#toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${image ? `<img src="${esc(image)}" alt="">` : `<span class="t-icon">${I(type === 'error' ? 'x' : type === 'info' ? 'info' : 'check')}</span>`}
      <div class="t-body">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      ${action ? `<button class="t-action" type="button">${esc(action.label)}</button>` : ''}`;
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    const close = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); };
    if (action) $('.t-action', el).addEventListener('click', () => { close(); action.onClick ? action.onClick() : (location.href = action.href); });
    setTimeout(close, duration);
  }

  // ---------------------------------------------------------------
  // Drawers, modal, lightbox
  // ---------------------------------------------------------------
  let lastFocus = null;
  function openDrawer(id) {
    closeOverlays(true);
    const d = document.getElementById(id);
    if (!d) return;
    lastFocus = document.activeElement;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('is-open');
    document.body.classList.add('no-scroll');
    setTimeout(() => ($('[data-autofocus]', d) || $('.drawer-head button', d))?.focus(), 60);
  }
  function closeOverlays(keepScrim) {
    $$('.drawer.is-open').forEach((d) => { d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); });
    $$('.modal.is-open').forEach((m) => { m.classList.remove('is-open'); setTimeout(() => m.remove(), 250); });
    if (!keepScrim) {
      $('#scrim')?.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      lastFocus?.focus?.();
    }
    closeMega();
  }
  function openCart() { renderCartDrawer(); openDrawer('cart-drawer'); }

  function modal(html, { label = 'Dialog', onMount } = {}) {
    closeOverlays(true);
    lastFocus = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', label);
    m.innerHTML = `<div class="modal-card"><button class="icon-btn modal-close" type="button" aria-label="Close">${I('x')}</button>${html}</div>`;
    document.body.appendChild(m);
    $('#scrim').classList.add('is-open');
    document.body.classList.add('no-scroll');
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.modal-close')) closeOverlays(); });
    requestAnimationFrame(() => { m.classList.add('is-open'); $('.modal-close', m).focus(); });
    onMount && onMount(m);
    return { el: m, close: () => closeOverlays() };
  }

  function lightbox(images, start = 0) {
    let i = start;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = `<img alt=""><button class="icon-btn lb-close" aria-label="Close">${I('x')}</button>
      ${images.length > 1 ? `<button class="icon-btn lb-prev" aria-label="Previous image">${I('chevron-left')}</button><button class="icon-btn lb-next" aria-label="Next image">${I('chevron-right')}</button><div class="lb-count"></div>` : ''}`;
    document.body.appendChild(lb);
    const show = () => { $('img', lb).src = images[i]; const c = $('.lb-count', lb); if (c) c.textContent = `${i + 1} / ${images.length}`; };
    const close = () => { lb.classList.remove('is-open'); document.removeEventListener('keydown', key); setTimeout(() => lb.remove(), 200); };
    const step = (d) => { i = (i + d + images.length) % images.length; show(); };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    lb.addEventListener('click', (e) => {
      if (e.target.closest('.lb-next')) step(1);
      else if (e.target.closest('.lb-prev')) step(-1);
      else if (e.target.closest('.lb-close') || e.target === lb) close();
    });
    document.addEventListener('keydown', key);
    show();
    requestAnimationFrame(() => lb.classList.add('is-open'));
  }

  // ---------------------------------------------------------------
  // Quick view
  // ---------------------------------------------------------------
  function quickView(p) {
    const a = DB.util.availability(p, UI.ctx.settings);
    const cat = UI.ctx.catById.get(p.categoryId);
    let qty = 1;
    const m = modal(`<div class="qv">
      <div class="qv-media"><img src="${esc(p.images?.[0] || PLACEHOLDER)}" alt="${esc(p.name)}"></div>
      <div class="qv-info">
        <div>
          ${cat ? `<a class="eyebrow" href="shop.html?c=${esc(cat.id)}">${esc(cat.name)}</a>` : ''}
          <h3>${esc(p.name)}</h3>
          <div style="margin-top:10px">${priceHtml(p, 'pprice')}</div>
        </div>
        <div class="avail ${a.state}"><span class="avail-icon">${I(a.state === 'pre' ? 'plane' : a.state === 'out' ? 'x' : 'check')}</span><div><strong>${esc(a.label)}</strong><span>${esc(a.detail)}</span></div></div>
        <div class="qv-opts">${optionsHtml(p)}</div>
        <div class="buy-row">
          <div class="stepper lg"><button type="button" data-q="-1" aria-label="Decrease quantity">${I('minus')}</button><output aria-live="polite">1</output><button type="button" data-q="1" aria-label="Increase quantity">${I('plus')}</button></div>
          <button class="btn btn-primary btn-lg" type="button" data-add ${a.canBuy ? '' : 'disabled'}>${I('bag')}${a.state === 'pre' ? 'Pre-order' : 'Add to cart'}</button>
        </div>
        <a class="link-arrow" href="${productUrl(p)}">View full details ${I('arrow-right')}</a>
      </div></div>`, {
      label: p.name,
      onMount(el) {
        bindOptions($('.qv-opts', el));
        el.addEventListener('click', (e) => {
          const qb = e.target.closest('[data-q]');
          if (qb) { qty = Math.max(1, Math.min(a.max || 99, qty + Number(qb.dataset.q))); $('output', el).textContent = qty; }
          if (e.target.closest('[data-add]')) {
            if (!validateOptions($('.qv-opts', el))) return;
            if (addToCart(p, qty, readOptions($('.qv-opts', el)), { silent: true })) { closeOverlays(); setTimeout(openCart, 260); }
          }
        });
      }
    });
    return m;
  }

  // ---------------------------------------------------------------
  // Cart drawer
  // ---------------------------------------------------------------
  function shipProgressHtml(subtotal) {
    const s = UI.ctx.settings;
    const t = Number(s.delivery?.freeThreshold || 0);
    if (!t) return '';
    if (subtotal >= t) return `<div class="ship-progress is-free">${I('truck')}<strong>You've unlocked free delivery.</strong></div>`;
    const pct = Math.max(4, Math.min(100, (subtotal / t) * 100));
    return `<div class="ship-progress">${I('truck')}You're <strong>${money(t - subtotal)}</strong> away from <strong>free delivery</strong><div class="ship-bar"><span style="width:${pct}%"></span></div></div>`;
  }

  function lineItemHtml(l, item, { compact = false } = {}) {
    const p = UI.ctx.byId.get(l.productId);
    const a = p ? DB.util.availability(p, UI.ctx.settings) : null;
    const max = a && a.state !== 'pre' ? a.max : 99;
    return `<div class="line-item" data-key="${esc(item.key)}">
      <a class="line-thumb" href="${p ? productUrl(p) : '#'}"><img src="${esc(thumb(l.image) || PLACEHOLDER)}" alt="" loading="lazy"></a>
      <div>
        <div class="line-top">
          <div><a class="line-name" href="${p ? productUrl(p) : '#'}">${esc(l.name)}</a>
            <div class="line-meta">${Object.keys(l.options || {}).length ? `<span>${optionText(l.options)}</span>` : ''}${l.preorder ? `<span style="color:var(--blue);font-weight:650">Pre-order · ${esc(p?.leadTime || UI.ctx.settings.preorderLeadTime)}</span>` : ''}${!compact ? `<span>${money(l.price)} each</span>` : ''}</div>
          </div>
          <div class="line-price">${money(l.price * l.qty)}</div>
        </div>
        ${l.issue ? `<div class="line-warning">${I('alert-triangle')}${esc(l.issue.message)}</div>` : ''}
        <div class="line-bottom">
          ${l.issue && l.issue.code !== 'INSUFFICIENT_STOCK' ? '<span></span>' : `<div class="stepper"><button type="button" data-qty="-1" aria-label="Decrease quantity">${I('minus')}</button><output>${l.qty}</output><button type="button" data-qty="1" aria-label="Increase quantity" ${l.qty >= max ? 'disabled' : ''}>${I('plus')}</button></div>`}
          <button class="line-remove" type="button" data-remove>${I('trash')}Remove</button>
        </div>
      </div>
    </div>`;
  }

  async function renderCartDrawer() {
    const drawer = $('#cart-drawer');
    if (!drawer) return;
    const items = Cart.items();
    const count = Cart.count();
    $('.drawer-head h3', drawer).innerHTML = `Your cart <small>${count} item${count === 1 ? '' : 's'}</small>`;
    const body = $('.drawer-body', drawer), foot = $('.drawer-foot', drawer);
    if (!items.length) {
      body.innerHTML = `<div class="empty"><div class="empty-art">${I('bag')}</div><h3>Your cart is empty</h3><p>Browse new arrivals or tell us what you want and we'll source it from China.</p><a class="btn btn-dark" href="shop.html">Start shopping</a><a class="btn btn-ghost" href="request.html">Request a product</a></div>`;
      foot.hidden = true;
      return;
    }
    const q = await DB.quote(items, { method: 'delivery', state: '' });
    const byKey = new Map(items.map((i) => [`${i.productId}#${DB.util.optionsKey(i.options)}`, i]));
    body.innerHTML = shipProgressHtml(q.subtotal) + `<div class="line-items">${q.lines.map((l) => lineItemHtml(l, byKey.get(`${l.productId}#${DB.util.optionsKey(l.options)}`) || { key: '' }, { compact: true })).join('')}</div>`;
    foot.hidden = false;
    foot.innerHTML = `<div class="totals">
        <div class="totals-row"><span class="muted">Subtotal</span><strong>${money(q.subtotal)}</strong></div>
        <div class="totals-row"><span class="muted">Delivery</span><span class="muted">${q.delivery.free ? '<span class="free">Free</span>' : 'Calculated at checkout'}</span></div>
      </div>
      <a class="btn btn-primary btn-lg btn-block" href="checkout.html">${I('lock')}Checkout · ${money(q.subtotal)}</a>
      <a class="btn btn-outline btn-block" href="cart.html">View cart</a>
      <div class="mini-note">${I('shield')}Pay by transfer or on delivery in Lagos</div>`;
  }

  function bindLineItems(root, rerender) {
    root.addEventListener('click', (e) => {
      const li = e.target.closest('.line-item');
      if (!li) return;
      const key = li.dataset.key;
      const it = Cart.items().find((i) => i.key === key);
      if (!it) return;
      if (e.target.closest('[data-qty]')) Cart.setQty(key, it.qty + Number(e.target.closest('[data-qty]').dataset.qty));
      else if (e.target.closest('[data-remove]')) Cart.remove(key);
      else return;
      rerender && rerender();
    });
  }

  // ---------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------
  function searchProducts(query, limit = 6) {
    const ctx = UI.ctx;
    const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const scored = [];
    for (const p of ctx.products) {
      const cat = ctx.catById.get(p.categoryId)?.name || '';
      const hay = { name: p.name.toLowerCase(), tags: (p.tags || []).join(' '), cat: cat.toLowerCase(), brand: (p.brand || '').toLowerCase(), sku: (p.sku || '').toLowerCase(), desc: (p.description || '').toLowerCase() };
      let score = 0, all = true;
      for (const t of terms) {
        let s = 0;
        if (hay.sku === t) s += 20;
        if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay.name)) s += 6;
        else if (hay.name.includes(t)) s += 4;
        if (hay.tags.includes(t)) s += 3;
        if (hay.cat.includes(t) || hay.brand.includes(t)) s += 2;
        if (hay.desc.includes(t)) s += 1;
        if (!s) { all = false; break; }
        score += s;
      }
      if (all) scored.push({ p, score: score + (p.featured ? 0.5 : 0) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit === Infinity ? undefined : limit).map((x) => x.p);
  }

  function highlight(text, query) {
    let out = esc(text);
    String(query).trim().split(/\s+/).filter((t) => t.length > 1).forEach((t) => {
      out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
    });
    return out;
  }

  function bindSearch(root) {
    const input = $('.search-input', root), panel = $('.search-panel', root), form = $('form', root);
    let active = -1;
    const recent = () => local.get('searches', []);
    const go = (q) => { if (!q.trim()) return; local.set('searches', [q.trim(), ...recent().filter((x) => x !== q.trim())].slice(0, 6)); location.href = `shop.html?q=${encodeURIComponent(q.trim())}`; };
    const render = () => {
      const q = input.value.trim();
      active = -1;
      if (!q) {
        const r = recent();
        const pops = ['Sneakers', 'Perfume', 'Air fryer', 'Party dress', 'Handbag', 'Solar'];
        panel.innerHTML = `${r.length ? `<h6>Recent searches</h6><div class="search-chips">${r.map((x) => `<a class="search-chip" href="shop.html?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>` : ''}
          <h6>Popular right now</h6><div class="search-chips">${pops.map((x) => `<a class="search-chip" href="shop.html?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>
          <h6>Categories</h6><div class="search-chips">${UI.ctx.categories.map((c) => `<a class="search-chip" href="shop.html?c=${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div>`;
      } else {
        const hits = searchProducts(q, 6);
        const total = searchProducts(q, Infinity).length;
        panel.innerHTML = hits.length
          ? `<h6>Products</h6>${hits.map((p) => `<a class="search-item" href="${productUrl(p)}"><img src="${esc(thumb(p.images?.[0]) || PLACEHOLDER)}" alt="" loading="lazy"><div><div class="si-name">${highlight(p.name, q)}</div><div class="si-meta">${esc(UI.ctx.catById.get(p.categoryId)?.name || '')}</div></div><span class="si-price">${money(p.price)}</span></a>`).join('')}
             <a class="search-all" href="shop.html?q=${encodeURIComponent(q)}"><span>See all ${total} result${total === 1 ? '' : 's'} for "${esc(q)}"</span>${I('arrow-right')}</a>`
          : `<div class="search-empty">No products match "<strong>${esc(q)}</strong>".<br><a class="link" href="request.html?q=${encodeURIComponent(q)}" style="margin-top:10px">Ask us to source it ${I('arrow-right')}</a></div>`;
      }
      panel.classList.add('is-open');
    };
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 70); });
    input.addEventListener('focus', render);
    input.addEventListener('keydown', (e) => {
      const items = $$('.search-item, .search-all', panel);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('is-active', i === active));
      } else if (e.key === 'Enter' && active >= 0 && items[active]) { e.preventDefault(); location.href = items[active].href; }
      else if (e.key === 'Escape') { panel.classList.remove('is-open'); input.blur(); }
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); go(input.value); });
    document.addEventListener('click', (e) => { if (!root.contains(e.target)) panel.classList.remove('is-open'); });
  }

  // ---------------------------------------------------------------
  // Chrome (header, nav, footer, overlays)
  // ---------------------------------------------------------------
  function searchHtml(cls) {
    const q = new URLSearchParams(location.search).get('q') || '';
    return `<div class="search ${cls}" role="search">
      <form class="search-form" action="shop.html" autocomplete="off">
        ${I('search')}
        <input class="search-input" type="search" name="q" value="${esc(q)}" placeholder="Search boots, perfume, air fryers…" aria-label="Search products">
        <button class="search-submit" type="submit" aria-label="Search">${I('arrow-right')}</button>
      </form>
      <div class="search-panel" role="listbox"></div>
    </div>`;
  }

  let megaOpen = false;
  function closeMega() { megaOpen = false; $('.mega')?.classList.remove('is-open'); $('.cat-all')?.setAttribute('aria-expanded', 'false'); }

  function mountChrome(page, minimal) {
    const ctx = UI.ctx, s = ctx.settings;
    const counts = new Map();
    ctx.products.forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1));
    const params = new URLSearchParams(location.search);
    const activeCat = page === 'shop' ? params.get('c') : null;
    const msgs = DB.util.announcementText(s);
    const header = $('#app-header');

    if (minimal) {
      header.innerHTML = `<header class="checkout-head"><div class="container">
        <a class="brand" href="index.html"><img src="images/brand/mark-96.png" alt="" width="44" height="44"><span class="brand-name"><b>Chi</b>-Best</span></a>
        <span class="secure-pill">${I('lock')}Secure checkout</span>
        <a class="btn btn-ghost btn-sm" href="cart.html">${I('arrow-left')}<span>Back to cart</span></a>
      </div></header>`;
    } else {
      header.innerHTML = `
      ${msgs.length ? `<div class="announce"><div class="container">
        <div class="announce-track" aria-live="polite">${msgs.map((m, i) => `<div class="announce-msg${i === 0 ? ' is-active' : ''}">${I('sparkles')}<span>${esc(m)}</span></div>`).join('')}</div>
        <div class="announce-links"><a href="track.html">${I('truck')}Track order</a><a href="help.html">${I('help')}Help</a><a href="${waLink()}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>WhatsApp us</a></div>
      </div></div>` : ''}
      <header class="masthead"><div class="container">
        <div class="masthead-row">
          <button class="icon-btn menu-btn" type="button" data-drawer="nav-drawer" aria-label="Open menu">${I('menu')}</button>
          <a class="brand" href="index.html" aria-label="${esc(s.storeName)} home"><img src="images/brand/mark-96.png" alt="" width="44" height="44"><span><span class="brand-name"><b>Chi</b>-Best</span><span class="brand-tag">China → Nigeria</span></span></a>
          ${searchHtml('search-desktop')}
          <div class="masthead-actions">
            <a class="action-link" href="track.html">${I('truck')}<span><small>Orders</small>Track</span></a>
            <a class="action-link" href="wishlist.html" style="position:relative">${I('heart')}<span><small>Saved</small>Wishlist</span><span class="count-badge" data-wish-count hidden>0</span></a>
            <button class="cart-btn" type="button" data-cart aria-label="Open cart">${I('bag')}<span class="cart-btn-label">Cart<span class="cart-btn-total" data-cart-total></span></span><span class="count-badge" data-cart-count hidden>0</span></button>
          </div>
        </div>
        ${searchHtml('search-mobile')}
      </div></header>
      <nav class="catnav" aria-label="Categories"><div class="container catnav-row">
        <button class="cat-all" type="button" aria-expanded="false" aria-controls="mega">${I('grid')}All categories${I('chevron-down')}</button>
        <div class="catnav-scroll">
          <a href="shop.html" class="mobile-only ${page === 'shop' && !activeCat && !params.get('q') ? 'is-active' : ''}">Shop all</a>
          <a href="shop.html?sort=newest">New in</a>
          ${ctx.categories.map((c) => `<a href="shop.html?c=${esc(c.id)}" class="${activeCat === c.id ? 'is-active' : ''}" title="${esc(c.name)}">${esc(c.name.split(' & ')[0])}</a>`).join('')}
          <a class="deals" href="shop.html?sale=1">Deals</a>
        </div>
        <a class="catnav-request" href="request.html">${I('sparkles')}Request a product</a>
      </div>
      <div class="mega" id="mega"><div class="container"><div class="mega-inner">
        ${ctx.categories.map((c) => `<a class="mega-card" href="shop.html?c=${esc(c.id)}"><img src="${esc(thumb(c.image) || PLACEHOLDER)}" alt="" loading="lazy"><div><strong>${esc(c.name)}</strong><span>${counts.get(c.id) || 0} products</span></div></a>`).join('')}
        <a class="mega-card mega-all" href="shop.html"><span class="mega-all-icon">${I('arrow-right')}</span><div><strong>Shop everything</strong><span>${ctx.products.length} products</span></div></a>
      </div></div></div></nav>`;
    }

    const footer = $('#app-footer');
    if (footer) {
      const social = [['instagram', 'fa-instagram'], ['facebook', 'fa-facebook-f'], ['tiktok', 'fa-tiktok']].filter(([k]) => /^https?:\/\//i.test(s[k] || ''));
      footer.innerHTML = `${minimal ? '' : `<section class="newsletter"><div class="container">
          <div><h3>Get first dibs on new arrivals</h3><p>New stock lands every week. Join our WhatsApp updates for drops, restocks and deals.</p></div>
          <form class="nl-form" data-newsletter><input class="input" type="tel" inputmode="tel" placeholder="Your WhatsApp number" aria-label="WhatsApp number" required><button class="btn btn-whatsapp" type="submit"><i class="fa-brands fa-whatsapp"></i>Join updates</button></form>
        </div></section>`}
        <footer class="footer"><div class="container">
          <div class="footer-top">
            <div>
              <a class="brand" href="index.html"><img src="images/brand/mark-96.png" alt="" width="44" height="44" style="background:#fff;border-radius:50%;padding:2px"><span class="brand-name"><b>Chi</b>-Best</span></a>
              <p class="footer-about">Quality products imported from China and delivered across Nigeria. Shop ready stock from Lagos, pre-order straight from our suppliers, or ask us to source anything you've seen online.</p>
              <div class="socials"><a href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>${social.map(([k, ic]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${k}"><i class="fa-brands ${ic}"></i></a>`).join('')}</div>
            </div>
            <div><h4>Shop</h4><ul class="footer-links">${ctx.categories.slice(0, 6).map((c) => `<li><a href="shop.html?c=${esc(c.id)}">${esc(c.name)}</a></li>`).join('')}<li><a href="shop.html?sale=1">Deals</a></li></ul></div>
            <div><h4>Help</h4><ul class="footer-links">
              <li><a href="track.html">Track your order</a></li><li><a href="help.html#delivery">Delivery &amp; fees</a></li><li><a href="help.html#preorders">How pre-orders work</a></li>
              <li><a href="help.html#returns">Returns &amp; refunds</a></li><li><a href="help.html#payments">Payment options</a></li><li><a href="help.html#faq">FAQs</a></li></ul></div>
            <div><h4>Contact</h4><ul class="footer-links">
              <li><a href="${waLink()}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>WhatsApp us</a></li>
              ${s.phone ? `<li><a href="tel:${esc(DB.util.digits(s.phone))}">${I('phone')}${esc(s.phone)}</a></li>` : ''}
              ${s.email ? `<li><a href="mailto:${esc(s.email)}">${I('mail')}${esc(s.email)}</a></li>` : ''}
              <li><a href="help.html#contact">${I('map-pin')}${esc(s.address)}</a></li>
              <li><a href="request.html">${I('sparkles')}Request a product</a></li></ul></div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} ${esc(s.storeName)}. All rights reserved. · <a href="help.html#privacy">Privacy</a> · <a href="help.html#terms">Terms</a></span>
            <div class="pay-methods"><span>${I('banknote')}Bank transfer</span><span>${I('wallet')}Pay on delivery</span><span><i class="fa-brands fa-whatsapp"></i>WhatsApp orders</span></div>
          </div>
        </div></footer>`;
    }

    // Overlays shared by every page
    const overlays = document.createElement('div');
    overlays.innerHTML = `
      <div class="scrim" id="scrim"></div>
      <aside class="drawer right" id="cart-drawer" aria-label="Shopping cart" aria-hidden="true">
        <div class="drawer-head"><h3>Your cart</h3><button class="icon-btn" type="button" data-close aria-label="Close cart">${I('x')}</button></div>
        <div class="drawer-body"></div><div class="drawer-foot" hidden></div>
      </aside>
      <aside class="drawer left" id="nav-drawer" aria-label="Menu" aria-hidden="true">
        <div class="drawer-head"><a class="brand" href="index.html"><img src="images/brand/mark-96.png" alt="" width="38" height="38"><span class="brand-name"><b>Chi</b>-Best</span></a><button class="icon-btn" type="button" data-close aria-label="Close menu">${I('x')}</button></div>
        <div class="drawer-body">
          <div class="mnav-section">
            <a class="mnav-link" href="shop.html">${I('grid')}Shop all<span class="chev">${I('chevron-right')}</span></a>
            <a class="mnav-link" href="shop.html?sort=newest">${I('sparkles')}New in<span class="chev">${I('chevron-right')}</span></a>
            <a class="mnav-link" href="shop.html?sale=1">${I('percent')}Deals<span class="chev">${I('chevron-right')}</span></a>
          </div>
          <div class="mnav-section"><div class="mnav-label">Categories</div>
            ${ctx.categories.map((c) => `<a class="mnav-link" href="shop.html?c=${esc(c.id)}"><img src="${esc(thumb(c.image) || PLACEHOLDER)}" alt="" loading="lazy">${esc(c.name)}<span class="chev">${I('chevron-right')}</span></a>`).join('')}
          </div>
          <div class="mnav-section"><div class="mnav-label">Help</div>
            <a class="mnav-link" href="request.html">${I('sparkles')}Request a product</a>
            <a class="mnav-link" href="track.html">${I('truck')}Track your order</a>
            <a class="mnav-link" href="help.html">${I('help')}Help &amp; delivery info</a>
            <a class="mnav-link" href="${waLink()}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" style="width:20px;text-align:center;font-size:19px;color:#1faa53"></i>Chat on WhatsApp</a>
          </div>
        </div>
      </aside>
      <div class="toasts" id="toasts" aria-live="polite"></div>
      ${minimal ? '' : `<nav class="bottom-nav" aria-label="Quick navigation">
        <a href="index.html" class="${page === 'home' ? 'is-active' : ''}">${I('home')}Home</a>
        <a href="shop.html" class="${page === 'shop' || page === 'product' ? 'is-active' : ''}">${I('grid')}Shop</a>
        <a href="track.html" class="${page === 'track' ? 'is-active' : ''}">${I('truck')}Track</a>
        <a href="wishlist.html" class="${page === 'wishlist' ? 'is-active' : ''}" style="position:relative">${I('heart')}Saved<span class="count-badge" data-wish-count hidden>0</span></a>
        <button type="button" data-cart class="${page === 'cart' ? 'is-active' : ''}" style="position:relative">${I('bag')}Cart<span class="count-badge" data-cart-count hidden>0</span></button>
      </nav>
      <a class="wa-float" href="${waLink('Hello Chi-Best! I have a question.')}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`}`;
    document.body.append(...overlays.children);

    // Behaviours
    $$('.search').forEach(bindSearch);
    bindLineItems($('#cart-drawer'), () => renderCartDrawer());
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-cart]')) { e.preventDefault(); openCart(); return; }
      const dr = t.closest('[data-drawer]');
      if (dr) { openDrawer(dr.dataset.drawer); return; }
      if (t.closest('[data-close]') || t.id === 'scrim') { closeOverlays(); return; }
      const wish = t.closest('[data-wish]');
      if (wish) {
        e.preventDefault();
        const id = wish.dataset.wish;
        const on = Wish.toggle(id);
        $$(`[data-wish="${CSS.escape(id)}"]`).forEach((b) => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
        const p = ctx.byId.get(id);
        toast({ title: on ? 'Saved to wishlist' : 'Removed from wishlist', sub: p?.name, image: on ? thumb(p?.images?.[0]) : '', action: on ? { label: 'View', href: 'wishlist.html' } : null, type: on ? 'success' : 'info' });
        return;
      }
      const quick = t.closest('[data-quick]');
      if (quick) {
        e.preventDefault();
        const p = ctx.byId.get(quick.dataset.quick);
        if (!p) return;
        const needs = (p.options || []).some((g) => g.values?.length > 1);
        if (needs) quickView(p);
        else {
          const opts = {};
          (p.options || []).forEach((g) => { if (g.values?.length === 1) opts[g.name] = g.values[0]; });
          addToCart(p, 1, opts);
        }
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });

    const catAll = $('.cat-all');
    if (catAll) {
      catAll.addEventListener('click', (e) => {
        e.stopPropagation();
        megaOpen = !megaOpen;
        $('.mega').classList.toggle('is-open', megaOpen);
        catAll.setAttribute('aria-expanded', megaOpen);
      });
      document.addEventListener('click', (e) => { if (megaOpen && !e.target.closest('.mega')) closeMega(); });
    }

    const nl = $('[data-newsletter]');
    if (nl) nl.addEventListener('submit', (e) => {
      e.preventDefault();
      const num = $('input', nl).value.trim();
      if (DB.util.digits(num).length < 10) { toast({ type: 'error', title: 'Enter a valid WhatsApp number' }); return; }
      window.open(waLink(`Hello Chi-Best! Please add me to your WhatsApp updates for new arrivals and deals. My number: ${num}`), '_blank', 'noopener');
      nl.reset();
      toast({ title: 'Almost done!', sub: 'Send the WhatsApp message to join our updates.' });
    });

    // Rotating announcements
    const msgEls = $$('.announce-msg');
    if (msgEls.length > 1) {
      let i = 0;
      setInterval(() => {
        const cur = msgEls[i];
        cur.classList.remove('is-active'); cur.classList.add('is-leaving');
        setTimeout(() => cur.classList.remove('is-leaving'), 600);
        i = (i + 1) % msgEls.length;
        msgEls[i].classList.add('is-active');
      }, 4200);
    }

    const mast = $('.masthead');
    if (mast) {
      const onScroll = () => mast.classList.toggle('is-scrolled', window.scrollY > 40);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    UI.refreshCart();
    UI.refreshWish();
  }

  function reveal(root = document) {
    const els = $$('.reveal:not(.is-in)', root);
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((el) => io.observe(el));
  }

  function bindRail(section) {
    const rail = $('.rail', section);
    const prev = $('[data-rail="-1"]', section), next = $('[data-rail="1"]', section);
    if (!rail || !prev) return;
    const update = () => {
      prev.disabled = rail.scrollLeft < 8;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
    };
    [prev, next].forEach((b) => b.addEventListener('click', () => rail.scrollBy({ left: Number(b.dataset.rail) * rail.clientWidth * 0.9, behavior: 'smooth' })));
    rail.addEventListener('scroll', update, { passive: true });
    update();
  }

  async function loadContext() {
    const [settings, categories, products] = await Promise.all([DB.settings.get(), DB.categories.list(), DB.products.list()]);
    const cats = categories.filter((c) => c.active !== false);
    UI.ctx = {
      settings, categories: cats, products,
      byId: new Map(products.map((p) => [p.id, p])),
      bySlug: new Map(products.map((p) => [p.slug, p])),
      catById: new Map(categories.map((c) => [c.id, c]))
    };
    return UI.ctx;
  }

  function fatal(err) {
    console.error(err);
    const main = $('#main') || document.body;
    main.innerHTML = `<div class="container"><div class="empty" style="min-height:60vh;justify-content:center"><div class="empty-art">${I('alert-triangle')}</div>
      <h3>We couldn't load the store</h3><p>${esc(err?.message || 'Please check your connection and try again.')}</p>
      <button class="btn btn-dark" onclick="location.reload()">${I('refresh')}Try again</button></div></div>`;
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  const UI = {
    ctx: null,
    I, $, $$, esc, money, thumb, productUrl, PLACEHOLDER, fmtDate, optionText, waLink,
    Cart, Wish, Recent, MyOrders,
    productCard, priceHtml, skeletonCards, optionsHtml, bindOptions, readOptions, validateOptions,
    addToCart, toast, modal, lightbox, openDrawer, closeOverlays, openCart, quickView,
    lineItemHtml, bindLineItems, shipProgressHtml, searchProducts, reveal, bindRail,

    async boot({ page = '', minimal = false } = {}) {
      try {
        await DB.ready();
        await loadContext();
      } catch (e) { fatal(e); throw e; }
      mountChrome(page, minimal);
      DB.on(async (topic) => {
        if (['products', 'settings', 'categories', 'inventory', 'all', 'orders'].includes(topic)) {
          await loadContext();
          UI.refreshCart();
          if ($('#cart-drawer.is-open')) renderCartDrawer();
        }
      });
      window.addEventListener('storage', (e) => {
        if (e.key === KEY + 'cart') { UI.refreshCart(); if ($('#cart-drawer.is-open')) renderCartDrawer(); }
        if (e.key === KEY + 'wishlist') UI.refreshWish();
      });
      return UI.ctx;
    },

    async refreshCart() {
      const count = Cart.count();
      $$('[data-cart-count]').forEach((el) => {
        const changed = el.textContent !== String(count);
        el.textContent = count > 99 ? '99+' : count;
        el.hidden = count === 0;
        if (changed && count) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      });
      if (!UI.ctx) return;
      const totalEls = $$('[data-cart-total]');
      if (totalEls.length) {
        const q = count ? await DB.quote(Cart.items(), { method: 'delivery' }) : { subtotal: 0 };
        totalEls.forEach((el) => { el.textContent = count ? ` · ${money(q.subtotal)}` : ''; });
      }
      document.dispatchEvent(new CustomEvent('cart:change'));
    },

    refreshWish() {
      const n = Wish.ids().filter((id) => !UI.ctx || UI.ctx.byId.has(id)).length;
      $$('[data-wish-count]').forEach((el) => { el.textContent = n; el.hidden = n === 0; });
    },

    copy(text, label = 'Copied') {
      (navigator.clipboard?.writeText(text) || Promise.reject()).then(
        () => toast({ title: label, sub: text, type: 'success' }),
        () => toast({ title: 'Copy failed', sub: 'Please copy it manually.', type: 'error' })
      );
    }
  };

  window.UI = UI;
})();
