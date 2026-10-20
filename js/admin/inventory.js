// Inventory: stock levels, movement ledger, adjustments, shipments and purchase list.
(function () {
  const { I, $, $$, esc, money, fmt, thumb, pill, stockState } = Admin;
  const TYPES = [
    { id: 'restock', label: 'Receive stock', icon: 'plus', hint: 'New stock arrived from a supplier or shipment.' },
    { id: 'return', label: 'Customer return', icon: 'rotate-ccw', hint: 'A customer returned an item in sellable condition.' },
    { id: 'damage', label: 'Write off', icon: 'minus', hint: 'Damaged, lost, expired or used as a sample.' },
    { id: 'adjustment', label: 'Stock count', icon: 'scan', hint: 'Set the exact number you counted on the shelf.' }
  ];

  // ---------------------------------------------------------------
  // Single-product adjustment
  // ---------------------------------------------------------------
  async function stockModal(productId, { type = 'restock', onDone } = {}) {
    const { products } = await Admin.load('products');
    const p = products.find((x) => x.id === productId);
    if (!p) { Admin.toast('Product not found', { type: 'error' }); return; }
    if (p.trackInventory === false) { Admin.toast('Inventory tracking is off for this product', { type: 'error', sub: 'Turn it on in the product editor first.' }); return; }
    let current = type;
    Admin.modal({
      title: 'Adjust stock', size: 'lg',
      body: `<div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:12px;background:var(--surface-2);margin-bottom:16px">
          <img class="thumb-sm" src="${esc(thumb(p.images?.[0]))}" alt=""><div style="min-width:0;flex:1"><strong class="ellipsis" style="display:block">${esc(p.name)}</strong><span class="muted num" style="font-size:12.5px">${esc(p.sku)}</span></div>
          <div style="text-align:right"><div class="muted" style="font-size:12px;font-weight:650">On hand</div><div style="font-size:22px;font-weight:780" class="num">${p.stock}</div></div></div>
        <div class="seg" role="radiogroup" aria-label="Adjustment type" style="display:flex;margin-bottom:6px">${TYPES.map((t) => `<button type="button" role="radio" data-type="${t.id}" style="flex:1">${t.label}</button>`).join('')}</div>
        <p class="hint" data-type-hint style="margin-bottom:14px"></p>
        <form class="stack" data-adjust-form novalidate>
          <div class="grid-2">
            <div class="field" data-f="qty"><label for="a-qty" data-qty-label>Quantity</label><input class="input num" id="a-qty" name="qty" type="number" min="0" inputmode="numeric" autofocus></div>
            <div class="field" data-cost-field><label for="a-cost">Unit cost <span class="opt">landed</span></label><div class="affix"><span>₦</span><input class="input num" id="a-cost" name="unitCost" type="number" min="0" value="${esc(p.costPrice || '')}"></div></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="a-ref" data-ref-label>Reference</label><input class="input" id="a-ref" name="reference" placeholder="e.g. Shipment GZ-0412"></div>
            <div class="field"><label for="a-note">Note <span class="opt">optional</span></label><input class="input" id="a-note" name="note"></div>
          </div>
          <div class="preview-change" aria-live="polite"><span class="muted">On hand</span><b>${p.stock}</b>${I('arrow-right')}<b data-after>${p.stock}</b><span data-diff class="muted"></span></div>
        </form>`,
      foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>Save adjustment</button>`,
      onMount(m) {
        const form = m.$('[data-adjust-form]');
        const setType = (t) => {
          current = t;
          const def = TYPES.find((x) => x.id === t);
          $$('[data-type]', m.el).forEach((b) => { b.classList.toggle('is-on', b.dataset.type === t); b.setAttribute('aria-checked', b.dataset.type === t); });
          m.$('[data-type-hint]').textContent = def.hint;
          m.$('[data-qty-label]').textContent = t === 'adjustment' ? 'Counted quantity' : t === 'damage' ? 'Quantity to write off' : 'Quantity received';
          m.$('[data-cost-field]').hidden = t !== 'restock';
          m.$('[data-ref-label]').innerHTML = t === 'restock' ? 'Supplier / shipment ref' : 'Reference <span class="opt">optional</span>';
          form.reference.placeholder = t === 'restock' ? 'e.g. Shipment GZ-0412' : t === 'return' ? 'Order number' : t === 'adjustment' ? 'e.g. Monthly count' : 'e.g. Water damage';
          update();
        };
        const update = () => {
          const v = parseInt(form.qty.value, 10);
          const after = Number.isNaN(v) ? p.stock : current === 'adjustment' ? v : p.stock + (current === 'damage' ? -v : v);
          m.$('[data-after]').textContent = after;
          m.$('[data-after]').style.color = after < 0 ? 'var(--brand)' : '';
          const diff = after - p.stock;
          m.$('[data-diff]').textContent = Number.isNaN(v) ? '' : `(${diff > 0 ? '+' : ''}${diff})`;
        };
        m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
        form.addEventListener('input', update);
        const submit = async () => {
          const btn = m.$('[data-save]');
          btn.classList.add('is-loading');
          try {
            const args = { productId: p.id, type: current, reference: form.reference.value, note: form.note.value, actor: Admin.state.user?.name };
            if (current === 'adjustment') args.setTo = form.qty.value; else args.qty = form.qty.value;
            if (current === 'restock' && form.unitCost.value !== '') args.unitCost = form.unitCost.value;
            const mv = await DB.inventory.adjust(args);
            Admin.invalidate('products', 'movements');
            m.close();
            Admin.toast('Stock updated', { sub: `${p.name}: ${mv.change > 0 ? '+' : ''}${mv.change} → ${mv.balanceAfter} on hand` });
            onDone ? onDone(mv) : Admin.render();
          } catch (err) {
            btn.classList.remove('is-loading');
            Admin.fieldErrors(form, err.details || { qty: err.message });
          }
        };
        m.$('[data-save]').addEventListener('click', submit);
        form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
        setType(type);
      }
    });
  }

  // ---------------------------------------------------------------
  // Receive a shipment (many products at once)
  // ---------------------------------------------------------------
  async function receiveShipment(prefill = []) {
    const { products } = await Admin.load('products');
    const tracked = products.filter((p) => p.trackInventory !== false && p.status !== 'archived').sort((a, b) => a.name.localeCompare(b.name));
    const keyOf = (p) => `${p.sku} · ${p.name}`;
    const lines = prefill.length ? prefill.map((x) => ({ ...x })) : [{ productId: '', qty: '', cost: '' }];
    Admin.modal({
      title: 'Receive a shipment', size: 'lg',
      sub: 'Add every product that arrived. Each line is recorded in the inventory ledger with the same reference.',
      body: `<datalist id="product-options">${tracked.map((p) => `<option value="${esc(keyOf(p))}"></option>`).join('')}</datalist>
        <div class="grid-2" style="margin-bottom:14px">
          <div class="field"><label for="s-ref">Shipment reference</label><input class="input" id="s-ref" placeholder="e.g. Air cargo GZ-LOS 20 Oct" autofocus></div>
          <div class="field"><label for="s-note">Supplier / note <span class="opt">optional</span></label><input class="input" id="s-note" placeholder="e.g. Guangzhou Baiyun supplier"></div>
        </div>
        <div class="table-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="table"><thead><tr><th>Product</th><th style="width:110px">Qty</th><th style="width:150px">Unit cost (₦)</th><th style="width:44px"></th></tr></thead><tbody data-lines></tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:12px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" type="button" data-add-line>${I('plus')}Add product</button><span class="muted" data-summary></span></div>`,
      foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-receive>Receive stock</button>`,
      onMount(m) {
        const body = m.$('[data-lines]');
        const render = () => {
          body.innerHTML = lines.map((l, i) => {
            const p = tracked.find((x) => x.id === l.productId);
            return `<tr data-i="${i}"><td><input class="input" list="product-options" data-k="product" value="${p ? esc(keyOf(p)) : ''}" placeholder="Search SKU or name" aria-label="Product">${p ? `<span class="cell-sub">On hand: ${p.stock}</span>` : ''}</td>
              <td><input class="input num" type="number" min="1" data-k="qty" value="${esc(l.qty)}" aria-label="Quantity"></td>
              <td><input class="input num" type="number" min="0" data-k="cost" value="${esc(l.cost)}" placeholder="${p ? esc(p.costPrice || '') : ''}" aria-label="Unit cost"></td>
              <td><button class="icon-btn danger" type="button" data-rm="${i}" aria-label="Remove line">${I('trash')}</button></td></tr>`;
          }).join('');
          summary();
        };
        const summary = () => {
          const valid = lines.filter((l) => l.productId && +l.qty > 0);
          const units = valid.reduce((s, l) => s + +l.qty, 0);
          const cost = valid.reduce((s, l) => s + +l.qty * (l.cost !== '' ? +l.cost : (tracked.find((p) => p.id === l.productId)?.costPrice || 0)), 0);
          m.$('[data-summary]').textContent = `${valid.length} product${valid.length === 1 ? '' : 's'} · ${units} units · ${money(cost)} landed cost`;
          m.$('[data-receive]').textContent = units ? `Receive ${units} unit${units === 1 ? '' : 's'}` : 'Receive stock';
        };
        body.addEventListener('change', (e) => {
          const tr = e.target.closest('tr'); if (!tr) return;
          const l = lines[+tr.dataset.i];
          if (e.target.dataset.k === 'product') {
            const p = tracked.find((x) => keyOf(x) === e.target.value || x.sku.toLowerCase() === e.target.value.trim().toLowerCase());
            l.productId = p ? p.id : '';
            if (!p && e.target.value) Admin.toast('Pick a product from the list', { type: 'error' });
            render();
            if (p) $(`tr[data-i="${tr.dataset.i}"] [data-k="qty"]`, body)?.focus();
          }
        });
        body.addEventListener('input', (e) => {
          const tr = e.target.closest('tr'); if (!tr) return;
          const k = e.target.dataset.k;
          if (k === 'qty' || k === 'cost') { lines[+tr.dataset.i][k] = e.target.value; summary(); }
        });
        m.el.addEventListener('click', async (e) => {
          const rm = e.target.closest('[data-rm]');
          if (rm) { lines.splice(+rm.dataset.rm, 1); if (!lines.length) lines.push({ productId: '', qty: '', cost: '' }); render(); return; }
          if (e.target.closest('[data-add-line]')) { lines.push({ productId: '', qty: '', cost: '' }); render(); $$('[data-k="product"]', body).pop().focus(); return; }
          if (e.target.closest('[data-receive]')) {
            const valid = lines.filter((l) => l.productId && +l.qty > 0);
            if (!valid.length) { Admin.toast('Add at least one product and quantity', { type: 'error' }); return; }
            const ref = m.$('#s-ref').value.trim() || `Shipment ${fmt.date(new Date().toISOString())}`;
            const btn = e.target.closest('[data-receive]');
            btn.classList.add('is-loading');
            let n = 0;
            for (const l of valid) {
              try {
                await DB.inventory.adjust({ productId: l.productId, type: 'restock', qty: +l.qty, unitCost: l.cost === '' ? null : +l.cost, reference: ref, note: m.$('#s-note').value, actor: Admin.state.user?.name });
                n += +l.qty;
              } catch (err) { Admin.toast(err.message, { type: 'error' }); }
            }
            Admin.invalidate('products', 'movements');
            m.close();
            Admin.toast(`Shipment received: ${n} units`, { sub: ref });
            Admin.render();
          }
        });
        render();
      }
    });
  }

  Admin.stockModal = stockModal;
  Admin.receiveShipment = receiveShipment;

  // ---------------------------------------------------------------
  // View
  // ---------------------------------------------------------------
  let historyShown = 100;

  Admin.view('inventory', {
    live: true,
    async render(el, route, isCurrent) {
      Admin.setTitle('Inventory');
      const { products, movements, categories, settings, orders } = await Admin.load('products', 'movements', 'categories', 'settings', 'orders');
      if (!isCurrent()) return;
      const q = route.query;
      const view = q.get('view') || 'levels';
      const tracked = products.filter((p) => p.trackInventory !== false && p.status !== 'archived');
      const units = tracked.reduce((s, p) => s + Math.max(0, p.stock), 0);
      const costValue = tracked.reduce((s, p) => s + Math.max(0, p.stock) * (p.costPrice || 0), 0);
      const retail = tracked.reduce((s, p) => s + Math.max(0, p.stock) * p.price, 0);
      const lowN = tracked.filter((p) => p.status === 'active' && stockState(p, settings) === 'low').length;
      const outN = tracked.filter((p) => p.status === 'active' && stockState(p, settings) === 'out').length;
      const lastMv = new Map();
      movements.forEach((m) => { if (!lastMv.has(m.productId)) lastMv.set(m.productId, m); });

      // Purchase list data
      const needs = new Map();
      orders.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).forEach((o) => o.items.filter((l) => l.preorder).forEach((l) => {
        const key = `${l.productId}#${DB.util.optionsKey(l.options)}`;
        const cur = needs.get(key) || { productId: l.productId, name: l.name, sku: l.sku, image: l.image, options: l.options, qty: 0, orders: [], oldest: o.createdAt };
        cur.qty += l.qty; cur.orders.push(o.number);
        if (o.createdAt < cur.oldest) cur.oldest = o.createdAt;
        needs.set(key, cur);
      }));
      const reorder = tracked.filter((p) => p.status === 'active' && ['low', 'out'].includes(stockState(p, settings)));
      const needUnits = [...needs.values()].reduce((s, x) => s + x.qty, 0);

      const tabs = [['levels', 'Stock levels', tracked.length], ['history', 'Movement history', movements.length], ['preorders', 'Purchase list', needs.size + reorder.length]];
      el.innerHTML = `
        <div class="page-head"><div><h2>Inventory</h2><p>Every stock change is recorded with who, when and why.</p></div>
          <div class="page-actions"><button class="btn btn-outline" type="button" data-export>${I('download')}Export</button><button class="btn btn-primary" type="button" data-shipment>${I('package')}Receive shipment</button></div></div>
        <div class="cols-6" style="margin-bottom:16px">
          ${[['Products tracked', fmt.int(tracked.length), 'tag'], ['Units on hand', fmt.int(units), 'box'], ['Stock value (cost)', money(costValue), 'wallet'], ['Retail value', money(retail), 'banknote'], ['Low stock', lowN, 'alert-triangle', lowN ? 'is-warn' : '', 'low'], ['Out of stock', outN, 'x-circle', outN ? 'is-bad' : '', 'out']]
            .map(([l, v, ic, cls, f]) => `<${f ? `button type="button" data-quick="${f}"` : 'div'} class="card stat mini-stat ${cls || ''}" style="text-align:left"><div class="stat-label">${I(ic)}${l}</div><div class="stat-value">${v}</div></${f ? 'button' : 'div'}>`).join('')}
        </div>
        <div class="card">
          <div class="tabs">${tabs.map(([id, l, n]) => `<button type="button" data-view="${id}" class="${view === id ? 'is-on' : ''}">${l}<span class="n">${n}</span></button>`).join('')}</div>
          <div data-panel></div>
        </div>`;
      const panel = $('[data-panel]', el);

      if (view === 'levels') {
        const filter = q.get('filter') || '';
        const cat = q.get('cat') || '';
        const search = (q.get('q') || '').toLowerCase();
        let list = tracked.filter((p) => (!filter || stockState(p, settings) === filter) && (!cat || p.categoryId === cat) && (!search || `${p.name} ${p.sku}`.toLowerCase().includes(search)));
        const focus = q.get('product');
        if (focus) list = list.filter((p) => p.id === focus);
        const rank = { out: 0, low: 1, pre: 2, in: 3 };
        list.sort((a, b) => rank[stockState(a, settings)] - rank[stockState(b, settings)] || a.stock - b.stock);
        panel.innerHTML = `<div class="toolbar">
            <label class="affix search">${I('search')}<input class="input" type="search" data-search placeholder="Search product or SKU" value="${esc(q.get('q') || '')}" aria-label="Search"></label>
            <select class="select" data-f="filter" aria-label="Stock status"><option value="">All stock levels</option>${[['low', 'Low stock'], ['out', 'Out of stock'], ['in', 'In stock'], ['pre', 'Pre-order only']].map(([v, l]) => `<option value="${v}" ${filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select class="select" data-f="cat" aria-label="Category"><option value="">All categories</option>${categories.map((c) => `<option value="${esc(c.id)}" ${cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            ${focus ? `<button class="chip" type="button" data-clear-focus>${esc(products.find((p) => p.id === focus)?.name || 'Product')}<span>${I('x')}</span></button>` : ''}
          </div>
          ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th class="r">On hand</th><th>Status</th><th class="r">Value (cost)</th><th>Last movement</th><th class="r">Actions</th></tr></thead><tbody>
            ${list.map((p) => { const lm = lastMv.get(p.id); return `<tr>
              <td><div class="cell-product"><img src="${esc(thumb(p.images?.[0]))}" alt="" loading="lazy"><div style="min-width:0"><strong><a href="#/products/${esc(p.id)}">${esc(p.name)}</a></strong><span>${esc(p.sku)}${p.status !== 'active' ? ` · ${p.status}` : ''}</span></div></div></td>
              <td class="r"><span class="stock-num">${p.stock}</span><span class="cell-sub">reorder at ${p.lowStockThreshold}</span></td><td>${pill.stock(p, settings)}</td>
              <td class="r num">${money(Math.max(0, p.stock) * (p.costPrice || 0))}<span class="cell-sub">${money(Math.max(0, p.stock) * p.price)} retail</span></td>
              <td>${lm ? `${pill.movement(lm.type)}<span class="cell-sub">${fmt.relative(lm.at)}</span>` : '<span class="subtle">—</span>'}</td>
              <td><div class="row-actions"><button class="btn btn-outline btn-sm" type="button" data-adj="restock" data-id="${esc(p.id)}" title="Receive stock">${I('plus')}Receive</button><button class="icon-btn" type="button" data-adj="adjustment" data-id="${esc(p.id)}" title="Stock count" aria-label="Stock count">${I('scan')}</button><button class="icon-btn" type="button" data-adj="damage" data-id="${esc(p.id)}" title="Write off" aria-label="Write off">${I('minus')}</button><a class="icon-btn" href="#/inventory?view=history&product=${esc(p.id)}" title="History" aria-label="History">${I('list')}</a></div></td></tr>`; }).join('')}
          </tbody></table></div><div class="table-foot"><span>${list.length} product${list.length === 1 ? '' : 's'}</span><span>${fmt.int(list.reduce((s, p) => s + Math.max(0, p.stock), 0))} units · ${money(list.reduce((s, p) => s + Math.max(0, p.stock) * (p.costPrice || 0), 0))} at cost</span></div>`
          : `<div class="empty"><div class="e-icon">${I('check')}</div><h4>Nothing to show</h4><p>No products match this filter.</p></div>`}`;
      }

      if (view === 'history') {
        const type = q.get('type') || '';
        const days = q.get('days') || '';
        const productId = q.get('product') || '';
        const search = (q.get('q') || '').toLowerCase();
        const since = days ? Date.now() - +days * 864e5 : 0;
        const list = movements.filter((m) => (!type || m.type === type) && (!productId || m.productId === productId) && (!since || new Date(m.at).getTime() >= since) &&
          (!search || `${m.productName} ${m.sku} ${m.reference} ${m.note}`.toLowerCase().includes(search)));
        const inUnits = list.filter((m) => m.change > 0).reduce((s, m) => s + m.change, 0);
        const outUnits = list.filter((m) => m.change < 0).reduce((s, m) => s - m.change, 0);
        panel.innerHTML = `<div class="toolbar">
            <label class="affix search">${I('search')}<input class="input" type="search" data-search placeholder="Search product, SKU, reference or note" value="${esc(q.get('q') || '')}" aria-label="Search"></label>
            <select class="select" data-f="type" aria-label="Movement type"><option value="">All movements</option>${Object.entries(DB.const.MOVEMENT_TYPES).map(([k, v]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
            <select class="select" data-f="days" aria-label="Date range"><option value="">All time</option>${[['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']].map(([v, l]) => `<option value="${v}" ${days === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${productId ? `<button class="chip" type="button" data-clear-product>${esc(products.find((p) => p.id === productId)?.name || list[0]?.productName || 'Product')}<span>${I('x')}</span></button>` : ''}
            <div class="toolbar-right muted" style="font-size:13px"><span class="change-pos">+${fmt.int(inUnits)}</span>&nbsp;in · <span class="change-neg">−${fmt.int(outUnits)}</span>&nbsp;out</div>
          </div>
          ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th class="r">Change</th><th class="r">Balance</th><th class="r">Unit cost</th><th>Reference</th><th>By</th></tr></thead><tbody>
            ${list.slice(0, historyShown).map((m) => `<tr>
              <td class="nowrap">${fmt.date(m.at)}<span class="cell-sub">${fmt.time(m.at)}</span></td>
              <td><strong style="font-weight:650">${products.some((p) => p.id === m.productId) ? `<a href="#/inventory?view=history&product=${esc(m.productId)}">${esc(m.productName)}</a>` : esc(m.productName)}</strong><span class="cell-sub num">${esc(m.sku)}</span></td>
              <td>${pill.movement(m.type)}</td>
              <td class="r ${m.change > 0 ? 'change-pos' : m.change < 0 ? 'change-neg' : 'muted'}">${m.change > 0 ? '+' : ''}${m.change}</td>
              <td class="r num"><strong>${m.balanceAfter}</strong></td>
              <td class="r num muted">${m.unitCost != null ? money(m.unitCost) : '—'}</td>
              <td style="max-width:240px">${m.reference && /^CB\d{6}-/.test(m.reference) ? `<a class="card-link" href="#/orders/${esc(m.reference)}">${esc(m.reference)}</a>` : esc(m.reference)}${m.note ? `<span class="cell-sub ellipsis">${esc(m.note)}</span>` : ''}</td>
              <td class="muted">${esc(m.actor)}</td></tr>`).join('')}
          </tbody></table></div><div class="table-foot"><span>${list.length > historyShown ? `Showing ${historyShown} of ${fmt.int(list.length)}` : `${fmt.int(list.length)} movement${list.length === 1 ? '' : 's'}`}</span>${list.length > historyShown ? `<button class="btn btn-outline btn-sm" type="button" data-more>Show more</button>` : ''}</div>`
          : `<div class="empty"><div class="e-icon">${I('list')}</div><h4>No movements</h4><p>Nothing matches these filters.</p></div>`}`;
        panel.dataset.export = 'history';
        Admin.state.historyList = list;
      }

      if (view === 'preorders') {
        const rows = [...needs.values()].sort((a, b) => String(a.oldest).localeCompare(String(b.oldest)));
        panel.innerHTML = `<div class="card-body stack" style="gap:22px">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div><h3 style="font-size:15px">Pre-ordered by customers</h3><p class="muted" style="font-size:13px">Buy these from your suppliers. ${needUnits} unit${needUnits === 1 ? '' : 's'} across open orders.</p></div>
              ${rows.length ? `<button class="btn btn-outline btn-sm" type="button" data-export-pre>${I('download')}Supplier list (CSV)</button>` : ''}</div>
            ${rows.length ? `<div class="table-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="table"><thead><tr><th>Product</th><th>Options</th><th class="r">Qty needed</th><th>Orders</th><th>Waiting since</th></tr></thead><tbody>
              ${rows.map((r) => `<tr><td><div class="cell-product"><img src="${esc(thumb(r.image))}" alt=""><div><strong>${esc(r.name)}</strong><span>${esc(r.sku)}</span></div></div></td>
                <td>${Object.entries(r.options || {}).map(([k, v]) => `<span class="pill gray" style="margin:2px">${esc(k)}: ${esc(v)}</span>`).join('') || '<span class="subtle">—</span>'}</td>
                <td class="r"><span class="stock-num">${r.qty}</span></td>
                <td>${r.orders.slice(0, 3).map((n) => `<a class="card-link" href="#/orders/${esc(n)}">${esc(n)}</a>`).join(', ')}${r.orders.length > 3 ? ` +${r.orders.length - 3}` : ''}</td>
                <td>${fmt.relative(r.oldest)}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="empty" style="padding:28px"><h4>No pre-orders waiting</h4><p>When customers pre-order, the items they need appear here.</p></div>`}
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div><h3 style="font-size:15px">Below reorder level</h3><p class="muted" style="font-size:13px">Suggested quantity brings each product back to twice its reorder level.</p></div>
              ${reorder.length ? `<button class="btn btn-primary btn-sm" type="button" data-receive-suggested>${I('package')}Receive these</button>` : ''}</div>
            ${reorder.length ? `<div class="table-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="table"><thead><tr><th>Product</th><th class="r">On hand</th><th class="r">Reorder at</th><th class="r">Suggested</th><th class="r">Est. cost</th></tr></thead><tbody>
              ${reorder.map((p) => { const sug = Math.max(1, p.lowStockThreshold * 2 - p.stock); return `<tr><td><div class="cell-product"><img src="${esc(thumb(p.images?.[0]))}" alt=""><div><strong>${esc(p.name)}</strong><span>${esc(p.sku)}</span></div></div></td><td class="r"><span class="stock-num" style="color:${p.stock ? 'var(--amber)' : 'var(--brand)'}">${p.stock}</span></td><td class="r num">${p.lowStockThreshold}</td><td class="r num"><strong>${sug}</strong></td><td class="r num">${money(sug * (p.costPrice || 0))}</td></tr>`; }).join('')}
            </tbody></table></div>` : `<div class="empty" style="padding:28px"><h4>Everything is above its reorder level</h4></div>`}
          </div></div>`;
        Admin.state.purchaseRows = rows;
        Admin.state.reorder = reorder;
      }

      // Events
      el.addEventListener('click', (e) => {
        const t = e.target;
        const v = t.closest('[data-view]');
        if (v) { historyShown = 100; Admin.go(`#/inventory${v.dataset.view === 'levels' ? '' : `?view=${v.dataset.view}`}`); return; }
        const qk = t.closest('[data-quick]');
        if (qk) { Admin.go(`#/inventory?filter=${qk.dataset.quick}`); return; }
        const adj = t.closest('[data-adj]');
        if (adj) { stockModal(adj.dataset.id, { type: adj.dataset.adj }); return; }
        if (t.closest('[data-shipment]')) { receiveShipment(); return; }
        if (t.closest('[data-clear-focus]')) { Admin.setQuery({ product: null }); Admin.render(); return; }
        if (t.closest('[data-clear-product]')) { Admin.setQuery({ product: null }); Admin.render(); return; }
        if (t.closest('[data-more]')) { historyShown += 100; Admin.render(); return; }
        if (t.closest('[data-receive-suggested]')) { receiveShipment(Admin.state.reorder.map((p) => ({ productId: p.id, qty: Math.max(1, p.lowStockThreshold * 2 - p.stock), cost: '' }))); return; }
        if (t.closest('[data-export-pre]')) {
          Admin.csv(`chibest-supplier-list-${Admin.today()}.csv`, ['SKU', 'Product', 'Options', 'Quantity needed', 'Orders', 'Waiting since'],
            Admin.state.purchaseRows.map((r) => [r.sku, r.name, Object.entries(r.options || {}).map(([k, x]) => `${k}: ${x}`).join('; '), r.qty, r.orders.join(' '), fmt.date(r.oldest)]));
          return;
        }
        if (t.closest('[data-export]')) {
          if (view === 'history') {
            Admin.csv(`chibest-stock-movements-${Admin.today()}.csv`, ['Date', 'Time', 'SKU', 'Product', 'Movement', 'Change', 'Balance after', 'Unit cost', 'Reference', 'Note', 'By'],
              (Admin.state.historyList || movements).map((m) => [fmt.date(m.at), fmt.time(m.at), m.sku, m.productName, DB.const.MOVEMENT_TYPES[m.type]?.label || m.type, m.change, m.balanceAfter, m.unitCost ?? '', m.reference, m.note, m.actor]));
          } else {
            Admin.csv(`chibest-stock-levels-${Admin.today()}.csv`, ['SKU', 'Product', 'Category', 'Status', 'On hand', 'Reorder at', 'Unit cost', 'Price', 'Value at cost', 'Retail value', 'Allow pre-order'],
              tracked.map((p) => [p.sku, p.name, categories.find((c) => c.id === p.categoryId)?.name || '', stockState(p, settings), p.stock, p.lowStockThreshold, p.costPrice || 0, p.price, Math.max(0, p.stock) * (p.costPrice || 0), Math.max(0, p.stock) * p.price, p.allowPreorder ? 'yes' : 'no']));
          }
        }
      });
      let tm;
      $('[data-search]', el)?.addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { Admin.setQuery({ q: e.target.value }); Admin.render(); }, 250); });
      $$('select[data-f]', el).forEach((s) => s.addEventListener('change', () => { Admin.setQuery({ [s.dataset.f]: s.value }); Admin.render(); }));
      const s = $('[data-search]', el);
      if (s && q.get('q')) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }
  });
})();
