// =============================================================
// CHI-BEST ADMIN — core (auth, routing, layout, shared UI)
// =============================================================
(function () {
  'use strict';

  const I = (n, c) => Icons.svg(n, c);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => DB.util.money(n);
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f1ec"/><path d="M38 40h24v20H38z" fill="none" stroke="#c9c5bc" stroke-width="2"/></svg>');

  const views = {};
  const NAV = [
    { group: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { group: 'Sales' },
    { id: 'orders', label: 'Orders', icon: 'receipt', count: 'pending' },
    { id: 'customers', label: 'Customers', icon: 'users' },
    { id: 'requests', label: 'Sourcing requests', icon: 'inbox', count: 'requests' },
    { group: 'Catalogue' },
    { id: 'products', label: 'Products', icon: 'tag' },
    { id: 'inventory', label: 'Inventory', icon: 'warehouse', count: 'stock' },
    { id: 'categories', label: 'Categories', icon: 'layers' },
    { group: 'Store' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  // ---------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------
  const fmt = {
    date: (iso) => (iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''),
    dateShort: (iso) => (iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''),
    time: (iso) => (iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' }) : ''),
    dateTime: (iso) => (iso ? `${fmt.date(iso)}, ${fmt.time(iso)}` : ''),
    relative(iso) {
      if (!iso) return '';
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
      return fmt.date(iso);
    },
    compact(n) {
      const v = Math.abs(n);
      const sign = n < 0 ? '-' : '';
      if (v >= 1e6) return `${sign}₦${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
      if (v >= 1e3) return `${sign}₦${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
      return `${sign}₦${Math.round(v)}`;
    },
    int: (n) => Math.round(Number(n) || 0).toLocaleString('en-NG'),
    pct: (n) => `${(Number(n) || 0).toFixed(Math.abs(n) < 10 ? 1 : 0).replace(/\.0$/, '')}%`
  };
  const thumb = (src) => (/images\/catalog\/.+-\d+\.jpg$/.test(src || '') ? src.replace(/\.jpg$/, '-sm.jpg') : src || PLACEHOLDER);

  // ---------------------------------------------------------------
  // Data cache
  // ---------------------------------------------------------------
  const cache = {};
  const loaders = {
    products: () => DB.products.list({ all: true }),
    categories: () => DB.categories.list(),
    orders: () => DB.orders.list(),
    movements: () => DB.inventory.movements(),
    requests: () => DB.requests.list(),
    settings: () => DB.settings.get()
  };
  async function load(...keys) {
    await Promise.all(keys.map(async (k) => { if (!(k in cache)) cache[k] = await loaders[k](); }));
    const out = {};
    keys.forEach((k) => { out[k] = cache[k]; });
    return out;
  }
  function invalidate(...keys) { (keys.length ? keys : Object.keys(cache)).forEach((k) => delete cache[k]); }

  // ---------------------------------------------------------------
  // Status helpers
  // ---------------------------------------------------------------
  const ORDER_TONE = { pending: 'amber', confirmed: 'blue', processing: 'blue', shipped: 'violet', out_for_delivery: 'violet', delivered: 'green', cancelled: 'gray' };
  const pill = {
    order: (s) => `<span class="pill ${ORDER_TONE[s] || 'gray'}"><span class="dot"></span>${esc(DB.const.ORDER_STATUSES.find((x) => x.id === s)?.admin || s)}</span>`,
    payment: (s) => `<span class="pill ${s === 'paid' ? 'green' : s === 'refunded' ? 'gray' : 'amber'}">${esc(DB.const.PAYMENT_STATUSES.find((x) => x.id === s)?.label || s)}</span>`,
    product: (s) => `<span class="pill ${s === 'active' ? 'green' : s === 'draft' ? 'amber' : 'gray'}">${s === 'active' ? 'Active' : s === 'draft' ? 'Draft' : 'Archived'}</span>`,
    request: (s) => `<span class="pill ${{ new: 'red', sourcing: 'blue', quoted: 'violet', accepted: 'green', completed: 'gray', declined: 'gray' }[s] || 'gray'}">${esc(DB.const.REQUEST_STATUSES.find((x) => x.id === s)?.label || s)}</span>`,
    movement(t) {
      const tone = { initial: 'gray', restock: 'green', return: 'blue', cancellation: 'blue', sale: 'ink', damage: 'red', adjustment: 'amber' }[t] || 'gray';
      return `<span class="pill ${tone}">${esc(DB.const.MOVEMENT_TYPES[t]?.label || t)}</span>`;
    },
    stock(p, settings) {
      const s = stockState(p, settings);
      return `<span class="pill ${{ in: 'green', low: 'amber', out: 'red', pre: 'blue', untracked: 'gray' }[s]}"><span class="dot"></span>${{ in: 'In stock', low: 'Low stock', out: 'Out of stock', pre: 'Pre-order', untracked: 'Not tracked' }[s]}</span>`;
    }
  };
  function stockState(p, settings) {
    if (p.trackInventory === false) return 'untracked';
    const low = p.lowStockThreshold ?? settings?.inventory?.defaultLowStock ?? 5;
    if (p.stock <= 0) return p.allowPreorder ? 'pre' : 'out';
    if (p.stock <= low) return 'low';
    return 'in';
  }

  // ---------------------------------------------------------------
  // Toasts, modal, confirm, drawer
  // ---------------------------------------------------------------
  function toast(title, { sub = '', type = 'success', duration = 3600 } = {}) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${I(type === 'error' ? 'alert' : 'check-circle')}<div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, duration);
  }

  let overlayCount = 0;
  function overlay(onClick) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.addEventListener('click', onClick);
    document.body.appendChild(o);
    overlayCount++;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => o.classList.add('show'));
    return () => { o.classList.remove('show'); setTimeout(() => o.remove(), 200); if (--overlayCount <= 0) { overlayCount = 0; document.body.style.overflow = ''; } };
  }

  function modal({ title, sub = '', body = '', foot = '', size = '', onMount, onClose } = {}) {
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="icon-btn" type="button" data-x aria-label="Close">${I('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    let closeOverlay;
    const close = () => {
      wrap.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => wrap.remove(), 200);
      closeOverlay();
      onClose && onClose();
      prevFocus?.focus?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    closeOverlay = overlay(close);
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => { wrap.classList.add('show'); ($('[autofocus]', wrap) || $('input,select,textarea,button.btn', wrap))?.focus(); });
    const api = { el: wrap, close, $: (s) => $(s, wrap) };
    onMount && onMount(api);
    return api;
  }

  function confirmDialog({ title, text = '', confirm = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, body: `<p class="muted" style="font-size:14px">${text}</p>`,
        foot: `<button class="btn btn-outline" type="button" data-no>Cancel</button><button class="btn ${danger ? 'btn-danger solid' : 'btn-primary'}" type="button" data-yes>${esc(confirm)}</button>`,
        onClose: () => { if (!done) resolve(false); },
        onMount: (api) => {
          api.$('[data-no]').addEventListener('click', () => api.close());
          api.$('[data-yes]').addEventListener('click', () => { done = true; resolve(true); api.close(); });
          setTimeout(() => api.$('[data-yes]').focus(), 50);
        }
      });
      return m;
    });
  }

  let activeDrawer = null;
  function drawer({ title, sub = '', body = '', foot = '', actions = '', width = 720, onMount, onClose } = {}) {
    if (activeDrawer) activeDrawer.close(true);
    const d = document.createElement('aside');
    d.className = 'drawer';
    d.style.width = `min(${width}px, 100%)`;
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', title);
    d.innerHTML = `<div class="drawer-head"><div style="min-width:0"><h3 class="ellipsis">${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}<button class="icon-btn" type="button" data-x aria-label="Close">${I('x')}</button></div></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
    let closed = false;
    const closeOverlay = overlay(() => api.close());
    const onKey = (e) => { if (e.key === 'Escape' && !$('.modal-wrap')) api.close(); };
    const api = {
      el: d, $: (s) => $(s, d),
      close(silent) {
        if (closed) return;
        closed = true;
        d.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => d.remove(), 300);
        closeOverlay();
        if (activeDrawer === api) activeDrawer = null;
        onClose && onClose(silent);
      },
      setBody(html) { $('.drawer-body', d).innerHTML = html; },
      setHead(t, s) { $('.drawer-head h3', d).innerHTML = t; const el = $('.drawer-head .sub', d); if (el) el.innerHTML = s; }
    };
    document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) api.close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => d.classList.add('show'));
    activeDrawer = api;
    onMount && onMount(api);
    return api;
  }

  // ---------------------------------------------------------------
  // Export helpers
  // ---------------------------------------------------------------
  function download(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(filename, header, rows) {
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      // Neutralise spreadsheet formulas in text that came from customers (CSV injection).
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    download(filename, '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\n'), 'text/csv;charset=utf-8');
    toast('Export ready', { sub: filename });
  }
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------
  // Routing & layout
  // ---------------------------------------------------------------
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    return { view: parts[0] || 'dashboard', id: parts[1] || null, sub: parts[2] || null, query: new URLSearchParams(qs || ''), raw };
  }
  function go(hash, { replace = false } = {}) {
    const target = hash.startsWith('#') ? hash : `#/${hash}`;
    if (replace) { history.replaceState(null, '', target); render(); } else location.hash = target;
  }
  function setQuery(patch) {
    const r = parseRoute();
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? r.query.delete(k) : r.query.set(k, v)));
    const qs = r.query.toString();
    history.replaceState(null, '', `#/${r.raw.split('?')[0]}${qs ? `?${qs}` : ''}`);
  }

  function setTitle(title, crumbs = '') {
    $('[data-title]').innerHTML = crumbs ? `<span class="crumb">${crumbs}</span>` : esc(title);
    if (crumbs) $('[data-title]').innerHTML = `<span class="crumb">${crumbs}${I('chevron-right')}<span style="color:var(--ink)">${esc(title)}</span></span>`;
    document.title = `${title} · Chi-Best Admin`;
  }

  let renderToken = 0;
  async function render() {
    const route = parseRoute();
    if (Admin.state.dirty && Admin.state.dirtyRoute && Admin.state.dirtyRoute !== route.raw) {
      const ok = await confirmDialog({ title: 'Discard unsaved changes?', text: 'You have changes that have not been saved.', confirm: 'Discard changes', danger: true });
      if (!ok) { history.replaceState(null, '', `#/${Admin.state.dirtyRoute}`); return; }
      Admin.state.dirty = false;
    }
    Admin.state.dirtyRoute = null;
    Admin.state.dirty = false;
    const view = views[route.view] || views.dashboard;
    $$('.nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.view === (views[route.view] ? route.view : 'dashboard')));
    $('.shell').classList.remove('nav-open');
    if (activeDrawer && !view.keepsDrawer) activeDrawer.close(true);
    const token = ++renderToken;
    // A fresh element per render so listeners from the previous view never leak or double-fire.
    const old = $('[data-content]');
    const content = old.cloneNode(false);
    content.innerHTML = old.innerHTML;
    old.replaceWith(content);
    try {
      await view.render(content, route, () => token === renderToken);
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div class="card"><div class="empty"><div class="e-icon">${I('alert-triangle')}</div><h4>Something went wrong</h4><p>${esc(e.message)}</p><button class="btn btn-outline" onclick="location.reload()">Reload</button></div></div>`;
    }
    refreshCounts();
  }

  async function refreshCounts() {
    try {
      const { orders, requests, products, settings } = await load('orders', 'requests', 'products', 'settings');
      const counts = {
        pending: orders.filter((o) => o.status === 'pending').length,
        requests: requests.filter((r) => r.status === 'new').length,
        stock: products.filter((p) => p.status === 'active' && ['low', 'out'].includes(stockState(p, settings))).length
      };
      $$('.nav [data-count]').forEach((el) => {
        const n = counts[el.dataset.count];
        el.textContent = n;
        el.hidden = !n;
        el.classList.toggle('muted', el.dataset.count === 'stock');
      });
      Admin.state.lastOrderCount = Admin.state.lastOrderCount ?? orders.length;
      if (orders.length > Admin.state.lastOrderCount) {
        const n = orders.length - Admin.state.lastOrderCount;
        toast(`${n} new order${n === 1 ? '' : 's'} received`, { sub: `${orders[0].number} · ${money(orders[0].total)}` });
      }
      Admin.state.lastOrderCount = orders.length;
    } catch (e) { /* counts are best-effort */ }
  }

  function shell(user) {
    const initials = (user?.name || 'A').replace(/@.*/, '').split(/[\s._-]+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
    $('#admin').innerHTML = `<div class="shell">
      <aside class="side" aria-label="Admin navigation">
        <div class="side-brand"><img src="images/brand/mark-96.png" alt=""><div><strong><b>Chi</b>-Best</strong><span>Store admin</span></div></div>
        <nav class="nav">${NAV.map((n) => n.group ? `<div class="side-label">${n.group}</div>` : `<a href="#/${n.id}" data-view="${n.id}">${I(n.icon)}${n.label}${n.count ? `<span class="count" data-count="${n.count}" hidden>0</span>` : ''}</a>`).join('')}</nav>
        <div class="side-foot">
          <a href="index.html" target="_blank" rel="noopener">${I('external')}View store</a>
          <div class="side-user"><span class="avatar">${esc(initials)}</span><div style="min-width:0"><strong class="ellipsis">${esc(user?.name || 'Store admin')}</strong><span>${DB.isDemo ? 'Demo mode' : 'Administrator'}</span></div></div>
          <button type="button" data-logout>${I('logout')}Sign out</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" data-menu aria-label="Open navigation">${I('menu')}</button>
          <h1 data-title></h1>
          <div class="topbar-right">
            ${DB.isDemo ? `<a class="demo-pill hide-sm" href="#/settings" title="Data is saved in this browser only. Connect Supabase to go live.">${'<span class="dot"></span>'}Demo mode</a>` : `<span class="live-pill hide-sm"><span class="dot"></span>Live</span>`}
            <a class="btn btn-outline btn-sm hide-sm" href="#/orders">${I('receipt')}Orders</a>
            <a class="btn btn-primary btn-sm" href="#/products/new">${I('plus')}<span>Add product</span></a>
          </div>
        </header>
        <main class="content" data-content></main>
      </div>
    </div>
    <div class="toasts" id="toasts" aria-live="polite"></div>`;
    $('[data-menu]').addEventListener('click', () => $('.shell').classList.toggle('nav-open'));
    $('.shell').addEventListener('click', (e) => { if (e.target === $('.shell')) $('.shell').classList.remove('nav-open'); });
    $('[data-logout]').addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Sign out?', text: 'You will need to sign in again to manage the store.', confirm: 'Sign out' }))) return;
      await DB.auth.signOut();
      location.hash = '';
      location.reload();
    });
  }

  function loginScreen() {
    const passcode = DB.auth.usesPasscode;
    $('#admin').innerHTML = `<div class="login"><form class="login-card" data-login novalidate>
      <div class="login-brand"><img src="images/brand/mark-96.png" alt=""><div><strong><b>Chi</b>-Best</strong><span>Store admin</span></div></div>
      <h1>Welcome back</h1><p>Sign in to manage products, inventory and orders.</p>
      <div class="stack">
        <div class="login-error" data-error role="alert"></div>
        ${passcode ? `<div class="field"><label for="l-pass">Admin passcode</label><input class="input" id="l-pass" type="password" name="passcode" autocomplete="current-password" autofocus required style="height:46px"></div>`
        : `<div class="field"><label for="l-email">Email</label><input class="input" id="l-email" type="email" name="email" autocomplete="username" autofocus required style="height:46px"></div>
           <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" type="password" name="password" autocomplete="current-password" required style="height:46px"></div>`}
        <button class="btn btn-primary btn-lg btn-block" type="submit">${I('lock')}Sign in</button>
      </div>
      ${passcode ? `<div class="login-hint">${I('info')}<div><strong>Demo mode.</strong> Data is stored in this browser only. Default passcode: <code>${esc(window.CHIBEST_CONFIG?.demoPasscode || 'chibest-admin')}</code>. Change it in Settings, and connect Supabase before going live.</div></div>` : ''}
    </form></div>`;
    const form = $('[data-login]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', form);
      btn.classList.add('is-loading');
      try {
        const user = await DB.auth.signIn(Object.fromEntries(new FormData(form)));
        Admin.state.user = user;
        boot(user);
      } catch (err) {
        btn.classList.remove('is-loading');
        const box = $('[data-error]', form);
        box.textContent = err.message;
        box.classList.add('show');
        $('input[type="password"]', form).select();
      }
    });
  }

  // Clear a field's error as soon as the user edits it.
  document.addEventListener('input', (e) => { e.target.closest?.('.field.has-error')?.classList.remove('has-error'); });

  let liveTimer;
  function boot(user) {
    shell(user);
    window.addEventListener('hashchange', render);
    window.addEventListener('beforeunload', (e) => { if (Admin.state.dirty) { e.preventDefault(); e.returnValue = ''; } });
    DB.on((topic) => {
      const map = { products: ['products'], inventory: ['products', 'movements'], orders: ['orders', 'products', 'movements'], requests: ['requests'], categories: ['categories'], settings: ['settings'], all: [] };
      invalidate(...(map[topic] || []));
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        const view = views[parseRoute().view];
        if (view?.live && !Admin.state.dirty && !$('.modal-wrap') && !activeDrawer) render();
        else refreshCounts();
      }, 250);
    });
    if (!DB.isDemo) setInterval(() => { invalidate('orders', 'requests'); refreshCounts(); }, 60000);
    render();
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  const Admin = {
    I, $, $$, esc, money, fmt, thumb, PLACEHOLDER, pill, stockState,
    views, state: { dirty: false },
    view(name, def) { views[name] = def; },
    load, invalidate, toast, modal, confirm: confirmDialog, drawer, csv, download, today,
    go, setQuery, setTitle, parseRoute, refreshCounts, render,
    get activeDrawer() { return activeDrawer; },
    markDirty(on = true) { Admin.state.dirty = on; Admin.state.dirtyRoute = on ? parseRoute().raw : null; },
    whatsapp(phone, text) {
      let d = DB.util.normPhone(phone);
      if (d.length === 10) d = '234' + d;
      return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    },
    storeUrl(path) { return new URL(path, location.href).href; },
    /** Only allow web links and inline images; anything else (e.g. javascript:) becomes empty. */
    safeUrl(u, { image = false } = {}) {
      const s = String(u || '').trim();
      if (/^https?:\/\//i.test(s)) return s;
      if (image && (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s) || /^images\//.test(s))) return s;
      return '';
    },
    fieldErrors(root, errors = {}) {
      $$('.field[data-f]', root).forEach((f) => {
        const msg = errors[f.dataset.f];
        f.classList.toggle('has-error', !!msg);
        let el = $('.field-error', f);
        if (!el) { el = document.createElement('span'); el.className = 'field-error'; f.appendChild(el); }
        el.textContent = msg || '';
      });
      $('.field.has-error', root)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    async start() {
      try { await DB.ready(); } catch (e) {
        $('#admin').innerHTML = `<div class="login"><div class="login-card"><h1>Can't reach the database</h1><p>${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div></div>`;
        return;
      }
      const user = await DB.auth.current().catch(() => null);
      if (user) { Admin.state.user = user; boot(user); } else loginScreen();
    }
  };

  window.Admin = Admin;
})();
