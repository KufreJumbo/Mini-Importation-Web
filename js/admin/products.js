// Products: catalogue list, bulk actions, CSV import/export and the product editor.
(function () {
  const { I, $, $$, esc, money, fmt, thumb, pill, stockState } = Admin;
  const PRESETS = {
    'Kids ages': { name: 'Size', values: ['2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y'] },
    'Kids EU 26-36': { name: 'Size', values: ['26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36'] },
    'Toddler EU 15-25': { name: 'Size', values: ['15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25'] },
    'Women EU 36-41': { name: 'Size', values: ['36', '37', '38', '39', '40', '41'] },
    'S - XL': { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    Colour: { name: 'Colour', values: [] }
  };

  function salesByProduct(orders) {
    const m = new Map();
    orders.filter((o) => o.status !== 'cancelled').forEach((o) => o.items.forEach((l) => {
      const cur = m.get(l.productId) || { units: 0, revenue: 0, last: null };
      cur.units += l.qty; cur.revenue += l.lineTotal;
      if (!cur.last || o.createdAt > cur.last) cur.last = o.createdAt;
      m.set(l.productId, cur);
    }));
    return m;
  }

  // ---------------------------------------------------------------
  // Chips input
  // ---------------------------------------------------------------
  function chipsInput(root, values, onChange, placeholder = 'Type and press Enter') {
    const render = () => {
      root.innerHTML = values.map((v, i) => `<span class="chip">${esc(v)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(v)}">${I('x')}</button></span>`).join('') + `<input type="text" placeholder="${values.length ? '' : esc(placeholder)}" aria-label="Add value">`;
    };
    const add = (raw) => {
      raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => { if (!values.includes(v)) values.push(v); });
      render(); onChange(values); $('input', root).focus();
    };
    root.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) { e.preventDefault(); add(e.target.value); }
      else if (e.key === 'Enter') e.preventDefault();
      else if (e.key === 'Backspace' && !e.target.value && values.length) { values.pop(); render(); onChange(values); $('input', root).focus(); }
    });
    root.addEventListener('focusout', (e) => { if (e.target.tagName === 'INPUT' && e.target.value.trim()) add(e.target.value); });
    root.addEventListener('paste', (e) => { const t = e.clipboardData.getData('text'); if (t.includes(',')) { e.preventDefault(); add(t); } });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rm]');
      if (b) { values.splice(+b.dataset.rm, 1); render(); onChange(values); }
      else if (e.target === root) $('input', root).focus();
    });
    render();
  }

  // ---------------------------------------------------------------
  // Image library modal
  // ---------------------------------------------------------------
  async function libraryPicker(onPick) {
    const { products, categories } = await Admin.load('products', 'categories');
    const all = [...new Set([...products.flatMap((p) => p.images || []), ...categories.map((c) => c.image)].filter((s) => s && !s.startsWith('data:')))];
    const picked = new Set();
    Admin.modal({
      title: 'Image library', sub: `${all.length} images already in your store. Select one or more.`, size: 'lg',
      body: `<input class="input" type="search" placeholder="Filter by file name" data-filter style="margin-bottom:12px"><div class="library">${all.map((src) => `<button type="button" data-src="${esc(src)}" title="${esc(src.split('/').pop())}"><img src="${esc(thumb(src))}" alt="" loading="lazy"></button>`).join('')}</div>`,
      foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-add disabled>Add images</button>`,
      onMount(m) {
        m.el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-src]');
          if (b) { const s = b.dataset.src; picked.has(s) ? picked.delete(s) : picked.add(s); b.classList.toggle('is-on'); m.$('[data-add]').disabled = !picked.size; m.$('[data-add]').textContent = picked.size ? `Add ${picked.size} image${picked.size === 1 ? '' : 's'}` : 'Add images'; }
          if (e.target.closest('[data-add]')) { onPick([...picked]); m.close(); }
        });
        m.$('[data-filter]').addEventListener('input', (e) => { const v = e.target.value.toLowerCase(); $$('[data-src]', m.el).forEach((b) => { b.hidden = v && !b.dataset.src.toLowerCase().includes(v); }); });
      }
    });
  }

  // ---------------------------------------------------------------
  // CSV import
  // ---------------------------------------------------------------
  function parseCsv(text) {
    const rows = []; let row = []; let cur = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const CSV_COLS = ['SKU', 'Name', 'Category', 'Price', 'Compare at price', 'Cost price', 'Stock', 'Low stock threshold', 'Allow pre-order', 'Lead time', 'Status', 'Featured', 'Brand', 'Badge', 'Tags', 'Description', 'Image URLs'];

  async function importCsv() {
    const { products, categories } = await Admin.load('products', 'categories');
    Admin.modal({
      title: 'Import products from CSV', size: 'lg',
      sub: 'Create new products or update existing ones (matched by SKU). Stock changes are recorded in the inventory ledger.',
      body: `<div class="stack">
        <label class="media-add" style="aspect-ratio:auto;padding:26px">${I('upload')}<strong style="font-size:14px;color:var(--ink)">Choose a CSV file</strong><span>Use the template so the columns match.</span><input type="file" accept=".csv,text/csv" data-file></label>
        <button class="btn btn-ghost btn-sm" type="button" data-template style="justify-self:start">${I('download')}Download template (with your current products)</button>
        <div data-preview></div></div>`,
      foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-apply disabled>Import</button>`,
      onMount(m) {
        let plan = [];
        m.$('[data-template]').addEventListener('click', () => {
          Admin.csv('chibest-products-template.csv', CSV_COLS, products.map((p) => [p.sku, p.name, categories.find((c) => c.id === p.categoryId)?.name || p.categoryId, p.price, p.compareAtPrice || '', p.costPrice || '', p.stock, p.lowStockThreshold, p.allowPreorder ? 'yes' : 'no', p.leadTime, p.status, p.featured ? 'yes' : 'no', p.brand, p.badge, (p.tags || []).join(', '), p.description, (p.images || []).filter((s) => !s.startsWith('data:')).join(' | ')]));
        });
        m.$('[data-file]').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const rows = parseCsv((await file.text()).replace(/^﻿/, ''));
          const head = rows.shift().map((h) => h.trim().toLowerCase());
          const col = (name) => head.indexOf(name.toLowerCase());
          const get = (r, name) => { const i = col(name); return i >= 0 ? (r[i] || '').trim() : undefined; };
          const yes = (v) => /^(yes|true|1|y)$/i.test(v || '');
          const catOf = (v) => categories.find((c) => c.id === v || c.name.toLowerCase() === String(v).toLowerCase())?.id;
          plan = rows.map((r, n) => {
            const sku = (get(r, 'SKU') || '').toUpperCase();
            const existing = sku ? products.find((p) => p.sku.toUpperCase() === sku) : null;
            const input = {};
            const set = (k, v, f = (x) => x) => { if (v !== undefined && v !== '') input[k] = f(v); };
            set('name', get(r, 'Name')); set('price', get(r, 'Price'), Number); set('compareAtPrice', get(r, 'Compare at price'), Number);
            set('costPrice', get(r, 'Cost price'), Number); set('lowStockThreshold', get(r, 'Low stock threshold'), Number);
            set('allowPreorder', get(r, 'Allow pre-order'), yes); set('leadTime', get(r, 'Lead time')); set('status', get(r, 'Status'), (v) => v.toLowerCase());
            set('featured', get(r, 'Featured'), yes); set('brand', get(r, 'Brand')); set('badge', get(r, 'Badge')); set('tags', get(r, 'Tags'));
            set('description', get(r, 'Description')); set('images', get(r, 'Image URLs'), (v) => v.split('|').map((s) => s.trim()).filter(Boolean));
            const catRaw = get(r, 'Category');
            if (catRaw) input.categoryId = catOf(catRaw);
            if (sku) input.sku = sku;
            const stockRaw = get(r, 'Stock');
            const stock = stockRaw === undefined || stockRaw === '' ? null : parseInt(stockRaw, 10);
            let error = '';
            if (catRaw && !input.categoryId) error = `Unknown category "${catRaw}"`;
            if (!existing && (!input.name || !input.price || !input.categoryId)) error = error || 'New products need a name, price and category';
            if (stock != null && (Number.isNaN(stock) || stock < 0)) error = 'Stock must be 0 or more';
            return { line: n + 2, sku, existing, input, stock, error };
          });
          const creates = plan.filter((p) => !p.error && !p.existing).length;
          const updates = plan.filter((p) => !p.error && p.existing).length;
          const errors = plan.filter((p) => p.error);
          m.$('[data-preview]').innerHTML = `<div class="cols-3" style="margin-top:4px">
            <div class="card mini-stat"><div class="stat-label">New products</div><div class="stat-value">${creates}</div></div>
            <div class="card mini-stat"><div class="stat-label">Updates</div><div class="stat-value">${updates}</div></div>
            <div class="card mini-stat ${errors.length ? 'is-bad' : ''}"><div class="stat-label">Rows with errors</div><div class="stat-value">${errors.length}</div></div></div>
            ${errors.length ? `<div class="card" style="margin-top:12px;max-height:180px;overflow:auto"><table class="table"><tbody>${errors.map((x) => `<tr><td class="num">Row ${x.line}</td><td>${esc(x.sku || x.input.name || '')}</td><td style="color:var(--brand)">${esc(x.error)}</td></tr>`).join('')}</tbody></table></div><p class="hint" style="margin-top:8px">Rows with errors will be skipped.</p>` : ''}`;
          m.$('[data-apply]').disabled = !(creates + updates);
          m.$('[data-apply]').textContent = `Import ${creates + updates} product${creates + updates === 1 ? '' : 's'}`;
        });
        m.$('[data-apply]').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.classList.add('is-loading');
          let ok = 0; const failed = [];
          for (const row of plan.filter((p) => !p.error)) {
            try {
              if (row.existing) {
                await DB.products.save({ ...row.input, id: row.existing.id });
                if (row.stock != null && row.stock !== row.existing.stock && row.existing.trackInventory !== false) {
                  await DB.inventory.adjust({ productId: row.existing.id, type: 'adjustment', setTo: row.stock, reference: 'CSV import', note: `Stock set from ${row.existing.stock} to ${row.stock}`, actor: Admin.state.user?.name });
                }
              } else {
                await DB.products.save(row.input, { openingStock: row.stock || 0, openingCost: row.input.costPrice });
              }
              ok++;
            } catch (err) { failed.push(`Row ${row.line}: ${err.message}`); }
          }
          Admin.invalidate('products', 'movements');
          m.close();
          Admin.toast(`${ok} product${ok === 1 ? '' : 's'} imported`, { sub: failed.length ? `${failed.length} failed: ${failed[0]}` : 'Catalogue updated', type: failed.length ? 'error' : 'success', duration: 6000 });
          Admin.render();
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // Product list
  // ---------------------------------------------------------------
  const selected = new Set();
  let shown = 60;

  async function renderList(el, route, isCurrent) {
    Admin.setTitle('Products');
    const { products, categories, orders, settings } = await Admin.load('products', 'categories', 'orders', 'settings');
    if (!isCurrent()) return;
    const q = route.query;
    const tab = q.get('status') || 'active';
    const cat = q.get('cat') || '';
    const stock = q.get('stock') || '';
    const sort = q.get('sort') || 'newest';
    const search = (q.get('q') || '').toLowerCase().trim();
    const sales = salesByProduct(orders);
    const catName = (id) => categories.find((c) => c.id === id)?.name || '—';

    const counts = { all: products.length, active: 0, draft: 0, archived: 0 };
    products.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    let list = products.filter((p) => (tab === 'all' || p.status === tab) && (!cat || p.categoryId === cat) && (!stock || stockState(p, settings) === stock));
    if (search) list = list.filter((p) => [p.name, p.sku, p.brand, ...(p.tags || [])].join(' ').toLowerCase().includes(search));
    const sorters = {
      newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      name: (a, b) => a.name.localeCompare(b.name),
      'price-desc': (a, b) => b.price - a.price,
      'price-asc': (a, b) => a.price - b.price,
      'stock-asc': (a, b) => a.stock - b.stock,
      bestsellers: (a, b) => (sales.get(b.id)?.units || 0) - (sales.get(a.id)?.units || 0),
      updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))
    };
    list.sort(sorters[sort] || sorters.newest);
    [...selected].forEach((id) => { if (!products.some((p) => p.id === id)) selected.delete(id); });

    el.innerHTML = `
      <div class="page-head"><div><h2>Products</h2><p>${counts.active} active · ${counts.draft} draft · ${counts.archived} archived</p></div>
        <div class="page-actions"><button class="btn btn-outline" type="button" data-import>${I('upload')}Import</button><button class="btn btn-outline" type="button" data-export>${I('download')}Export</button><a class="btn btn-primary" href="#/products/new">${I('plus')}Add product</a></div></div>
      <div class="card">
        <div class="tabs">${[['active', 'Active'], ['draft', 'Drafts'], ['archived', 'Archived'], ['all', 'All']].map(([id, l]) => `<button type="button" data-tab="${id}" class="${tab === id ? 'is-on' : ''}">${l}<span class="n">${counts[id] || 0}</span></button>`).join('')}</div>
        <div class="toolbar">
          <label class="affix search">${I('search')}<input class="input" type="search" data-search placeholder="Search name, SKU, brand or tag" value="${esc(q.get('q') || '')}" aria-label="Search products"></label>
          <select class="select" data-filter="cat" aria-label="Category"><option value="">All categories</option>${categories.map((c) => `<option value="${esc(c.id)}" ${cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <select class="select" data-filter="stock" aria-label="Stock"><option value="">All stock levels</option>${[['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['pre', 'Pre-order only']].map(([v, l]) => `<option value="${v}" ${stock === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="toolbar-right"><select class="select" data-filter="sort" aria-label="Sort">${[['newest', 'Newest'], ['updated', 'Recently updated'], ['bestsellers', 'Best sellers'], ['name', 'Name A–Z'], ['price-desc', 'Price high–low'], ['price-asc', 'Price low–high'], ['stock-asc', 'Stock low–high']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        ${selected.size ? `<div class="bulkbar"><span>${selected.size} selected</span>
          <button class="btn btn-outline btn-sm" type="button" data-bulk="active">Set active</button><button class="btn btn-outline btn-sm" type="button" data-bulk="draft">Set draft</button>
          <button class="btn btn-outline btn-sm" type="button" data-bulk="archived">Archive</button><button class="btn btn-outline btn-sm" type="button" data-bulk="feature">Feature</button><button class="btn btn-outline btn-sm" type="button" data-bulk="delete">Delete</button>
          <button class="btn btn-ghost btn-sm" type="button" data-bulk="clear" style="margin-left:auto;color:#fff">Clear</button></div>` : ''}
        ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr>
            <th class="w-check"><input class="cb" type="checkbox" data-all aria-label="Select all" ${list.length && list.slice(0, shown).every((p) => selected.has(p.id)) ? 'checked' : ''}></th>
            <th>Product</th><th>Category</th><th class="r">Price</th><th>Stock</th><th class="r">Sold</th><th>Status</th><th class="r">Actions</th></tr></thead><tbody>
          ${list.slice(0, shown).map((p) => {
            const s = sales.get(p.id);
            return `<tr class="clickable ${selected.has(p.id) ? 'is-selected' : ''}" data-id="${esc(p.id)}">
              <td class="w-check"><input class="cb" type="checkbox" data-sel="${esc(p.id)}" ${selected.has(p.id) ? 'checked' : ''} aria-label="Select ${esc(p.name)}"></td>
              <td><div class="cell-product"><img src="${esc(thumb(p.images?.[0]))}" alt="" loading="lazy"><div style="min-width:0"><strong>${esc(p.name)}${p.featured ? ` <span title="Featured" style="color:#eda100">★</span>` : ''}</strong><span>${esc(p.sku)}${p.options?.length ? ` · ${p.options.map((g) => `${g.values.length} ${esc(g.name.toLowerCase())}s`).join(', ')}` : ''}</span></div></div></td>
              <td class="muted">${esc(catName(p.categoryId))}</td>
              <td class="r"><strong class="num">${money(p.price)}</strong>${p.compareAtPrice ? `<span class="cell-sub num" style="text-decoration:line-through">${money(p.compareAtPrice)}</span>` : ''}</td>
              <td><div class="stock-cell"><span class="stock-num">${p.trackInventory === false ? '∞' : p.stock}</span>${pill.stock(p, settings)}</div></td>
              <td class="r num">${s ? `<strong>${s.units}</strong><span class="cell-sub">${fmt.compact(s.revenue)}</span>` : '<span class="subtle">0</span>'}</td>
              <td>${pill.product(p.status)}</td>
              <td><div class="row-actions">
                <button class="icon-btn" type="button" data-stock="${esc(p.id)}" title="Adjust stock" aria-label="Adjust stock">${I('box')}</button>
                <a class="icon-btn" href="product.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="View in store" aria-label="View in store" data-stop>${I('external')}</a>
                <button class="icon-btn" type="button" data-dup="${esc(p.id)}" title="Duplicate" aria-label="Duplicate">${I('copy')}</button>
                <button class="icon-btn danger" type="button" data-del="${esc(p.id)}" title="Delete" aria-label="Delete">${I('trash')}</button>
              </div></td></tr>`;
          }).join('')}
        </tbody></table></div>
        <div class="table-foot"><span>${list.length > shown ? `Showing ${shown} of ${list.length}` : `${list.length} product${list.length === 1 ? '' : 's'}`}</span>${list.length > shown ? `<button class="btn btn-outline btn-sm" type="button" data-more>Show more</button>` : ''}</div>`
        : `<div class="empty"><div class="e-icon">${I('tag')}</div><h4>No products found</h4><p>${products.length ? 'Try a different tab, filter or search.' : 'Add your first product to start selling.'}</p><a class="btn btn-primary" href="#/products/new">${I('plus')}Add product</a></div>`}
      </div>`;

    const re = () => Admin.render();
    el.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-stop]')) return;
      const tabBtn = t.closest('[data-tab]');
      if (tabBtn) { selected.clear(); Admin.setQuery({ status: tabBtn.dataset.tab === 'active' ? null : tabBtn.dataset.tab }); re(); return; }
      if (t.matches('[data-all]')) { list.slice(0, shown).forEach((p) => (t.checked ? selected.add(p.id) : selected.delete(p.id))); re(); return; }
      const sel = t.closest('[data-sel]');
      if (sel) { sel.checked ? selected.add(sel.dataset.sel) : selected.delete(sel.dataset.sel); re(); return; }
      if (t.closest('.w-check')) return;
      const stockBtn = t.closest('[data-stock]');
      if (stockBtn) { Admin.stockModal(stockBtn.dataset.stock, { type: 'restock' }); return; }
      const dup = t.closest('[data-dup]');
      if (dup) {
        const p = products.find((x) => x.id === dup.dataset.dup);
        const { id, sku, slug, stock, createdAt, updatedAt, ...rest } = p;
        const copy = await DB.products.save({ ...rest, name: `${p.name} (copy)`, status: 'draft' });
        Admin.invalidate('products');
        Admin.toast('Product duplicated', { sub: 'Saved as a draft so you can edit it first.' });
        Admin.go(`#/products/${copy.id}`);
        return;
      }
      const del = t.closest('[data-del]');
      if (del) { await deleteProducts([del.dataset.del], products, sales); return; }
      const bulk = t.closest('[data-bulk]');
      if (bulk) {
        const ids = [...selected];
        const a = bulk.dataset.bulk;
        if (a === 'clear') { selected.clear(); re(); return; }
        if (a === 'delete') { if (await deleteProducts(ids, products, sales)) selected.clear(); return; }
        await DB.products.bulkUpdate(ids, a === 'feature' ? { featured: true } : { status: a });
        Admin.invalidate('products');
        Admin.toast(`${ids.length} product${ids.length === 1 ? '' : 's'} updated`);
        selected.clear();
        re();
        return;
      }
      if (t.closest('[data-more]')) { shown += 60; re(); return; }
      if (t.closest('[data-export]')) {
        Admin.csv(`chibest-products-${Admin.today()}.csv`, [...CSV_COLS, 'Units sold', 'Revenue', 'Store URL'],
          list.map((p) => [p.sku, p.name, catName(p.categoryId), p.price, p.compareAtPrice || '', p.costPrice || '', p.stock, p.lowStockThreshold, p.allowPreorder ? 'yes' : 'no', p.leadTime, p.status, p.featured ? 'yes' : 'no', p.brand, p.badge, (p.tags || []).join(', '), p.description, (p.images || []).filter((s) => !s.startsWith('data:')).join(' | '), sales.get(p.id)?.units || 0, sales.get(p.id)?.revenue || 0, Admin.storeUrl(`product.html?p=${p.slug}`)]));
        return;
      }
      if (t.closest('[data-import]')) { importCsv(); return; }
      const row = t.closest('tr[data-id]');
      if (row) Admin.go(`#/products/${row.dataset.id}`);
    };
    let tm;
    $('[data-search]', el).addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { Admin.setQuery({ q: e.target.value }); re(); }, 250); });
    $$('[data-filter]', el).forEach((s) => s.addEventListener('change', () => { Admin.setQuery({ [s.dataset.filter]: s.value }); re(); }));
    if (search) { const s = $('[data-search]', el); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  async function deleteProducts(ids, products, sales) {
    const sold = ids.filter((id) => sales.get(id)?.units);
    const names = ids.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
    const ok = await Admin.confirm({
      title: ids.length === 1 ? `Delete "${names[0]}"?` : `Delete ${ids.length} products?`,
      text: `${sold.length ? `<strong>${sold.length === 1 && ids.length === 1 ? 'This product has' : `${sold.length} of these have`} sales history.</strong> Past orders keep their details, but consider <em>archiving</em> instead so you keep reports tidy. ` : ''}This permanently removes the product${ids.length === 1 ? '' : 's'} from your store.`,
      confirm: 'Delete permanently', danger: true
    });
    if (!ok) return false;
    await DB.products.remove(ids);
    Admin.invalidate('products');
    Admin.toast(`${ids.length} product${ids.length === 1 ? '' : 's'} deleted`);
    if (Admin.parseRoute().id) Admin.go('#/products'); else Admin.render();
    return true;
  }

  // ---------------------------------------------------------------
  // Product editor
  // ---------------------------------------------------------------
  async function renderEditor(el, route, isCurrent) {
    const isNew = route.id === 'new';
    const { products, categories, settings, orders } = await Admin.load('products', 'categories', 'settings', 'orders');
    if (!isCurrent()) return;
    const existing = isNew ? null : products.find((p) => p.id === route.id);
    if (!isNew && !existing) {
      el.innerHTML = `<div class="card"><div class="empty"><div class="e-icon">${I('tag')}</div><h4>Product not found</h4><p>It may have been deleted.</p><a class="btn btn-outline" href="#/products">Back to products</a></div></div>`;
      return;
    }
    const p = existing ? DB.util.clone(existing) : {
      name: '', description: '', categoryId: route.query.get('cat') || categories[0]?.id || '', brand: '', price: '', compareAtPrice: '', costPrice: '', lowStockThreshold: settings.inventory?.defaultLowStock ?? 5,
      trackInventory: true, allowPreorder: false, leadTime: '', images: [], options: [], badge: '', featured: false, tags: [], status: 'active', sku: ''
    };
    p.options = p.options || [];
    p.images = p.images || [];
    p.tags = p.tags || [];
    const opening = { stock: 0, cost: '' };
    Admin.setTitle(isNew ? 'New product' : p.name, '<a href="#/products">Products</a>');
    const s = salesByProduct(orders).get(p.id);
    const movements = existing ? (await DB.inventory.movements({ productId: p.id, limit: 6 })) : [];
    if (!isCurrent()) return;

    el.innerHTML = `
      <form class="editor" data-editor novalidate>
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-head"><h3>Product details</h3></div><div class="card-body stack">
            <div class="field" data-f="name"><label for="e-name">Name</label><input class="input" id="e-name" name="name" value="${esc(p.name)}" placeholder="e.g. Kids' Light-Up LED Sneakers" required></div>
            <div class="field" data-f="description"><label for="e-desc">Description <span class="opt">first line shows near the price</span></label><textarea class="textarea" id="e-desc" name="description" rows="6" placeholder="What is it, what's it made of, who is it for? Mention sizes, materials and what's in the box.">${esc(p.description)}</textarea></div>
            <div class="grid-2">
              <div class="field" data-f="brand"><label for="e-brand">Brand <span class="opt">optional</span></label><input class="input" id="e-brand" name="brand" value="${esc(p.brand)}"></div>
              <div class="field" data-f="badge"><label for="e-badge">Badge <span class="opt">optional</span></label><input class="input" id="e-badge" name="badge" value="${esc(p.badge)}" placeholder="New, Bestseller, Hot…" list="badge-list"><datalist id="badge-list"><option>New</option><option>Bestseller</option><option>Hot</option><option>Back to school</option><option>Premium</option><option>Bundle</option><option>Limited</option></datalist></div>
            </div>
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Photos</h3><p>The first photo is the main image. Drag to reorder.</p></div><span class="muted" data-img-count></span></div>
            <div class="card-body"><div class="media-grid" data-media></div></div></div>

          <div class="card"><div class="card-head"><h3>Pricing</h3></div><div class="card-body stack">
            <div class="grid-3">
              <div class="field" data-f="price"><label for="e-price">Selling price</label><div class="affix"><span>₦</span><input class="input num" id="e-price" name="price" type="number" min="0" step="50" inputmode="numeric" value="${esc(p.price)}"></div></div>
              <div class="field" data-f="compareAtPrice"><label for="e-compare">Compare-at price <span class="opt">was</span></label><div class="affix"><span>₦</span><input class="input num" id="e-compare" name="compareAtPrice" type="number" min="0" step="50" inputmode="numeric" value="${esc(p.compareAtPrice ?? '')}"></div></div>
              <div class="field" data-f="costPrice"><label for="e-cost">Cost per item <span class="opt">landed</span></label><div class="affix"><span>₦</span><input class="input num" id="e-cost" name="costPrice" type="number" min="0" step="50" inputmode="numeric" value="${esc(p.costPrice ?? '')}"></div></div>
            </div>
            <div class="margin-box" data-margin></div>
            <p class="hint">Cost is your landed cost per unit (item + shipping + clearing). It's private and used for profit reports. Receiving stock at a new cost updates it automatically as a weighted average.</p>
          </div></div>

          <div class="card"><div class="card-head"><h3>Inventory</h3>${existing ? `<a class="card-link" href="#/inventory?view=history&product=${esc(p.id)}">Full history ${I('arrow-right')}</a>` : ''}</div><div class="card-body stack">
            <div class="grid-2">
              <div class="field" data-f="sku"><label for="e-sku">SKU</label><input class="input" id="e-sku" name="sku" value="${esc(p.sku)}" placeholder="Auto-generated if empty" style="text-transform:uppercase"></div>
              <div class="field" data-f="lowStockThreshold"><label for="e-low">Low stock alert at</label><input class="input num" id="e-low" name="lowStockThreshold" type="number" min="0" value="${esc(p.lowStockThreshold)}"></div>
            </div>
            <label class="switch"><div><strong>Track inventory</strong><small>Count stock and stop selling when it runs out (unless pre-orders are on).</small></div><input type="checkbox" name="trackInventory" ${p.trackInventory !== false ? 'checked' : ''}><span class="track"></span></label>
            ${isNew ? `<div class="grid-2" data-opening>
                <div class="field"><label for="e-open">Opening stock</label><input class="input num" id="e-open" type="number" min="0" value="0" data-open-stock></div>
                <div class="field"><label for="e-open-cost">Unit cost of this stock <span class="opt">defaults to cost</span></label><div class="affix"><span>₦</span><input class="input num" id="e-open-cost" type="number" min="0" data-open-cost></div></div>
              </div><p class="hint">Opening stock is recorded in the inventory ledger. Later changes are made with stock adjustments so every unit stays traceable.</p>`
            : `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px;border-radius:12px;background:var(--surface-2)">
                <div><div class="muted" style="font-size:12px;font-weight:650">On hand</div><div style="font-size:26px;font-weight:780;letter-spacing:-0.03em" class="num">${p.trackInventory === false ? '∞' : p.stock}</div></div>
                <div>${pill.stock(p, settings)}</div>
                <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" type="button" data-adjust="restock">${I('plus')}Receive stock</button><button class="btn btn-outline btn-sm" type="button" data-adjust="adjustment">${I('scan')}Stock count</button><button class="btn btn-outline btn-sm" type="button" data-adjust="damage">${I('minus')}Write off</button></div>
              </div>
              ${movements.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Movement</th><th class="r">Change</th><th class="r">Balance</th><th>Reference</th></tr></thead><tbody>${movements.map((m) => `<tr><td class="nowrap">${fmt.dateTime(m.at)}</td><td>${pill.movement(m.type)}</td><td class="r ${m.change >= 0 ? 'change-pos' : 'change-neg'}">${m.change > 0 ? '+' : ''}${m.change}</td><td class="r num">${m.balanceAfter}</td><td class="muted ellipsis" style="max-width:180px">${esc(m.reference || m.note)}</td></tr>`).join('')}</tbody></table></div>` : ''}`}
            <label class="switch"><div><strong>Allow pre-orders</strong><small>Keep selling when stock is 0. Orders are marked "pre-order" so you know what to buy from suppliers.</small></div><input type="checkbox" name="allowPreorder" ${p.allowPreorder ? 'checked' : ''}><span class="track"></span></label>
            <div class="field" data-f="leadTime" data-lead ${p.allowPreorder ? '' : 'hidden'}><label for="e-lead">Pre-order delivery time</label><input class="input" id="e-lead" name="leadTime" value="${esc(p.leadTime)}" placeholder="${esc(settings.preorderLeadTime)} (store default)"></div>
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Options</h3><p>Sizes, colours or styles customers choose from.</p></div></div><div class="card-body stack">
            <div class="stack" data-options style="gap:10px"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="hint" style="margin-right:4px">Quick add:</span>${Object.keys(PRESETS).map((k) => `<button class="btn btn-outline btn-sm" type="button" data-preset="${esc(k)}">${esc(k)}</button>`).join('')}<button class="btn btn-ghost btn-sm" type="button" data-add-option>${I('plus')}Custom option</button></div>
          </div></div>
        </div>

        <div class="editor-side">
          <div class="card"><div class="card-head"><h3>Status</h3></div><div class="card-body stack">
            <select class="select" name="status" aria-label="Status"><option value="active" ${p.status === 'active' ? 'selected' : ''}>Active · visible in store</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft · hidden</option><option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Archived · hidden</option></select>
            <label class="switch"><div><strong>Featured</strong><small>Show on the homepage "Trending now" section.</small></div><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span class="track"></span></label>
          </div></div>
          <div class="card"><div class="card-head"><h3>Organisation</h3></div><div class="card-body stack">
            <div class="field" data-f="categoryId"><label for="e-cat">Category <a class="card-link" href="#/categories">Manage</a></label><select class="select" id="e-cat" name="categoryId">${categories.map((c) => `<option value="${esc(c.id)}" ${p.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><span class="label">Tags <span class="opt">help search</span></span><div class="chips-input" data-tags></div></div>
          </div></div>
          <div class="card"><div class="card-head"><h3>Storefront preview</h3>${existing ? `<a class="card-link" href="product.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Open ${I('external')}</a>` : ''}</div><div class="card-body"><div class="preview-card" data-preview></div></div></div>
          ${existing ? `<div class="card"><div class="card-head"><h3>Performance</h3><span class="muted" style="font-size:12px">all time</span></div><div class="card-body"><dl class="kv">
            <dt>Units sold</dt><dd class="num">${s?.units || 0}</dd><dt>Revenue</dt><dd class="num">${money(s?.revenue || 0)}</dd><dt>Last sold</dt><dd>${s?.last ? fmt.relative(s.last) : 'Never'}</dd><dt>Added</dt><dd>${fmt.date(p.createdAt)}</dd><dt>Updated</dt><dd>${fmt.relative(p.updatedAt)}</dd></dl></div></div>
          <button class="btn btn-danger btn-block" type="button" data-delete>${I('trash')}Delete product</button>` : ''}
        </div>
      </form>
      <div class="savebar" data-savebar><span class="unsaved"><span class="dot"></span><span data-save-state>${isNew ? 'New product' : 'All changes saved'}</span></span>
        <div style="display:flex;gap:8px"><a class="btn btn-outline" href="#/products" data-discard>${isNew ? 'Cancel' : 'Back'}</a><button class="btn btn-brand" type="button" data-save>${I('check')}${isNew ? 'Save product' : 'Save changes'}</button></div></div>`;

    const form = $('[data-editor]', el);
    const dirty = () => {
      Admin.markDirty(true);
      $('[data-savebar]', el).classList.add('is-dirty');
      $('[data-save-state]', el).textContent = 'Unsaved changes';
      $('[data-discard]', el).textContent = 'Discard';
    };

    // ----- Media -----
    const media = $('[data-media]', el);
    let dragFrom = null;
    const renderMedia = () => {
      media.innerHTML = p.images.map((src, i) => `<div class="media-item" draggable="true" data-i="${i}">${i === 0 ? '<span class="primary">Main</span>' : ''}<img src="${esc(thumb(src))}" alt="Product photo ${i + 1}">
        <div class="m-actions">${i ? `<button type="button" data-main="${i}" title="Make main photo" aria-label="Make main photo">${I('star')}</button>` : ''}<button type="button" data-rm-img="${i}" title="Remove" aria-label="Remove photo">${I('trash')}</button></div></div>`).join('') +
        `<label class="media-add">${I('upload')}Upload<input type="file" accept="image/*" multiple data-upload aria-label="Upload photos"></label>
         <button class="media-add" type="button" data-library>${I('image')}From library</button>
         <button class="media-add" type="button" data-url>${I('link')}From URL</button>`;
      $('[data-img-count]', el).textContent = `${p.images.length} photo${p.images.length === 1 ? '' : 's'}`;
      renderPreview();
    };
    media.addEventListener('dragstart', (e) => { const it = e.target.closest('.media-item'); if (!it) return; dragFrom = +it.dataset.i; it.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
    media.addEventListener('dragover', (e) => { const it = e.target.closest('.media-item'); if (it && dragFrom != null) { e.preventDefault(); $$('.drop-target', media).forEach((x) => x.classList.remove('drop-target')); it.classList.add('drop-target'); } });
    media.addEventListener('drop', (e) => {
      const it = e.target.closest('.media-item');
      if (!it || dragFrom == null) return;
      e.preventDefault();
      const to = +it.dataset.i;
      const [moved] = p.images.splice(dragFrom, 1);
      p.images.splice(to, 0, moved);
      dragFrom = null; dirty(); renderMedia();
    });
    media.addEventListener('dragend', () => { dragFrom = null; $$('.is-dragging, .drop-target', media).forEach((x) => x.classList.remove('is-dragging', 'drop-target')); });
    media.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-upload]')) return;
      const files = [...e.target.files];
      e.target.value = '';
      for (const f of files) {
        const tile = document.createElement('div');
        tile.className = 'media-item';
        tile.innerHTML = '<div class="skeleton" style="width:100%;height:100%;background:var(--surface-3)"></div>';
        media.insertBefore(tile, $('.media-add', media));
        try { p.images.push(await DB.media.upload(f)); dirty(); }
        catch (err) { Admin.toast(err.message, { type: 'error' }); }
      }
      renderMedia();
    });
    media.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm-img]');
      if (rm) { p.images.splice(+rm.dataset.rmImg, 1); dirty(); renderMedia(); return; }
      const mk = e.target.closest('[data-main]');
      if (mk) { const [img] = p.images.splice(+mk.dataset.main, 1); p.images.unshift(img); dirty(); renderMedia(); return; }
      if (e.target.closest('[data-library]')) { libraryPicker((srcs) => { srcs.forEach((s2) => { if (!p.images.includes(s2)) p.images.push(s2); }); dirty(); renderMedia(); }); return; }
      if (e.target.closest('[data-url]')) {
        Admin.modal({
          title: 'Add image from URL', body: `<div class="field"><label for="img-url">Image address</label><input class="input" id="img-url" type="url" placeholder="https://…/photo.jpg" autofocus></div>`,
          foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-ok>Add image</button>`,
          onMount(m) { m.$('[data-ok]').addEventListener('click', () => { const v = m.$('#img-url').value.trim(); if (/^https?:\/\//.test(v) || v.startsWith('images/')) { p.images.push(v); dirty(); renderMedia(); m.close(); } else Admin.toast('Enter a full image URL', { type: 'error' }); }); }
        });
      }
    });

    // ----- Options -----
    const optRoot = $('[data-options]', el);
    const renderOptions = () => {
      optRoot.innerHTML = p.options.length ? p.options.map((g, i) => `<div class="opt-row" data-opt="${i}"><input class="input" value="${esc(g.name)}" data-opt-name placeholder="Option name" aria-label="Option name"><div class="chips-input" data-opt-values></div><button class="icon-btn danger" type="button" data-rm-opt="${i}" aria-label="Remove option">${I('trash')}</button></div>`).join('')
        : '<p class="hint">No options. Customers buy this product as-is.</p>';
      $$('[data-opt]', optRoot).forEach((row) => {
        const g = p.options[+row.dataset.opt];
        chipsInput($('[data-opt-values]', row), g.values, () => { dirty(); renderPreview(); }, 'Add values, e.g. Red, Blue');
        $('[data-opt-name]', row).addEventListener('input', (e) => { g.name = e.target.value; dirty(); });
      });
    };
    optRoot.addEventListener('click', (e) => { const b = e.target.closest('[data-rm-opt]'); if (b) { p.options.splice(+b.dataset.rmOpt, 1); dirty(); renderOptions(); } });
    el.addEventListener('click', (e) => {
      const pr = e.target.closest('[data-preset]');
      if (pr) { const preset = PRESETS[pr.dataset.preset]; const ex = p.options.find((g) => g.name === preset.name); if (ex) ex.values = [...new Set([...ex.values, ...preset.values])]; else p.options.push({ name: preset.name, values: [...preset.values] }); dirty(); renderOptions(); }
      if (e.target.closest('[data-add-option]')) { p.options.push({ name: '', values: [] }); dirty(); renderOptions(); $$('[data-opt-name]', optRoot).pop()?.focus(); }
    });

    // ----- Tags -----
    chipsInput($('[data-tags]', el), p.tags, () => dirty(), 'e.g. sneakers, school');

    // ----- Live preview & margin -----
    function renderPreview() {
      const price = Number(form.price.value) || 0, compare = Number(form.compareAtPrice.value) || 0, cost = Number(form.costPrice.value) || 0;
      const cat = categories.find((c) => c.id === form.categoryId.value);
      const sale = compare > price && price > 0;
      $('[data-preview]', el).innerHTML = `<div class="pc-img">${p.images[0] ? `<img src="${esc(thumb(p.images[0]))}" alt="">` : `<div class="empty-chart" style="height:100%">${I('image')}</div>`}${form.badge.value ? `<span class="pc-badge">${esc(form.badge.value)}</span>` : sale ? `<span class="pc-badge" style="background:var(--brand)">-${Math.round((1 - price / compare) * 100)}%</span>` : ''}</div>
        <div class="pc-body"><span class="pc-cat">${esc(cat?.name || '')}</span><span class="pc-name">${esc(form.name.value || 'Product name')}</span><span><span class="pc-price ${sale ? 'sale' : ''}">${price ? money(price) : '₦0'}</span>${sale ? `<span class="pc-was">${money(compare)}</span>` : ''}</span></div>`;
      const profit = price - cost;
      $('[data-margin]', el).innerHTML = `<div><span>Profit per item</span><strong style="color:${cost && profit < 0 ? 'var(--brand)' : 'inherit'}">${cost && price ? money(profit) : '—'}</strong></div><div><span>Margin</span><strong>${cost && price ? fmt.pct((profit / price) * 100) : '—'}</strong></div><div><span>Markup</span><strong>${cost && price ? fmt.pct((profit / cost) * 100) : '—'}</strong></div>`;
    }

    form.addEventListener('input', (e) => { if (!e.target.closest('[data-tags], [data-opt-values]')) dirty(); renderPreview(); });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'allowPreorder') $('[data-lead]', el).hidden = !e.target.checked;
      dirty();
    });
    el.addEventListener('click', (e) => {
      const adj = e.target.closest('[data-adjust]');
      if (adj) {
        if (Admin.state.dirty) { Admin.toast('Save your changes first', { type: 'error', sub: 'Then adjust stock.' }); return; }
        Admin.stockModal(p.id, { type: adj.dataset.adjust, onDone: () => Admin.render() });
      }
    });

    async function save() {
      const btn = $('[data-save]', el);
      const data = Object.fromEntries(new FormData(form));
      const input = {
        ...(existing ? { id: existing.id } : {}),
        name: data.name, description: data.description, brand: data.brand, badge: data.badge, price: data.price, compareAtPrice: data.compareAtPrice, costPrice: data.costPrice,
        sku: data.sku, lowStockThreshold: data.lowStockThreshold, trackInventory: !!form.trackInventory.checked, allowPreorder: !!form.allowPreorder.checked,
        leadTime: data.leadTime, status: data.status, featured: !!form.featured.checked, categoryId: data.categoryId, tags: p.tags, images: p.images,
        options: p.options.filter((g) => g.name.trim() && g.values.length)
      };
      const openStock = isNew ? parseInt($('[data-open-stock]', el).value || '0', 10) : 0;
      const openCost = isNew && $('[data-open-cost]', el).value !== '' ? Number($('[data-open-cost]', el).value) : null;
      if (isNew && (openStock < 0 || Number.isNaN(openStock))) { Admin.toast('Opening stock must be 0 or more', { type: 'error' }); return; }
      btn.classList.add('is-loading');
      try {
        const saved = await DB.products.save(input, { openingStock: openStock, openingCost: openCost });
        Admin.invalidate('products', 'movements');
        Admin.markDirty(false);
        Admin.toast(isNew ? 'Product created' : 'Changes saved', { sub: saved.name });
        if (isNew) Admin.go(`#/products/${saved.id}`, { replace: true }); else Admin.render();
      } catch (err) {
        btn.classList.remove('is-loading');
        if (err.details) Admin.fieldErrors(form, err.details);
        Admin.toast(err.message, { type: 'error' });
      }
    }
    $('[data-save]', el).addEventListener('click', save);
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    el.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    $('[data-delete]', el)?.addEventListener('click', () => deleteProducts([p.id], products, salesByProduct(orders)));
    $('[data-discard]', el).addEventListener('click', (e) => { if (Admin.state.dirty && !isNew) { e.preventDefault(); Admin.markDirty(false); Admin.render(); } else Admin.markDirty(false); });

    renderMedia();
    renderOptions();
    renderPreview();
    if (isNew) form.name.focus();
  }

  Admin.view('products', {
    live: true,
    render(el, route, isCurrent) {
      if (route.id) { this.live = false; return renderEditor(el, route, isCurrent); }
      this.live = true;
      return renderList(el, route, isCurrent);
    }
  });
})();
