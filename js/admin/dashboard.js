// Dashboard: sales performance, what needs attention, stock health.
Admin.view('dashboard', {
  live: true,
  async render(el, route, isCurrent) {
    const { I, esc, money, fmt, thumb, pill, stockState } = Admin;
    Admin.setTitle('Dashboard');
    const { orders, products, settings, requests, categories } = await Admin.load('orders', 'products', 'settings', 'requests', 'categories');
    if (!isCurrent()) return;

    const range = route.query.get('range') || '30';
    const DAY = 864e5;
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const today = startOfDay(new Date());
    const firstOrder = orders.length ? startOfDay(orders[orders.length - 1].createdAt) : today;
    const days = range === 'all' ? Math.max(30, Math.round((today - firstOrder) / DAY) + 1) : +range;
    const start = new Date(today.getTime() - (days - 1) * DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    const live = orders.filter((o) => o.status !== 'cancelled');
    const inRange = live.filter((o) => new Date(o.createdAt) >= start);
    const inPrev = live.filter((o) => new Date(o.createdAt) >= prevStart && new Date(o.createdAt) < start);

    const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
    const profitOf = (o) => sum(o.items, (l) => (l.price - (l.unitCost || 0)) * l.qty);
    const k = {
      sales: sum(inRange, (o) => o.subtotal), prevSales: sum(inPrev, (o) => o.subtotal),
      orders: inRange.length, prevOrders: inPrev.length,
      profit: sum(inRange, profitOf), prevProfit: sum(inPrev, profitOf),
      units: sum(inRange, (o) => sum(o.items, (l) => l.qty))
    };
    k.aov = k.orders ? k.sales / k.orders : 0;
    k.prevAov = k.prevOrders ? k.prevSales / k.prevOrders : 0;
    k.margin = k.sales ? (k.profit / k.sales) * 100 : 0;

    // Daily buckets
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getTime() + i * DAY);
      return { date: d, sales: 0, orders: 0, profit: 0 };
    });
    inRange.forEach((o) => {
      const i = Math.floor((startOfDay(o.createdAt) - start) / DAY);
      if (buckets[i]) { buckets[i].sales += o.subtotal; buckets[i].orders += 1; buckets[i].profit += profitOf(o); }
    });
    const sparkOf = (key) => {
      const n = Math.min(12, buckets.length);
      const size = Math.ceil(buckets.length / n);
      const out = [];
      for (let i = 0; i < buckets.length; i += size) out.push(buckets.slice(i, i + size).reduce((s, b) => s + b[key], 0));
      return out;
    };

    const delta = (cur, prev) => {
      if (!prev && !cur) return '<span class="delta flat">No change</span>';
      if (!prev) return `<span class="delta up">${I('arrow-up')}New<small>vs prior ${days}d</small></span>`;
      const pct = ((cur - prev) / prev) * 100;
      const dir = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down';
      return `<span class="delta ${dir}">${dir === 'flat' ? '' : I(dir === 'up' ? 'arrow-up' : 'arrow-down')}${fmt.pct(Math.abs(pct))}<small>vs prior ${days}d</small></span>`;
    };
    const tile = (label, icon, value, d, sparkKey, extra = '') => `<div class="card stat">
      <div class="stat-label">${I(icon)}${label}</div>
      <div class="stat-value">${value}${extra}</div>
      <div class="stat-foot">${d}${sparkKey ? Charts.spark(sparkOf(sparkKey)) : ''}</div></div>`;

    // Attention
    const open = (o) => !['delivered', 'cancelled'].includes(o.status);
    const pending = orders.filter((o) => o.status === 'pending').length;
    const unpaid = orders.filter((o) => open(o) && o.paymentStatus === 'unpaid' && o.paymentMethod === 'bank_transfer').length;
    const toShip = orders.filter((o) => ['confirmed', 'processing'].includes(o.status)).length;
    const active = products.filter((p) => p.status === 'active');
    const low = active.filter((p) => stockState(p, settings) === 'low');
    const out = active.filter((p) => stockState(p, settings) === 'out');
    const newReq = requests.filter((r) => r.status === 'new').length;
    const preorderNeeds = new Map();
    orders.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).forEach((o) => o.items.filter((l) => l.preorder).forEach((l) => {
      const cur = preorderNeeds.get(l.productId) || { name: l.name, image: l.image, qty: 0, orders: new Set() };
      cur.qty += l.qty; cur.orders.add(o.number);
      preorderNeeds.set(l.productId, cur);
    }));
    const todo = [
      ['receipt', 'amber', 'Orders awaiting confirmation', 'Confirm stock and payment', pending, '#/orders?status=pending'],
      ['banknote', 'amber', 'Unpaid bank transfers', 'Waiting for customer payment', unpaid, '#/orders?payment=unpaid'],
      ['package', 'blue', 'Ready to pack & ship', 'Confirmed or processing', toShip, '#/orders?status=processing'],
      ['plane', 'blue', 'Pre-order items to buy', 'Order these from suppliers', [...preorderNeeds.values()].reduce((s, x) => s + x.qty, 0), '#/inventory?view=preorders'],
      ['alert-triangle', 'amber', 'Low stock', 'At or below reorder level', low.length, '#/inventory?filter=low'],
      ['x-circle', 'red', 'Out of stock', 'Not available to buy', out.length, '#/inventory?filter=out'],
      ['inbox', 'green', 'New sourcing requests', 'Customers waiting for a quote', newReq, '#/requests?status=new']
    ];

    // Top products & categories
    const byProduct = new Map(), byCategory = new Map();
    const pById = new Map(products.map((p) => [p.id, p]));
    inRange.forEach((o) => o.items.forEach((l) => {
      const p = pById.get(l.productId);
      const cur = byProduct.get(l.productId) || { label: l.name, value: 0, units: 0, image: thumb(l.image) };
      cur.value += l.lineTotal; cur.units += l.qty;
      byProduct.set(l.productId, cur);
      const cat = categories.find((c) => c.id === p?.categoryId)?.name || 'Other';
      byCategory.set(cat, (byCategory.get(cat) || 0) + l.lineTotal);
    }));
    const top = [...byProduct.values()].sort((a, b) => b.value - a.value).slice(0, 6).map((x) => ({ ...x, sub: `${x.units} sold` }));
    const cats = [...byCategory.entries()].map(([label, value]) => ({ label, value, sub: k.sales ? fmt.pct((value / k.sales) * 100) : '' })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Inventory value
    const tracked = products.filter((p) => p.status !== 'archived' && p.trackInventory !== false);
    const units = sum(tracked, (p) => Math.max(0, p.stock));
    const costValue = sum(tracked, (p) => Math.max(0, p.stock) * (p.costPrice || 0));
    const retailValue = sum(tracked, (p) => Math.max(0, p.stock) * p.price);

    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const rangeLabel = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', all: 'All time' }[range];

    el.innerHTML = `
      <div class="page-head">
        <div><h2>${greet}</h2><p>${new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Here's how the store is doing.</p></div>
        <div class="seg" role="group" aria-label="Date range">${['7', '30', '90', 'all'].map((r) => `<button type="button" data-range="${r}" class="${r === range ? 'is-on' : ''}">${r === 'all' ? 'All time' : `${r} days`}</button>`).join('')}</div>
      </div>
      ${!orders.length ? `<div class="banner"><span class="b-icon">${I('sparkles')}</span><div><strong>No orders yet</strong><p>${DB.isDemo ? 'Orders placed on the storefront appear here instantly. Want to preview the reports? Generate realistic sample orders (demo data only).' : 'Orders placed on your storefront will appear here.'}</p></div>${DB.isDemo ? `<button class="btn btn-primary" type="button" data-samples>${I('sparkles')}Generate sample orders</button>` : `<a class="btn btn-outline" href="index.html" target="_blank">View store</a>`}</div>` : ''}
      <div class="dash-grid">
        <div class="cols-4">
          ${tile('Sales', 'banknote', money(k.sales), delta(k.sales, k.prevSales), 'sales')}
          ${tile('Orders', 'receipt', fmt.int(k.orders), delta(k.orders, k.prevOrders), 'orders', `<small> · ${fmt.int(k.units)} items</small>`)}
          ${tile('Gross profit', 'trending-up', money(k.profit), delta(k.profit, k.prevProfit), 'profit', k.sales ? `<small> · ${fmt.pct(k.margin)} margin</small>` : '')}
          ${tile('Average order', 'bag', money(k.aov), delta(k.aov, k.prevAov), null)}
        </div>

        <div class="cols-2-1">
          <div class="card">
            <div class="card-head"><div><h3>Sales over time</h3><p>${rangeLabel} · item sales excluding delivery and cancelled orders</p></div>
              <div class="seg" role="group" aria-label="View"><button type="button" class="is-on" data-view-mode="chart">Chart</button><button type="button" data-view-mode="table">Table</button></div></div>
            <div class="card-body"><div class="chart-total">${money(k.sales)}</div><div class="muted" style="font-size:12.5px;margin-bottom:10px">${fmt.int(k.orders)} orders in ${rangeLabel.toLowerCase()}</div>
              <div data-chart></div>
              <div data-chart-table hidden class="table-wrap" style="max-height:300px;overflow:auto"><table class="table"><thead><tr><th>Date</th><th class="r">Orders</th><th class="r">Sales</th><th class="r">Gross profit</th></tr></thead><tbody>
                ${buckets.slice().reverse().map((b) => `<tr><td>${fmt.date(b.date)}</td><td class="r">${b.orders}</td><td class="r">${money(b.sales)}</td><td class="r">${money(b.profit)}</td></tr>`).join('')}</tbody></table></div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><div><h3>Needs attention</h3><p>Tasks waiting on you right now</p></div></div>
            <div class="todo">${todo.map(([ic, tone, t, s, n, href]) => `<a href="${href}"><span class="t-icon ${n ? tone : ''}">${I(ic)}</span><div><strong>${t}</strong><span>${s}</span></div><span class="t-n" style="${n ? '' : 'color:var(--subtle)'}">${n}</span>${I('chevron-right', 'chev')}</a>`).join('')}</div>
          </div>
        </div>

        <div class="cols-1-1">
          <div class="card"><div class="card-head"><div><h3>Top products</h3><p>By sales, ${rangeLabel.toLowerCase()}</p></div><a class="card-link" href="#/products">All products ${I('arrow-right')}</a></div><div class="card-body">${Charts.hbars(top)}</div></div>
          <div class="card"><div class="card-head"><div><h3>Sales by category</h3><p>Share of item sales, ${rangeLabel.toLowerCase()}</p></div></div><div class="card-body">${Charts.hbars(cats)}</div></div>
        </div>

        <div class="cols-6">
          ${[['Units in stock', fmt.int(units), 'box'], ['Stock value (cost)', money(costValue), 'wallet'], ['Retail value', money(retailValue), 'tag'], ['Potential profit', money(retailValue - costValue), 'trending-up'], ['Low stock', low.length, 'alert-triangle', low.length ? 'is-warn' : ''], ['Out of stock', out.length, 'x-circle', out.length ? 'is-bad' : '']]
            .map(([l, v, ic, cls]) => `<a class="card stat mini-stat ${cls || ''}" href="#/inventory"><div class="stat-label">${I(ic)}${l}</div><div class="stat-value">${v}</div></a>`).join('')}
        </div>

        <div class="cols-2-1">
          <div class="card">
            <div class="card-head"><div><h3>Recent orders</h3><p>Latest activity from the storefront</p></div><a class="card-link" href="#/orders">View all ${I('arrow-right')}</a></div>
            ${orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th class="r">Total</th></tr></thead><tbody>
              ${orders.slice(0, 7).map((o) => `<tr class="clickable" data-href="#/orders/${esc(o.id)}"><td><strong class="num">${esc(o.number)}</strong><span class="cell-sub">${fmt.relative(o.createdAt)}</span></td><td>${esc(o.customer.name)}<span class="cell-sub">${o.delivery.method === 'pickup' ? 'Pickup' : `${esc(o.delivery.city)}, ${esc(o.delivery.state)}`}</span></td><td>${pill.order(o.status)}</td><td>${pill.payment(o.paymentStatus)}</td><td class="r"><strong>${money(o.total)}</strong></td></tr>`).join('')}
            </tbody></table></div>` : `<div class="empty"><div class="e-icon">${I('receipt')}</div><h4>No orders yet</h4><p>New orders will show up here.</p></div>`}
          </div>
          <div class="card">
            <div class="card-head"><div><h3>Restock soon</h3><p>Lowest stock first</p></div><a class="card-link" href="#/inventory?filter=low">Inventory ${I('arrow-right')}</a></div>
            ${[...out, ...low].length ? `<div class="todo">${[...out, ...low].sort((a, b) => a.stock - b.stock).slice(0, 7).map((p) => `<a href="#/inventory?product=${esc(p.id)}" data-restock="${esc(p.id)}"><img class="thumb-sm" src="${esc(thumb(p.images[0]))}" alt="" style="width:36px;height:36px"><div style="min-width:0"><strong class="ellipsis">${esc(p.name)}</strong><span>${esc(p.sku)} · reorder at ${p.lowStockThreshold}</span></div><span class="t-n" style="color:${p.stock ? 'var(--amber)' : 'var(--brand)'}">${p.stock}</span></a>`).join('')}</div>`
              : `<div class="empty"><div class="e-icon">${I('check')}</div><h4>All stocked up</h4><p>No products are below their reorder level.</p></div>`}
          </div>
        </div>
      </div>`;

    Charts.columns(Admin.$('[data-chart]', el), {
      points: buckets.map((b) => ({ value: b.sales, label: days > 31 ? fmt.dateShort(b.date) : String(b.date.getDate()), title: b.date.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }), sub: `${b.orders} order${b.orders === 1 ? '' : 's'}` })),
      valueLabel: 'Sales',
      height: 290
    });

    el.onclick = async (e) => {
      const r = e.target.closest('[data-range]');
      if (r) { Admin.go(`#/dashboard?range=${r.dataset.range}`); return; }
      const vm = e.target.closest('[data-view-mode]');
      if (vm) {
        Admin.$$('[data-view-mode]', el).forEach((b) => b.classList.toggle('is-on', b === vm));
        Admin.$('[data-chart]', el).hidden = vm.dataset.viewMode !== 'chart';
        Admin.$('[data-chart-table]', el).hidden = vm.dataset.viewMode !== 'table';
        return;
      }
      const restock = e.target.closest('[data-restock]');
      if (restock && Admin.stockModal) { e.preventDefault(); Admin.stockModal(restock.dataset.restock, { type: 'restock' }); return; }
      const row = e.target.closest('tr[data-href]');
      if (row) { Admin.go(row.dataset.href); return; }
      const s = e.target.closest('[data-samples]');
      if (s) {
        s.classList.add('is-loading');
        const n = await DB.data.generateSamples();
        Admin.invalidate();
        Admin.state.lastOrderCount = undefined;
        Admin.toast(`${n} sample orders created`, { sub: 'Stock levels and the inventory ledger were updated too.' });
        Admin.render();
      }
    };
  }
});
