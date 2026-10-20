// =============================================================
// CHI-BEST DATA LAYER
// -------------------------------------------------------------
// One API for the storefront and the admin dashboard:
//
//   DB.settings / DB.categories / DB.products / DB.inventory
//   DB.orders / DB.requests / DB.customers / DB.auth / DB.media
//
// Two backends sit behind it:
//   - "local":    browser storage (demo mode, no setup needed)
//   - "supabase": live Postgres database (see database/schema.sql)
//
// Inventory rule: stock only ever changes through a recorded
// movement (opening stock, restock, sale, cancellation, return,
// damage, stock count), so every unit can be traced.
// =============================================================
(function () {
  'use strict';

  const CFG = window.CHIBEST_CONFIG || {};
  const NS = 'chibest.v2.';
  const listeners = new Set();

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------
  const ORDER_STATUSES = [
    { id: 'pending', label: 'Order placed', admin: 'Pending', icon: 'receipt', desc: 'We have received your order and will confirm it shortly.' },
    { id: 'confirmed', label: 'Confirmed', admin: 'Confirmed', icon: 'check', desc: 'Your order is confirmed and being prepared.' },
    { id: 'processing', label: 'Processing', admin: 'Processing', icon: 'package', desc: 'Your items are being sourced, checked and packed.' },
    { id: 'shipped', label: 'Shipped', admin: 'Shipped', icon: 'plane', desc: 'Your order is on its way.' },
    { id: 'out_for_delivery', label: 'Out for delivery', admin: 'Out for delivery', icon: 'truck', desc: 'Our rider is on the way to you.' },
    { id: 'delivered', label: 'Delivered', admin: 'Delivered', icon: 'home', desc: 'Your order has been delivered. Enjoy!' },
    { id: 'cancelled', label: 'Cancelled', admin: 'Cancelled', icon: 'x', desc: 'This order was cancelled.' }
  ];
  const PAYMENT_STATUSES = [
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'paid', label: 'Paid' },
    { id: 'refunded', label: 'Refunded' }
  ];
  const PAYMENT_METHODS = {
    bank_transfer: { label: 'Bank transfer', short: 'Transfer' },
    pay_on_delivery: { label: 'Pay on delivery', short: 'On delivery' },
    whatsapp: { label: 'Confirm on WhatsApp', short: 'WhatsApp' }
  };
  const MOVEMENT_TYPES = {
    initial: { label: 'Opening stock', sign: 1 },
    restock: { label: 'Stock received', sign: 1 },
    return: { label: 'Customer return', sign: 1 },
    cancellation: { label: 'Order cancelled', sign: 1 },
    sale: { label: 'Sale', sign: -1 },
    damage: { label: 'Damaged / lost', sign: -1 },
    adjustment: { label: 'Stock count', sign: 0 }
  };
  const REQUEST_STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'sourcing', label: 'Sourcing' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'declined', label: 'Declined' }
  ];
  const NG_STATES = ['Lagos', 'Abia', 'Abuja (FCT)', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
    'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];

  class StoreError extends Error {
    constructor(message, code, details) { super(message); this.code = code || 'ERROR'; this.details = details; }
  }

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------
  const now = () => new Date().toISOString();
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const rand = (n, alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789') =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const uid = (p) => `${p}-${Date.now().toString(36)}${rand(5, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
  const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
  const toInt = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const toNum = (v, d = null) => { if (v === '' || v == null) return d; const n = Number(v); return Number.isFinite(n) ? n : d; };

  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
  }
  function digits(p) { return String(p || '').replace(/\D/g, ''); }
  function normPhone(p) {
    let d = digits(p);
    if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
    return d;
  }
  function phoneMatch(a, b) {
    const x = digits(a).slice(-10), y = digits(b).slice(-10);
    return x.length === 10 && x === y;
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function deepMerge(base, patch) {
    const out = clone(base) || {};
    if (!isObj(patch)) return out;
    for (const k of Object.keys(patch)) {
      out[k] = isObj(patch[k]) && isObj(out[k]) ? deepMerge(out[k], patch[k]) : clone(patch[k]);
    }
    return out;
  }
  function money(n) {
    return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
  }
  function optionsKey(opts) {
    const o = opts || {};
    return Object.keys(o).sort().map((k) => `${k}:${o[k]}`).join('|');
  }

  function loadScript(src) {
    if (src === 'js/catalog.js' && window.SEED_CATALOG) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new StoreError(`Could not load ${src}.`, 'NETWORK'));
      document.head.appendChild(s);
    });
  }

  function emit(topic) { listeners.forEach((fn) => { try { fn(topic); } catch (e) { console.error(e); } }); }

  // ---------------------------------------------------------------
  // Settings / pricing helpers (shared by both backends)
  // ---------------------------------------------------------------
  function mergeSettings(stored) { return deepMerge(CFG.defaults || {}, stored || {}); }

  function announcementText(settings) {
    const map = {
      freeThreshold: money(settings.delivery?.freeThreshold || 0),
      preorderLeadTime: settings.preorderLeadTime || '',
      lagosFee: money(settings.delivery?.lagosFee || 0),
      returnsDays: settings.returnsDays
    };
    return (settings.announcements || [])
      .filter((t) => t && !(t.includes('{freeThreshold}') && !(settings.delivery?.freeThreshold > 0)))
      .map((t) => t.replace(/\{(\w+)\}/g, (_, k) => (map[k] != null ? map[k] : '')));
  }

  function deliveryQuote(settings, delivery, subtotal) {
    const d = settings.delivery || {};
    const method = delivery?.method || 'delivery';
    if (method === 'pickup') return { method, fee: 0, free: false, zone: 'Pickup', eta: 'Ready for pickup once confirmed' };
    const state = delivery?.state || '';
    const lagos = state === 'Lagos';
    const known = !!state;
    const freeOn = toNum(d.freeThreshold, 0) > 0 && subtotal >= toNum(d.freeThreshold, 0);
    const fee = freeOn ? 0 : (lagos || !known ? toNum(d.lagosFee, 0) : toNum(d.otherFee, 0));
    return {
      method, fee, free: freeOn, known,
      zone: known ? (lagos ? 'Lagos' : 'Outside Lagos') : '',
      eta: lagos || !known ? d.lagosTime : d.otherTime
    };
  }

  function availability(p, settings) {
    const lead = p.leadTime || settings?.preorderLeadTime || '14-21 days';
    const tracked = p.trackInventory !== false;
    const stock = toInt(p.stock);
    const low = toInt(p.lowStockThreshold, settings?.inventory?.defaultLowStock ?? 5);
    if (p.status && p.status !== 'active') return { state: 'out', label: 'Unavailable', detail: 'This item is not currently for sale.', canBuy: false, max: 0 };
    if (!tracked) return { state: 'in', label: 'In stock', detail: 'Ready to ship', canBuy: true, max: 99 };
    if (stock > 0 && stock <= low) return { state: 'low', label: `Only ${stock} left`, detail: 'In stock in Lagos. Order soon to avoid missing out.', canBuy: true, max: stock };
    if (stock > 0) return { state: 'in', label: 'In stock', detail: 'Ready to ship from our Lagos store.', canBuy: true, max: Math.min(stock, 99) };
    if (p.allowPreorder) return { state: 'pre', label: 'Pre-order', detail: `Ships from China. Delivered in about ${lead}.`, canBuy: true, max: 99, lead };
    return { state: 'out', label: 'Sold out', detail: 'Message us on WhatsApp to be notified when it is back.', canBuy: false, max: 0 };
  }

  /**
   * Price a set of cart lines against current product data.
   * Strict mode throws on the first problem (used when placing an order);
   * lenient mode annotates each line with an `issue` (used by cart/checkout UI).
   */
  function computeQuote(products, settings, items, delivery, { lenient = false } = {}) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const merged = new Map();
    for (const it of items || []) {
      const key = `${it.productId}#${optionsKey(it.options)}`;
      const prev = merged.get(key);
      merged.set(key, { productId: it.productId, options: it.options || {}, qty: (prev ? prev.qty : 0) + toInt(it.qty, 1) });
    }
    const lines = [];
    const fail = (line, code, message) => {
      if (!lenient) throw new StoreError(message, code, { productId: line.productId });
      line.issue = { code, message };
    };
    for (const it of merged.values()) {
      const p = byId.get(it.productId);
      const line = {
        productId: it.productId, options: it.options, qty: Math.max(1, Math.min(99, it.qty)),
        sku: p?.sku || '', name: p?.name || 'Unavailable item', image: p?.images?.[0] || '',
        slug: p?.slug || '', price: toNum(p?.price, 0), unitCost: toNum(p?.costPrice, 0),
        preorder: false, fromStock: false, lineTotal: 0
      };
      if (!p || p.status !== 'active') {
        fail(line, 'UNAVAILABLE', `${line.name} is no longer available.`);
        lines.push(line); continue;
      }
      for (const g of p.options || []) {
        if (!g.values?.length) continue;
        const v = line.options[g.name];
        if (!v || !g.values.includes(v)) { fail(line, 'OPTION_REQUIRED', `Please choose a ${g.name.toLowerCase()} for ${p.name}.`); break; }
      }
      if (!line.issue) {
        const tracked = p.trackInventory !== false;
        const stock = toInt(p.stock);
        if (!tracked) line.fromStock = false;
        else if (stock >= line.qty) line.fromStock = true;
        else if (stock === 0 && p.allowPreorder) line.preorder = true;
        else if (stock > 0) fail(line, 'INSUFFICIENT_STOCK', `Only ${stock} of ${p.name} left in stock.`);
        else fail(line, 'SOLD_OUT', `${p.name} is sold out.`);
        if (line.issue && line.issue.code === 'INSUFFICIENT_STOCK') line.available = stock;
      }
      line.lineTotal = line.price * line.qty;
      lines.push(line);
    }
    const valid = lines.filter((l) => !l.issue);
    const subtotal = valid.reduce((s, l) => s + l.lineTotal, 0);
    const dq = deliveryQuote(settings, delivery, subtotal);
    return {
      lines, subtotal, delivery: dq, deliveryFee: valid.length ? dq.fee : 0,
      total: subtotal + (valid.length ? dq.fee : 0),
      count: valid.reduce((s, l) => s + l.qty, 0),
      hasPreorder: valid.some((l) => l.preorder),
      hasIssues: lines.some((l) => l.issue)
    };
  }

  function validateOrderPayload(payload, settings) {
    const c = payload.customer || {};
    const d = payload.delivery || {};
    const errors = {};
    if (!String(c.name || '').trim() || String(c.name).trim().length < 2) errors.name = 'Enter your full name.';
    if (digits(c.phone).length < 10) errors.phone = 'Enter a valid phone number.';
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) errors.email = 'Enter a valid email address.';
    if (d.method !== 'pickup') {
      if (!d.state) errors.state = 'Choose your state.';
      if (!String(d.city || '').trim()) errors.city = 'Enter your city or area.';
      if (String(d.address || '').trim().length < 5) errors.address = 'Enter your street address.';
    } else if (!settings.delivery?.pickupEnabled) errors.method = 'Pickup is not available.';
    const pm = payload.paymentMethod;
    if (!PAYMENT_METHODS[pm]) errors.payment = 'Choose a payment method.';
    if (pm === 'pay_on_delivery') {
      if (!settings.payments?.payOnDelivery) errors.payment = 'Pay on delivery is not available.';
      else if (settings.payments?.payOnDeliveryLagosOnly && d.method !== 'pickup' && d.state !== 'Lagos') errors.payment = 'Pay on delivery is only available in Lagos.';
    }
    if (pm === 'bank_transfer' && settings.payments?.bankTransfer === false) errors.payment = 'Bank transfer is not available.';
    if (!payload.items?.length) errors.items = 'Your cart is empty.';
    if (Object.keys(errors).length) throw new StoreError('Please check the highlighted fields.', 'VALIDATION', errors);
  }

  function sanitizeProduct(input) {
    const out = {};
    const str = (k) => { if (input[k] !== undefined) out[k] = String(input[k] ?? '').trim(); };
    ['name', 'description', 'categoryId', 'brand', 'sku', 'slug', 'badge', 'leadTime', 'status'].forEach(str);
    if (input.price !== undefined) out.price = Math.max(0, toNum(input.price, 0));
    if (input.compareAtPrice !== undefined) { const v = toNum(input.compareAtPrice, null); out.compareAtPrice = v && v > 0 ? v : null; }
    if (input.costPrice !== undefined) out.costPrice = Math.max(0, toNum(input.costPrice, 0));
    if (input.lowStockThreshold !== undefined) out.lowStockThreshold = Math.max(0, toInt(input.lowStockThreshold, 5));
    ['trackInventory', 'allowPreorder', 'featured'].forEach((k) => { if (input[k] !== undefined) out[k] = !!input[k]; });
    if (input.images !== undefined) out.images = (input.images || []).filter(Boolean).map(String);
    if (input.tags !== undefined) out.tags = (Array.isArray(input.tags) ? input.tags : String(input.tags).split(','))
      .map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    if (input.options !== undefined) out.options = (input.options || [])
      .map((g) => ({ name: String(g.name || '').trim(), values: (g.values || []).map((v) => String(v).trim()).filter(Boolean) }))
      .filter((g) => g.name && g.values.length);
    if (out.sku !== undefined) out.sku = out.sku.toUpperCase().replace(/\s+/g, '-');
    if (out.status !== undefined && !['active', 'draft', 'archived'].includes(out.status)) out.status = 'draft';
    return out;
  }

  function validateProduct(p, all, categories) {
    const errors = {};
    if (!p.name || p.name.length < 2) errors.name = 'Product name is required.';
    if (!(p.price > 0)) errors.price = 'Enter a selling price.';
    if (p.compareAtPrice && p.compareAtPrice <= p.price) errors.compareAtPrice = 'Compare-at price should be higher than the selling price.';
    if (!categories.some((c) => c.id === p.categoryId)) errors.categoryId = 'Choose a category.';
    if (p.sku && all.some((x) => x.id !== p.id && String(x.sku).toUpperCase() === p.sku)) errors.sku = 'Another product already uses this SKU.';
    if (Object.keys(errors).length) throw new StoreError('Please fix the highlighted fields.', 'VALIDATION', errors);
  }

  function uniqueSlug(base, all, selfId) {
    let slug = slugify(base), n = 2;
    while (all.some((x) => x.id !== selfId && x.slug === slug)) slug = `${slugify(base)}-${n++}`;
    return slug;
  }
  function nextSku(all, categories, categoryId) {
    const code = (categories.find((c) => c.id === categoryId)?.code || 'GEN').toUpperCase();
    const prefix = `CB-${code}-`;
    const max = all.reduce((m, p) => {
      const s = String(p.sku || '');
      return s.startsWith(prefix) ? Math.max(m, toInt(s.slice(prefix.length))) : m;
    }, 0);
    return prefix + String(max + 1).padStart(3, '0');
  }
  const orderNumber = (d = new Date()) =>
    `CB${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${rand(4)}`;

  function deriveCustomers(orders) {
    const map = new Map();
    for (const o of orders) {
      const key = digits(o.customer?.phone).slice(-10) || o.id;
      const c = map.get(key) || { key, name: '', phone: '', email: '', state: '', city: '', orders: 0, spent: 0, firstOrderAt: o.createdAt, lastOrderAt: o.createdAt, orderIds: [] };
      c.orders += 1;
      c.orderIds.push(o.id);
      if (o.status !== 'cancelled') c.spent += o.total;
      if (o.createdAt >= c.lastOrderAt || !c.name) {
        c.name = o.customer?.name || c.name; c.phone = o.customer?.phone || c.phone; c.email = o.customer?.email || c.email;
        c.state = o.delivery?.state || c.state; c.city = o.delivery?.city || c.city;
      }
      if (o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
      if (o.createdAt < c.firstOrderAt) c.firstOrderAt = o.createdAt;
      map.set(key, c);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent);
  }

  function publicOrder(o) {
    // What a customer may see when tracking: no costs, no internal notes.
    const x = clone(o);
    x.items = (x.items || []).map(({ unitCost, ...rest }) => rest);
    x.events = (x.events || []).filter((e) => e.type !== 'internal').map(({ actor, ...rest }) => rest);
    return x;
  }

  // ---------------------------------------------------------------
  // Image helper (used by admin uploads and sourcing requests)
  // ---------------------------------------------------------------
  function compressImage(file, { max = 1000, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new StoreError('Please choose an image file.', 'BAD_FILE'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new StoreError('Could not process this image.', 'BAD_FILE'));
          const reader = new FileReader();
          reader.onload = () => resolve({ blob, dataUrl: reader.result, width: w, height: h });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new StoreError('Could not read this image.', 'BAD_FILE')); };
      img.src = url;
    });
  }

  // =================================================================
  // LOCAL BACKEND (browser storage)
  // =================================================================
  function createLocalBackend() {
    const LS = {
      get(key, fallback) {
        try { const v = localStorage.getItem(NS + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
      },
      set(key, value) {
        try { localStorage.setItem(NS + key, JSON.stringify(value)); }
        catch (e) {
          if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
            throw new StoreError('Browser storage is full. Remove some uploaded images or connect Supabase for unlimited storage.', 'QUOTA');
          }
          throw e;
        }
      }
    };

    function seed(force) {
      const meta = LS.get('meta', null);
      if (meta?.seeded && !force) return;
      const cat = window.SEED_CATALOG || { categories: [], products: [] };
      const products = clone(cat.products);
      const movements = products.filter((p) => p.stock > 0).map((p) => ({
        id: uid('mv'), productId: p.id, sku: p.sku, productName: p.name, type: 'initial', change: p.stock,
        balanceAfter: p.stock, unitCost: p.costPrice || 0, reference: 'Opening stock', note: '', actor: 'system', at: p.createdAt
      }));
      LS.set('settings', {});
      LS.set('categories', clone(cat.categories));
      LS.set('products', products);
      LS.set('movements', movements);
      LS.set('orders', []);
      LS.set('requests', []);
      LS.set('meta', { seeded: true, seedVersion: cat.version || 1, at: now() });
    }

    const read = {
      settings: () => mergeSettings(LS.get('settings', {})),
      categories: () => LS.get('categories', []),
      products: () => LS.get('products', []),
      movements: () => LS.get('movements', []),
      orders: () => LS.get('orders', []),
      requests: () => LS.get('requests', [])
    };

    function adjustSync({ productId, type, qty, setTo, unitCost, reference, note, actor, at }) {
      const products = read.products();
      const p = products.find((x) => x.id === productId);
      if (!p) throw new StoreError('Product not found.', 'NOT_FOUND');
      const t = MOVEMENT_TYPES[type];
      if (!t) throw new StoreError('Unknown stock movement type.', 'BAD_TYPE');
      let change;
      if (type === 'adjustment') {
        const target = toInt(setTo, -1);
        if (target < 0) throw new StoreError('Enter the counted quantity (0 or more).', 'VALIDATION', { setTo: 'Enter a valid count.' });
        change = target - toInt(p.stock);
      } else {
        const q = toInt(qty, 0);
        if (q <= 0) throw new StoreError('Quantity must be at least 1.', 'VALIDATION', { qty: 'Enter a quantity of 1 or more.' });
        change = t.sign * q;
      }
      const before = toInt(p.stock);
      if (before + change < 0) throw new StoreError(`Only ${before} unit${before === 1 ? '' : 's'} of ${p.name} in stock.`, 'INSUFFICIENT_STOCK');
      const cost = toNum(unitCost, null);
      if ((type === 'restock' || type === 'initial') && cost != null && cost >= 0 && change > 0) {
        p.costPrice = before > 0 ? Math.round((before * toNum(p.costPrice, 0) + change * cost) / (before + change)) : cost;
      }
      p.stock = before + change;
      p.updatedAt = at || now();
      const mv = {
        id: uid('mv'), productId: p.id, sku: p.sku, productName: p.name, type, change, balanceAfter: p.stock,
        unitCost: cost != null ? cost : toNum(p.costPrice, 0), reference: String(reference || '').trim(),
        note: String(note || '').trim(), actor: actor || 'admin', at: at || now()
      };
      const movements = read.movements();
      movements.push(mv);
      LS.set('products', products);
      LS.set('movements', movements);
      return mv;
    }

    function placeSync(payload, { at, actor = 'customer', sample = false } = {}) {
      const settings = read.settings();
      validateOrderPayload(payload, settings);
      const products = read.products();
      const q = computeQuote(products, settings, payload.items, payload.delivery);
      const created = at || now();
      const number = orderNumber(new Date(created));
      for (const l of q.lines) {
        if (l.fromStock) adjustSync({ productId: l.productId, type: 'sale', qty: l.qty, reference: number, actor, at: created });
      }
      const c = payload.customer, d = payload.delivery;
      const order = {
        id: uid('o'), number, status: 'pending', paymentStatus: 'unpaid', paymentMethod: payload.paymentMethod,
        customer: { name: c.name.trim(), phone: c.phone.trim(), email: (c.email || '').trim() },
        delivery: {
          method: d.method === 'pickup' ? 'pickup' : 'delivery', state: d.method === 'pickup' ? '' : d.state,
          city: (d.city || '').trim(), address: (d.address || '').trim(), landmark: (d.landmark || '').trim(), eta: q.delivery.eta
        },
        notes: (payload.notes || '').trim(),
        subtotal: q.subtotal, deliveryFee: q.deliveryFee, discount: 0, total: q.total,
        items: q.lines.map((l) => ({
          id: uid('li'), productId: l.productId, sku: l.sku, name: l.name, image: l.image, slug: l.slug, options: l.options,
          price: l.price, qty: l.qty, lineTotal: l.lineTotal, unitCost: l.unitCost, preorder: l.preorder, fromStock: l.fromStock
        })),
        events: [{ id: uid('ev'), type: 'status', status: 'pending', note: 'Order placed', actor, at: created }],
        sample, createdAt: created, updatedAt: created
      };
      const orders = read.orders();
      orders.push(order);
      LS.set('orders', orders);
      return order;
    }

    function updateOrderSync(id, fn) {
      const orders = read.orders();
      const o = orders.find((x) => x.id === id);
      if (!o) throw new StoreError('Order not found.', 'NOT_FOUND');
      fn(o);
      o.updatedAt = now();
      LS.set('orders', orders);
      return clone(o);
    }

    function statusSync(id, status, note, actor, at) {
      if (!ORDER_STATUSES.some((s) => s.id === status)) throw new StoreError('Unknown status.', 'BAD_STATUS');
      const current = read.orders().find((x) => x.id === id);
      if (!current) throw new StoreError('Order not found.', 'NOT_FOUND');
      if (current.status === 'cancelled') throw new StoreError('Cancelled orders cannot be changed.', 'LOCKED');
      if (status === current.status && !String(note || '').trim()) throw new StoreError('Choose a new status or add a note.', 'NO_CHANGE');
      if (status === 'cancelled') {
        for (const l of current.items) {
          if (l.fromStock && read.products().some((p) => p.id === l.productId)) {
            adjustSync({ productId: l.productId, type: 'cancellation', qty: l.qty, reference: current.number, note: 'Restocked from cancelled order', actor, at });
          }
        }
      }
      return updateOrderSync(id, (o) => {
        o.status = status;
        o.events.push({ id: uid('ev'), type: 'status', status, note: String(note || '').trim(), actor: actor || 'admin', at: at || now() });
      });
    }

    function paymentSync(id, paymentStatus, note, actor, at) {
      if (!PAYMENT_STATUSES.some((s) => s.id === paymentStatus)) throw new StoreError('Unknown payment status.', 'BAD_STATUS');
      return updateOrderSync(id, (o) => {
        if (o.paymentStatus === paymentStatus) throw new StoreError(`Payment is already marked ${paymentStatus}.`, 'NO_CHANGE');
        o.paymentStatus = paymentStatus;
        const label = PAYMENT_STATUSES.find((s) => s.id === paymentStatus).label;
        o.events.push({ id: uid('ev'), type: 'payment', status: o.status, note: [`Payment marked as ${label.toLowerCase()}`, String(note || '').trim()].filter(Boolean).join('. '), actor: actor || 'admin', at: at || now() });
      });
    }

    const api = {
      mode: 'local',
      async init() {
        if (!LS.get('meta', null)?.seeded) { await loadScript('js/catalog.js'); seed(false); }
        window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith(NS)) emit(e.key.slice(NS.length)); });
      },

      settings: {
        async get() { return read.settings(); },
        async save(patch) {
          const stored = LS.get('settings', {});
          const next = deepMerge(stored, patch);
          if (patch && Array.isArray(patch.announcements)) next.announcements = patch.announcements;
          LS.set('settings', next);
          emit('settings');
          return mergeSettings(next);
        }
      },

      categories: {
        async list() { return read.categories().slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); },
        async save(input) {
          const all = read.categories();
          const name = String(input.name || '').trim();
          if (name.length < 2) throw new StoreError('Category name is required.', 'VALIDATION', { name: 'Enter a name.' });
          let c = input.id ? all.find((x) => x.id === input.id) : null;
          if (!c) {
            let id = slugify(input.slug || name), n = 2;
            while (all.some((x) => x.id === id)) id = `${slugify(name)}-${n++}`;
            c = { id, createdAt: now(), sortOrder: all.length + 1, active: true };
            all.push(c);
          }
          c.name = name;
          c.code = String(input.code || c.code || name.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase().slice(0, 4) || 'GN';
          c.description = String(input.description || '').trim();
          c.image = String(input.image || c.image || '');
          if (input.sortOrder !== undefined) c.sortOrder = toInt(input.sortOrder, c.sortOrder);
          if (input.active !== undefined) c.active = !!input.active;
          LS.set('categories', all);
          emit('categories');
          return clone(c);
        },
        async remove(id) {
          const used = read.products().filter((p) => p.categoryId === id).length;
          if (used) throw new StoreError(`Move or delete the ${used} product${used === 1 ? '' : 's'} in this category first.`, 'IN_USE');
          LS.set('categories', read.categories().filter((c) => c.id !== id));
          emit('categories');
        }
      },

      products: {
        async list({ all = false } = {}) {
          const list = read.products().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
          return all ? list : list.filter((p) => p.status === 'active');
        },
        async get(idOrSlug) {
          return clone(read.products().find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null);
        },
        async save(input, { openingStock = 0, openingCost = null, actor = 'admin' } = {}) {
          const products = read.products();
          const categories = read.categories();
          const clean = sanitizeProduct(input);
          const existing = input.id ? products.find((p) => p.id === input.id) : null;
          let p;
          if (existing) {
            p = { ...existing, ...clean, id: existing.id, stock: existing.stock, createdAt: existing.createdAt, updatedAt: now() };
          } else {
            p = {
              brand: '', description: '', compareAtPrice: null, costPrice: 0, lowStockThreshold: read.settings().inventory?.defaultLowStock ?? 5,
              trackInventory: true, allowPreorder: false, leadTime: '', images: [], options: [], badge: '', featured: false, tags: [],
              status: 'active', ...clean, id: uid('p'), stock: 0, createdAt: now(), updatedAt: now()
            };
          }
          if (!p.sku) p.sku = nextSku(products, categories, p.categoryId);
          p.slug = uniqueSlug(clean.slug || p.slug || p.name, products, p.id);
          validateProduct(p, products, categories);
          if (existing) Object.assign(existing, p); else products.push(p);
          LS.set('products', products);
          if (!existing && toInt(openingStock) > 0) {
            adjustSync({ productId: p.id, type: 'initial', qty: toInt(openingStock), unitCost: openingCost ?? p.costPrice, reference: 'Opening stock', actor });
          }
          emit('products');
          return clone(read.products().find((x) => x.id === p.id));
        },
        async bulkUpdate(ids, patch) {
          const clean = sanitizeProduct(patch);
          const products = read.products();
          products.forEach((p) => { if (ids.includes(p.id)) Object.assign(p, clean, { updatedAt: now() }); });
          LS.set('products', products);
          emit('products');
        },
        async remove(ids) {
          const set = new Set([].concat(ids));
          LS.set('products', read.products().filter((p) => !set.has(p.id)));
          emit('products');
        }
      },

      inventory: {
        async adjust(args) { const mv = adjustSync(args); emit('inventory'); return mv; },
        async movements({ productId, limit = 5000 } = {}) {
          let list = read.movements();
          if (productId) list = list.filter((m) => m.productId === productId);
          return list.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
        }
      },

      orders: {
        async place(payload) { const o = placeSync(payload); emit('orders'); return publicOrder(o); },
        async list() { return read.orders().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); },
        async get(id) { return clone(read.orders().find((o) => o.id === id || o.number === id) || null); },
        async updateStatus(id, status, note, actor) { const o = statusSync(id, status, note, actor); emit('orders'); return o; },
        async setPayment(id, status, note, actor) { const o = paymentSync(id, status, note, actor); emit('orders'); return o; },
        async addNote(id, note, actor, { internal = false } = {}) {
          if (!String(note || '').trim()) throw new StoreError('Write a note first.', 'VALIDATION');
          const o = updateOrderSync(id, (x) => x.events.push({ id: uid('ev'), type: internal ? 'internal' : 'note', status: x.status, note: String(note).trim(), actor: actor || 'admin', at: now() }));
          emit('orders');
          return o;
        },
        async track(number, phone) {
          const n = String(number || '').trim().toUpperCase().replace(/^#/, '');
          const o = read.orders().find((x) => x.number.toUpperCase() === n);
          if (!o || !phoneMatch(o.customer.phone, phone)) return null;
          return publicOrder(o);
        }
      },

      requests: {
        async create(data) {
          const reqs = read.requests();
          const r = {
            id: uid('rq'), reference: `RQ-${rand(5)}`, status: 'new',
            customerName: String(data.customerName || '').trim(), whatsapp: String(data.whatsapp || '').trim(),
            location: String(data.location || '').trim(), category: String(data.category || '').trim(),
            description: String(data.description || '').trim().slice(0, 4000),
            link: /^https?:\/\//i.test(String(data.link || '').trim()) ? String(data.link).trim().slice(0, 1000) : '',
            images: (data.images || []).filter((s) => /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s) && s.length < 600000).slice(0, 4), quantity: Math.max(1, toInt(data.quantity, 1)), budget: String(data.budget || '').trim(),
            quotedPrice: null, quotedDays: '', adminNotes: '', createdAt: now(), updatedAt: now()
          };
          if (!r.customerName || digits(r.whatsapp).length < 10 || r.description.length < 5) {
            throw new StoreError('Please fill in your name, WhatsApp number and a short description.', 'VALIDATION');
          }
          reqs.push(r);
          LS.set('requests', reqs);
          emit('requests');
          return { reference: r.reference };
        },
        async list() { return read.requests().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); },
        async update(id, patch) {
          const reqs = read.requests();
          const r = reqs.find((x) => x.id === id);
          if (!r) throw new StoreError('Request not found.', 'NOT_FOUND');
          if (patch.status !== undefined) r.status = patch.status;
          if (patch.quotedPrice !== undefined) r.quotedPrice = toNum(patch.quotedPrice, null);
          if (patch.quotedDays !== undefined) r.quotedDays = String(patch.quotedDays || '');
          if (patch.adminNotes !== undefined) r.adminNotes = String(patch.adminNotes || '');
          r.updatedAt = now();
          LS.set('requests', reqs);
          emit('requests');
          return clone(r);
        }
      },

      auth: {
        async signIn({ passcode }) {
          const stored = LS.get('admin', null);
          const expected = stored?.hash || await sha256(CFG.demoPasscode || 'chibest-admin');
          if (await sha256(String(passcode || '')) !== expected) throw new StoreError('Incorrect passcode.', 'AUTH');
          sessionStorage.setItem(NS + 'session', JSON.stringify({ at: now(), name: 'Store admin' }));
          return { name: 'Store admin', email: '' };
        },
        async signOut() { sessionStorage.removeItem(NS + 'session'); },
        async current() {
          try { const s = JSON.parse(sessionStorage.getItem(NS + 'session') || 'null'); return s ? { name: s.name, email: '' } : null; } catch (e) { return null; }
        },
        async changePasscode(current, next) {
          await api.auth.signIn({ passcode: current });
          if (String(next || '').length < 6) throw new StoreError('Use at least 6 characters.', 'VALIDATION');
          LS.set('admin', { hash: await sha256(next) });
        },
        usesPasscode: true
      },

      media: {
        async upload(file) {
          const { dataUrl } = await compressImage(file, { max: 1000, quality: 0.8 });
          return dataUrl;
        }
      },

      data: {
        async export() {
          return { app: 'chibest', version: 2, exportedAt: now(), settings: LS.get('settings', {}), categories: read.categories(), products: read.products(), movements: read.movements(), orders: read.orders(), requests: read.requests() };
        },
        async import(json) {
          if (!json || json.app !== 'chibest' || !Array.isArray(json.products)) throw new StoreError('This file is not a Chi-Best backup.', 'BAD_FILE');
          LS.set('settings', json.settings || {});
          LS.set('categories', json.categories || []);
          LS.set('products', json.products || []);
          LS.set('movements', json.movements || []);
          LS.set('orders', json.orders || []);
          LS.set('requests', json.requests || []);
          emit('all');
        },
        async reset() { await loadScript('js/catalog.js'); seed(true); emit('all'); },
        async generateSamples() {
          const products = read.products().filter((p) => p.status === 'active' && p.stock > 3);
          if (!products.length) throw new StoreError('No stocked products available for sample orders.', 'EMPTY');
          const names = ['Adaeze Okafor', 'Tunde Bakare', 'Chiamaka Eze', 'Ifeanyi Nwosu', 'Blessing Okon', 'Kemi Adeyemi', 'Musa Bello', 'Ngozi Umeh',
            'Seyi Ogunleye', 'Halima Yusuf', 'Emeka Obi', 'Funmilayo Ade', 'Uche Nnaji', 'Zainab Lawal', 'Tolu Adebayo', 'Chidi Okeke'];
          const places = [['Lagos', 'Lekki'], ['Lagos', 'Ikeja'], ['Lagos', 'Surulere'], ['Lagos', 'Yaba'], ['Abuja (FCT)', 'Wuse 2'], ['Rivers', 'Port Harcourt'], ['Oyo', 'Ibadan'], ['Enugu', 'Independence Layout'], ['Lagos', 'Ajah'], ['Anambra', 'Awka']];
          const flow = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
          const pick = (a) => a[Math.floor(Math.random() * a.length)];
          let made = 0;
          for (let i = 0; i < 26; i++) {
            const daysAgo = Math.floor(Math.pow(Math.random(), 1.3) * 34);
            const created = new Date(Date.now() - daysAgo * 864e5 - (1 + Math.random() * 8) * 36e5);
            const n = 1 + Math.floor(Math.random() * 3);
            const items = [];
            for (let k = 0; k < n; k++) {
              const p = pick(read.products().filter((x) => x.status === 'active' && x.stock > 3));
              if (!p) break;
              const options = {};
              (p.options || []).forEach((g) => { options[g.name] = pick(g.values); });
              items.push({ productId: p.id, qty: Math.random() < 0.8 ? 1 : 2, options });
            }
            if (!items.length) break;
            const [state, city] = pick(places);
            const name = names[i % names.length];
            const pm = state === 'Lagos' && Math.random() < 0.35 ? 'pay_on_delivery' : 'bank_transfer';
            try {
              const o = placeSync({
                customer: { name, phone: `080${Math.floor(10000000 + Math.random() * 89999999)}`, email: '' },
                delivery: { method: Math.random() < 0.1 ? 'pickup' : 'delivery', state, city, address: `${1 + Math.floor(Math.random() * 40)} ${pick(['Admiralty Way', 'Allen Avenue', 'Adeniran Ogunsanya St', 'Herbert Macaulay Way', 'Aminu Kano Crescent', 'Trans-Amadi Rd', 'Ring Road'])}`, landmark: '' },
                paymentMethod: pm, items, notes: ''
              }, { at: created.toISOString(), actor: 'customer', sample: true });
              const stage = daysAgo > 12 ? 5 : daysAgo > 7 ? pick([3, 4, 5]) : daysAgo > 3 ? pick([1, 2, 3]) : pick([0, 0, 1]);
              const cancel = Math.random() < 0.07;
              let t = created.getTime();
              // Each later event happens a few hours after the previous one, but never in the future.
              const step = () => { t = Math.min(t + (3 + Math.random() * 30) * 36e5, Date.now() - 6e4); return new Date(t).toISOString(); };
              if (stage >= 1 && pm === 'bank_transfer') paymentSync(o.id, 'paid', 'Transfer received', 'admin', step());
              if (cancel) statusSync(o.id, 'cancelled', 'Customer changed their mind', 'admin', step());
              else for (let s = 1; s <= stage; s++) statusSync(o.id, flow[s], s === 3 ? 'Dispatched with our delivery partner' : '', 'admin', step());
              if (!cancel && stage === 5 && pm === 'pay_on_delivery') paymentSync(o.id, 'paid', 'Cash collected on delivery', 'admin', new Date(t).toISOString());
              made++;
            } catch (e) { /* skip lines that became unavailable */ }
          }
          emit('all');
          return made;
        }
      }
    };
    return api;
  }

  async function sha256(text) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return 'x' + h;
  }

  // =================================================================
  // SUPABASE BACKEND (live)
  // =================================================================
  function createSupabaseBackend() {
    let sb = null;
    const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

    function loadLib() {
      if (window.supabase?.createClient) return Promise.resolve(window.supabase);
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SUPABASE_JS; s.async = true;
        s.onload = () => resolve(window.supabase);
        s.onerror = () => reject(new StoreError('Could not reach the store database. Check your internet connection.', 'NETWORK'));
        document.head.appendChild(s);
      });
    }
    async function q(promise) {
      const { data, error } = await promise;
      if (error) throw new StoreError(error.message || 'Database error', error.code || 'DB');
      return data;
    }
    const n = (v) => (v == null ? null : Number(v));

    const map = {
      category: (r) => ({ id: r.id, name: r.name, code: r.code, description: r.description || '', image: r.image || '', sortOrder: r.sort_order, active: r.active, createdAt: r.created_at }),
      product: (r) => ({
        id: r.id, sku: r.sku, slug: r.slug, name: r.name, description: r.description || '', categoryId: r.category_id, brand: r.brand || '',
        price: n(r.price), compareAtPrice: n(r.compare_at_price), costPrice: n(r.cost_price) ?? 0, stock: r.stock,
        lowStockThreshold: r.low_stock_threshold, trackInventory: r.track_inventory, allowPreorder: r.allow_preorder, leadTime: r.lead_time || '',
        images: r.images || [], options: r.options || [], badge: r.badge || '', featured: r.featured, tags: r.tags || [], status: r.status,
        createdAt: r.created_at, updatedAt: r.updated_at
      }),
      productRow: (p) => {
        const row = {};
        const pairs = { sku: 'sku', slug: 'slug', name: 'name', description: 'description', categoryId: 'category_id', brand: 'brand', price: 'price',
          compareAtPrice: 'compare_at_price', costPrice: 'cost_price', lowStockThreshold: 'low_stock_threshold', trackInventory: 'track_inventory',
          allowPreorder: 'allow_preorder', leadTime: 'lead_time', images: 'images', options: 'options', badge: 'badge', featured: 'featured', tags: 'tags', status: 'status' };
        for (const [k, col] of Object.entries(pairs)) if (p[k] !== undefined) row[col] = p[k];
        return row;
      },
      movement: (r) => ({ id: r.id, productId: r.product_id, sku: r.sku, productName: r.product_name, type: r.type, change: r.change, balanceAfter: r.balance_after, unitCost: n(r.unit_cost), reference: r.reference || '', note: r.note || '', actor: r.actor || '', at: r.created_at }),
      order: (r) => r && ({
        id: r.id, number: r.order_number, status: r.status, paymentStatus: r.payment_status, paymentMethod: r.payment_method,
        customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email || '' },
        delivery: { method: r.delivery_method, state: r.delivery_state || '', city: r.delivery_city || '', address: r.delivery_address || '', landmark: r.delivery_landmark || '', eta: r.delivery_eta || '' },
        notes: r.notes || '', subtotal: n(r.subtotal), deliveryFee: n(r.delivery_fee), discount: n(r.discount) || 0, total: n(r.total),
        items: (r.order_items || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0)).map((i) => ({ id: i.id, productId: i.product_id, sku: i.sku, name: i.name, image: i.image || '', slug: i.slug || '', options: i.options || {}, price: n(i.unit_price), qty: i.quantity, lineTotal: n(i.line_total), unitCost: n(i.unit_cost), preorder: i.preorder, fromStock: i.from_stock })),
        events: (r.order_events || []).map((e) => ({ id: e.id, type: e.type, status: e.status, note: e.note || '', actor: e.actor || '', at: e.created_at })).sort((a, b) => String(a.at).localeCompare(String(b.at))),
        createdAt: r.created_at, updatedAt: r.updated_at
      }),
      request: (r) => ({ id: r.id, reference: r.reference, status: r.status, customerName: r.customer_name, whatsapp: r.customer_whatsapp, location: r.location || '', category: r.category || '', description: r.description, link: r.product_link || '', images: r.images || [], quantity: r.quantity, budget: r.budget || '', quotedPrice: n(r.quoted_price), quotedDays: r.quoted_days || '', adminNotes: r.admin_notes || '', createdAt: r.created_at, updatedAt: r.updated_at })
    };

    let cache = {};
    const cached = (key, fn) => (cache[key] = cache[key] || fn().catch((e) => { delete cache[key]; throw e; }));
    const bust = (...keys) => keys.forEach((k) => delete cache[k]);
    const ORDER_SELECT = '*, order_items(*), order_events(*)';

    const api = {
      mode: 'supabase',
      async init() {
        const lib = await loadLib();
        sb = lib.createClient(CFG.supabase.url, CFG.supabase.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      },
      get client() { return sb; },

      settings: {
        async get() { return cached('settings', async () => mergeSettings((await q(sb.from('settings').select('data').eq('id', 1).maybeSingle()))?.data)); },
        async save(patch) {
          const stored = (await q(sb.from('settings').select('data').eq('id', 1).maybeSingle()))?.data || {};
          const next = deepMerge(stored, patch);
          if (patch && Array.isArray(patch.announcements)) next.announcements = patch.announcements;
          await q(sb.from('settings').upsert({ id: 1, data: next, updated_at: now() }));
          bust('settings'); emit('settings');
          return mergeSettings(next);
        }
      },

      categories: {
        async list() { return cached('categories', async () => (await q(sb.from('categories').select('*').order('sort_order'))).map(map.category)); },
        async save(input) {
          const all = await api.categories.list();
          const name = String(input.name || '').trim();
          if (name.length < 2) throw new StoreError('Category name is required.', 'VALIDATION', { name: 'Enter a name.' });
          const existing = input.id ? all.find((c) => c.id === input.id) : null;
          let id = existing?.id;
          if (!id) { id = slugify(name); let k = 2; while (all.some((c) => c.id === id)) id = `${slugify(name)}-${k++}`; }
          const row = {
            id, name, code: String(input.code || existing?.code || name.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase().slice(0, 4) || 'GN',
            description: String(input.description || '').trim(), image: String(input.image || existing?.image || ''),
            sort_order: input.sortOrder !== undefined ? toInt(input.sortOrder) : (existing?.sortOrder ?? all.length + 1),
            active: input.active !== undefined ? !!input.active : (existing?.active ?? true)
          };
          const saved = await q(sb.from('categories').upsert(row).select().single());
          bust('categories'); emit('categories');
          return map.category(saved);
        },
        async remove(id) {
          const { count } = await sb.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
          if (count) throw new StoreError(`Move or delete the ${count} product${count === 1 ? '' : 's'} in this category first.`, 'IN_USE');
          await q(sb.from('categories').delete().eq('id', id));
          bust('categories'); emit('categories');
        }
      },

      products: {
        async list({ all = false } = {}) {
          return cached(all ? 'products:all' : 'products', async () => {
            // Shoppers read the public view (no cost prices); admins read the full table.
            const qry = sb.from(all ? 'products' : 'storefront_products').select('*').order('created_at', { ascending: false });
            return (await q(qry)).map(map.product);
          });
        },
        async get(idOrSlug) {
          const qry = sb.from('storefront_products').select('*');
          const row = await q((isUuid(idOrSlug) ? qry.eq('id', idOrSlug) : qry.eq('slug', idOrSlug)).maybeSingle());
          return row ? map.product(row) : null;
        },
        async save(input, { openingStock = 0, openingCost = null } = {}) {
          const all = await api.products.list({ all: true });
          const categories = await api.categories.list();
          const clean = sanitizeProduct(input);
          const existing = input.id ? all.find((p) => p.id === input.id) : null;
          const p = existing ? { ...existing, ...clean } : {
            brand: '', description: '', compareAtPrice: null, costPrice: 0, lowStockThreshold: (await api.settings.get()).inventory?.defaultLowStock ?? 5,
            trackInventory: true, allowPreorder: false, leadTime: '', images: [], options: [], badge: '', featured: false, tags: [], status: 'active', ...clean
          };
          if (!p.sku) p.sku = nextSku(all, categories, p.categoryId);
          p.slug = uniqueSlug(clean.slug || p.slug || p.name, all, existing?.id);
          validateProduct(p, all, categories);
          const row = map.productRow(p);
          let saved;
          if (existing) saved = await q(sb.from('products').update({ ...row, updated_at: now() }).eq('id', existing.id).select().single());
          else saved = await q(sb.from('products').insert(row).select().single());
          if (!existing && toInt(openingStock) > 0) {
            await q(sb.rpc('adjust_stock', { p_product_id: saved.id, p_type: 'initial', p_qty: toInt(openingStock), p_set_to: null, p_unit_cost: openingCost ?? p.costPrice, p_reference: 'Opening stock', p_note: '' }));
            saved = await q(sb.from('products').select('*').eq('id', saved.id).single());
          }
          bust('products', 'products:all'); emit('products');
          return map.product(saved);
        },
        async bulkUpdate(ids, patch) {
          await q(sb.from('products').update({ ...map.productRow(sanitizeProduct(patch)), updated_at: now() }).in('id', ids));
          bust('products', 'products:all'); emit('products');
        },
        async remove(ids) {
          await q(sb.from('products').delete().in('id', [].concat(ids)));
          bust('products', 'products:all'); emit('products');
        }
      },

      inventory: {
        async adjust({ productId, type, qty, setTo, unitCost, reference, note }) {
          const row = await q(sb.rpc('adjust_stock', {
            p_product_id: productId, p_type: type, p_qty: qty == null ? null : toInt(qty), p_set_to: setTo == null || setTo === '' ? null : toInt(setTo),
            p_unit_cost: toNum(unitCost, null), p_reference: reference || '', p_note: note || ''
          }));
          bust('products', 'products:all'); emit('inventory');
          return map.movement(row);
        },
        async movements({ productId, limit = 5000 } = {}) {
          let qry = sb.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(limit);
          if (productId) qry = qry.eq('product_id', productId);
          return (await q(qry)).map(map.movement);
        }
      },

      orders: {
        async place(payload) {
          validateOrderPayload(payload, await api.settings.get());
          const row = await q(sb.rpc('place_order', { payload }));
          bust('products', 'products:all'); emit('orders');
          return map.order(row);
        },
        async list() { return (await q(sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(2000))).map(map.order); },
        async get(id) {
          const qry = sb.from('orders').select(ORDER_SELECT);
          const row = await q((isUuid(id) ? qry.eq('id', id) : qry.eq('order_number', id)).maybeSingle());
          return map.order(row);
        },
        async updateStatus(id, status, note) {
          const row = await q(sb.rpc('update_order_status', { p_order_id: id, p_status: status, p_note: note || '' }));
          bust('products', 'products:all'); emit('orders');
          return map.order(row);
        },
        async setPayment(id, status, note) {
          const row = await q(sb.rpc('set_payment_status', { p_order_id: id, p_status: status, p_note: note || '' }));
          emit('orders');
          return map.order(row);
        },
        async addNote(id, note, actor, { internal = false } = {}) {
          const row = await q(sb.rpc('add_order_note', { p_order_id: id, p_note: note || '', p_internal: !!internal }));
          emit('orders');
          return map.order(row);
        },
        async track(number, phone) {
          const row = await q(sb.rpc('track_order', { p_number: String(number || '').trim().replace(/^#/, ''), p_phone: String(phone || '') }));
          return row ? map.order(row) : null;
        }
      },

      requests: {
        async create(data) {
          const ref = await q(sb.rpc('submit_request', { payload: data }));
          emit('requests');
          return { reference: ref };
        },
        async list() { return (await q(sb.from('product_requests').select('*').order('created_at', { ascending: false }))).map(map.request); },
        async update(id, patch) {
          const row = {};
          if (patch.status !== undefined) row.status = patch.status;
          if (patch.quotedPrice !== undefined) row.quoted_price = toNum(patch.quotedPrice, null);
          if (patch.quotedDays !== undefined) row.quoted_days = String(patch.quotedDays || '');
          if (patch.adminNotes !== undefined) row.admin_notes = String(patch.adminNotes || '');
          row.updated_at = now();
          const saved = await q(sb.from('product_requests').update(row).eq('id', id).select().single());
          emit('requests');
          return map.request(saved);
        }
      },

      auth: {
        async signIn({ email, password }) {
          const { data, error } = await sb.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
          if (error) throw new StoreError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message, 'AUTH');
          const ok = await q(sb.rpc('is_admin'));
          if (!ok) { await sb.auth.signOut(); throw new StoreError('This account does not have admin access.', 'FORBIDDEN'); }
          return { name: data.user.email, email: data.user.email };
        },
        async signOut() { await sb.auth.signOut(); },
        async current() {
          const { data } = await sb.auth.getSession();
          if (!data?.session) return null;
          const ok = await q(sb.rpc('is_admin')).catch(() => false);
          return ok ? { name: data.session.user.email, email: data.session.user.email } : null;
        },
        usesPasscode: false
      },

      media: {
        async upload(file) {
          const { blob } = await compressImage(file, { max: 1400, quality: 0.84 });
          const path = `products/${Date.now()}-${rand(6, 'abcdefghijklmnopqrstuvwxyz0123456789')}.jpg`;
          await q(sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
          return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        }
      },

      data: {
        async export() {
          const [settings, categories, products, movements, orders, requests] = await Promise.all([
            api.settings.get(), api.categories.list(), api.products.list({ all: true }), api.inventory.movements(), api.orders.list(), api.requests.list()
          ]);
          return { app: 'chibest', version: 2, exportedAt: now(), settings, categories, products, movements, orders, requests };
        }
      }
    };
    return api;
  }

  // =================================================================
  // Public API
  // =================================================================
  const live = !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey);
  const backend = live ? createSupabaseBackend() : createLocalBackend();
  let readyPromise = null;

  const DB = {
    mode: backend.mode,
    isDemo: !live,
    ready() {
      return (readyPromise = readyPromise || backend.init().then(() => DB));
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    settings: backend.settings,
    categories: backend.categories,
    products: backend.products,
    inventory: backend.inventory,
    orders: backend.orders,
    requests: backend.requests,
    auth: backend.auth,
    media: backend.media,
    data: backend.data,
    customers: {
      async list() { return deriveCustomers(await backend.orders.list()); }
    },

    /** Price cart lines leniently for display (cart drawer, cart page, checkout). */
    async quote(items, delivery) {
      const [products, settings] = await Promise.all([backend.products.list(), backend.settings.get()]);
      return computeQuote(products, settings, items, delivery, { lenient: true });
    },

    const: { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS, MOVEMENT_TYPES, REQUEST_STATUSES, NG_STATES },
    util: {
      money, slugify, digits, normPhone, phoneMatch, availability, deliveryQuote, announcementText,
      compressImage, optionsKey, clone, StoreError, isUuid
    }
  };

  window.DB = DB;
})();
