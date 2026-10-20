// Customers (derived from orders, grouped by phone number).
Admin.view('customers', {
  live: true,
  async render(el, route, isCurrent) {
    const { I, $, esc, money, fmt, pill } = Admin;
    Admin.setTitle('Customers');
    const { orders } = await Admin.load('orders');
    if (!isCurrent()) return;
    const customers = (await DB.customers.list());
    if (!isCurrent()) return;
    const search = (route.query.get('q') || '').toLowerCase().trim();
    const sort = route.query.get('sort') || 'spent';
    let list = customers;
    if (search) {
      const d = search.replace(/\D/g, '');
      list = list.filter((c) => c.name.toLowerCase().includes(search) || (c.email || '').toLowerCase().includes(search) || (d.length >= 4 && DB.util.digits(c.phone).includes(d)) || (c.state || '').toLowerCase().includes(search));
    }
    list.sort({ spent: (a, b) => b.spent - a.spent, orders: (a, b) => b.orders - a.orders, recent: (a, b) => String(b.lastOrderAt).localeCompare(String(a.lastOrderAt)), name: (a, b) => a.name.localeCompare(b.name) }[sort]);
    const repeat = customers.filter((c) => c.orders > 1).length;
    const ltv = customers.length ? customers.reduce((s, c) => s + c.spent, 0) / customers.length : 0;
    const states = new Map();
    customers.forEach((c) => states.set(c.state || 'Pickup', (states.get(c.state || 'Pickup') || 0) + 1));
    const topState = [...states.entries()].sort((a, b) => b[1] - a[1])[0];

    el.innerHTML = `
      <div class="page-head"><div><h2>Customers</h2><p>Everyone who has ordered, grouped by phone number.</p></div>
        <div class="page-actions"><button class="btn btn-outline" type="button" data-export>${I('download')}Export CSV</button></div></div>
      <div class="cols-4" style="margin-bottom:16px">
        ${[['Customers', fmt.int(customers.length), 'users'], ['Repeat customers', `${fmt.int(repeat)}<small> · ${customers.length ? fmt.pct((repeat / customers.length) * 100) : '0%'}</small>`, 'refresh'], ['Average lifetime value', money(ltv), 'banknote'], ['Top location', topState ? `${esc(topState[0])}<small> · ${topState[1]}</small>` : '—', 'map-pin']]
          .map(([l, v, ic]) => `<div class="card stat mini-stat"><div class="stat-label">${I(ic)}${l}</div><div class="stat-value">${v}</div></div>`).join('')}
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="affix search">${I('search')}<input class="input" type="search" data-search placeholder="Search name, phone, email or state" value="${esc(route.query.get('q') || '')}" aria-label="Search customers"></label>
          <div class="toolbar-right"><select class="select" data-sort aria-label="Sort">${[['spent', 'Top spenders'], ['orders', 'Most orders'], ['recent', 'Most recent'], ['name', 'Name A–Z']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Location</th><th class="r">Orders</th><th class="r">Total spent</th><th>Last order</th><th class="r">Contact</th></tr></thead><tbody>
          ${list.map((c) => `<tr class="clickable" data-key="${esc(c.key)}">
            <td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="background:var(--surface-3);color:var(--ink)">${esc(c.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><strong style="font-weight:650">${esc(c.name)}</strong><span class="cell-sub">${esc(c.phone)}${c.email ? ` · ${esc(c.email)}` : ''}</span></div></div></td>
            <td>${esc(c.city ? `${c.city}, ` : '')}${esc(c.state || 'Pickup')}</td>
            <td class="r num">${c.orders}${c.orders > 1 ? ' <span class="pill green" style="height:20px;font-size:11px">Repeat</span>' : ''}</td>
            <td class="r"><strong class="num">${money(c.spent)}</strong></td>
            <td>${fmt.relative(c.lastOrderAt)}</td>
            <td><div class="row-actions"><a class="icon-btn" href="tel:${esc(DB.util.digits(c.phone))}" title="Call" aria-label="Call" data-stop>${I('phone')}</a><a class="icon-btn" href="${Admin.whatsapp(c.phone, `Hi ${c.name.split(' ')[0]}, `)}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp" data-stop><i class="fa-brands fa-whatsapp" style="font-size:17px;color:#1faa53"></i></a></div></td></tr>`).join('')}
        </tbody></table></div>`
        : `<div class="empty"><div class="e-icon">${I('users')}</div><h4>${customers.length ? 'No customers match' : 'No customers yet'}</h4><p>${customers.length ? 'Try another search.' : 'Customers appear here after their first order.'}</p></div>`}
      </div>`;

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop]')) return;
      if (e.target.closest('[data-export]')) {
        Admin.csv(`chibest-customers-${Admin.today()}.csv`, ['Name', 'Phone', 'Email', 'City', 'State', 'Orders', 'Total spent', 'First order', 'Last order'],
          list.map((c) => [c.name, c.phone, c.email, c.city, c.state, c.orders, c.spent, fmt.date(c.firstOrderAt), fmt.date(c.lastOrderAt)]));
        return;
      }
      const row = e.target.closest('tr[data-key]');
      if (!row) return;
      const c = customers.find((x) => x.key === row.dataset.key);
      const theirs = orders.filter((o) => c.orderIds.includes(o.id));
      Admin.drawer({
        title: esc(c.name), sub: `${esc(c.phone)} · customer since ${fmt.date(c.firstOrderAt)}`, width: 620,
        actions: `<a class="btn btn-whatsapp btn-sm" href="${Admin.whatsapp(c.phone, `Hi ${c.name.split(' ')[0]}, `)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>WhatsApp</a>`,
        body: `<div class="cols-3">${[['Orders', c.orders], ['Total spent', money(c.spent)], ['Average order', money(c.orders ? c.spent / c.orders : 0)]].map(([l, v]) => `<div class="card mini-stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>
          <div class="card"><div class="card-head"><h3>Details</h3></div><div class="card-body"><dl class="kv"><dt>Phone</dt><dd>${esc(c.phone)}</dd>${c.email ? `<dt>Email</dt><dd>${esc(c.email)}</dd>` : ''}<dt>Location</dt><dd>${esc([c.city, c.state].filter(Boolean).join(', ') || 'Pickup')}</dd></dl></div></div>
          <div class="card"><div class="card-head"><h3>Order history</h3></div><div class="table-wrap"><table class="table"><tbody>
            ${theirs.map((o) => `<tr class="clickable" data-order="${esc(o.id)}"><td><strong class="num">${esc(o.number)}</strong><span class="cell-sub">${fmt.date(o.createdAt)} · ${o.items.reduce((s, l) => s + l.qty, 0)} items</span></td><td>${pill.order(o.status)}</td><td class="r"><strong>${money(o.total)}</strong></td></tr>`).join('')}
          </tbody></table></div></div>`,
        onMount(d) { d.el.addEventListener('click', (ev) => { const r = ev.target.closest('[data-order]'); if (r) { d.close(true); Admin.go(`#/orders/${r.dataset.order}`); } }); }
      });
    });
    let tm;
    $('[data-search]', el).addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { Admin.setQuery({ q: e.target.value }); Admin.render(); }, 250); });
    $('[data-sort]', el).addEventListener('change', (e) => { Admin.setQuery({ sort: e.target.value }); Admin.render(); });
    if (search) { const s = $('[data-search]', el); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
});
