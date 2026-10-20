// Orders: list, detail drawer, fulfilment workflow, invoices.
(function () {
  const { I, $, $$, esc, money, fmt, thumb, pill } = Admin;
  const STATUSES = DB.const.ORDER_STATUSES;
  const METHODS = DB.const.PAYMENT_METHODS;
  const label = (s) => STATUSES.find((x) => x.id === s)?.admin || s;
  const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

  function waMessage(o, status, note) {
    const track = Admin.storeUrl(`track.html?order=${encodeURIComponent(o.number)}`);
    const n = first(o.customer.name);
    const lines = {
      pending: `Hi ${n}, thank you for your Chi-Best order ${o.number} (${money(o.total)}). We'll confirm it shortly.`,
      confirmed: `Hi ${n}, your Chi-Best order ${o.number} is confirmed. We'll let you know as soon as it ships.`,
      processing: `Hi ${n}, your order ${o.number} is being prepared and packed.`,
      shipped: `Good news ${n}! Your order ${o.number} has been shipped and is on its way.`,
      out_for_delivery: `Hi ${n}, our rider is on the way with your order ${o.number} today. Please keep your phone close.`,
      delivered: `Hi ${n}, your order ${o.number} has been delivered. Thank you for shopping with Chi-Best!`,
      cancelled: `Hi ${n}, your order ${o.number} has been cancelled.`
    };
    return [lines[status] || lines.pending, note ? `Note: ${note}` : '', status !== 'delivered' && status !== 'cancelled' ? `Track your order: ${track}` : ''].filter(Boolean).join('\n\n');
  }

  function invoice(o, settings) {
    const s = settings;
    const w = window.open('', '_blank');
    if (!w) { Admin.toast('Allow pop-ups to print invoices', { type: 'error' }); return; }
    const rows = o.items.map((l) => `<tr><td><strong>${esc(l.name)}</strong><br><small>${esc(l.sku)}${Object.keys(l.options || {}).length ? ' · ' + Object.entries(l.options).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(', ') : ''}${l.preorder ? ' · Pre-order' : ''}</small></td><td class="r">${l.qty}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.lineTotal)}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.number)}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap">
      <style>body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#121418;margin:0;padding:48px;font-size:13px;word-spacing:.06em}
      .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:52px}
      .brand b{font-size:22px;letter-spacing:-.03em}.brand b span{color:#d0161e}h1{font-size:28px;margin:0;letter-spacing:-.03em;text-align:right}
      .muted{color:#5d636d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}h4{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5d636d;margin:0 0 6px}
      table{width:100%;border-collapse:collapse}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5d636d;text-align:left;border-bottom:2px solid #121418;padding:8px 0}
      td{padding:12px 0;border-bottom:1px solid #e7e4de;vertical-align:top}.r{text-align:right}small{color:#5d636d}
      .tot{margin-left:auto;width:280px;margin-top:16px}.tot div{display:flex;justify-content:space-between;padding:5px 0}.tot .g{font-size:17px;font-weight:800;border-top:2px solid #121418;margin-top:6px;padding-top:10px}
      .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-weight:700;font-size:11px;background:${o.paymentStatus === 'paid' ? '#e6f4ec;color:#0b7a3e' : '#fdf1df;color:#a65a00'}}
      .foot{margin-top:48px;padding-top:16px;border-top:1px solid #e7e4de;color:#5d636d;font-size:12px}@media print{body{padding:24px}}</style></head><body>
      <div class="top"><div class="brand"><img src="${Admin.storeUrl('images/brand/mark-256.png')}" alt=""><div><b><span>Chi</span>-Best</b><div class="muted">${esc(s.address)}<br>${esc(s.phone)} · ${esc(s.email)}</div></div></div>
        <div><h1>Invoice</h1><div class="muted" style="text-align:right">${esc(o.number)}<br>${fmt.date(o.createdAt)}</div></div></div>
      <div class="grid"><div><h4>Bill to</h4><strong>${esc(o.customer.name)}</strong><br>${esc(o.customer.phone)}${o.customer.email ? `<br>${esc(o.customer.email)}` : ''}</div>
        <div><h4>${o.delivery.method === 'pickup' ? 'Pickup' : 'Deliver to'}</h4>${o.delivery.method === 'pickup' ? 'Pickup in Lagos' : `${esc(o.delivery.address)}<br>${esc(o.delivery.city)}, ${esc(o.delivery.state)}${o.delivery.landmark ? `<br><span class="muted">Landmark: ${esc(o.delivery.landmark)}</span>` : ''}`}</div></div>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div><span class="muted">Subtotal</span><span>${money(o.subtotal)}</span></div><div><span class="muted">Delivery</span><span>${o.deliveryFee ? money(o.deliveryFee) : 'Free'}</span></div><div class="g"><span>Total</span><span>${money(o.total)}</span></div>
        <div><span class="muted">Payment</span><span>${esc(METHODS[o.paymentMethod]?.label || '')} · <span class="badge">${o.paymentStatus === 'paid' ? 'PAID' : o.paymentStatus === 'refunded' ? 'REFUNDED' : 'UNPAID'}</span></span></div></div>
      ${s.payments?.bankName && o.paymentStatus !== 'paid' ? `<div class="foot"><strong>Pay by transfer:</strong> ${esc(s.payments.bankName)} · ${esc(s.payments.accountName)} · ${esc(s.payments.accountNumber)} · Reference ${esc(o.number)}</div>` : ''}
      <div class="foot">Thank you for shopping with Chi-Best. Questions? WhatsApp ${esc(s.phone || s.whatsapp)}.</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }

  // ---------------------------------------------------------------
  // Order drawer
  // ---------------------------------------------------------------
  async function openOrder(id, { onChange } = {}) {
    const { settings, orders, products } = await Admin.load('settings', 'orders', 'products');
    let o = orders.find((x) => x.id === id || x.number === id);
    if (!o) { Admin.toast('Order not found', { type: 'error' }); return null; }
    let changed = false;
    let flash = '';
    const pById = new Map(products.map((p) => [p.id, p]));

    const body = () => {
      const custOrders = orders.filter((x) => DB.util.phoneMatch(x.customer.phone, o.customer.phone));
      const profit = o.items.reduce((s, l) => s + (l.price - (l.unitCost || 0)) * l.qty, 0);
      const locked = o.status === 'cancelled';
      const nextIdx = Math.min(STATUSES.findIndex((s) => s.id === o.status) + 1, 5);
      return `
      ${flash}
      <div class="card card-body">
        <div class="order-top">
          <div><div class="muted" style="font-size:12.5px;font-weight:600">Fulfilment status</div><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${pill.order(o.status)}${pill.payment(o.paymentStatus)}<span class="pill gray">${esc(METHODS[o.paymentMethod]?.label || '')}</span></div></div>
          <div style="text-align:right"><div class="muted" style="font-size:12.5px;font-weight:600">Order total</div><h4>${money(o.total)}</h4></div>
        </div>
        ${locked ? `<p class="muted" style="margin-top:14px">This order was cancelled. Stock for ready-stock items was returned to inventory.</p>` : `
        <form class="status-update" data-status-form style="margin-top:16px">
          <div class="field"><label for="o-status">Update status</label><select class="select" id="o-status" name="status">${STATUSES.filter((s) => s.id !== 'cancelled').map((s, i) => `<option value="${s.id}" ${i === nextIdx && o.status !== 'delivered' ? 'selected' : s.id === o.status && o.status === 'delivered' ? 'selected' : ''}>${esc(s.admin)}${s.id === o.status ? ' (current)' : ''}</option>`).join('')}</select></div>
          <div class="field"><label for="o-note">Note for customer <span class="opt">optional, shown on tracking page</span></label><input class="input" id="o-note" name="note" placeholder="e.g. Arrived in Lagos, dispatching tomorrow"></div>
          <button class="btn btn-primary" type="submit">Update</button>
        </form>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line-2)">
          ${o.paymentStatus !== 'paid' ? `<button class="btn btn-outline btn-sm" type="button" data-pay="paid">${I('check')}Mark as paid</button>` : `<button class="btn btn-outline btn-sm" type="button" data-pay="unpaid">Mark as unpaid</button><button class="btn btn-outline btn-sm" type="button" data-pay="refunded">${I('rotate-ccw')}Mark refunded</button>`}
          <a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="${Admin.whatsapp(o.customer.phone, waMessage(o, o.status, ''))}"><i class="fa-brands fa-whatsapp"></i>Message customer</a>
          <button class="btn btn-danger btn-sm" type="button" data-cancel style="margin-left:auto">${I('x-circle')}Cancel order</button>
        </div>`}
      </div>

      <div class="card">
        <div class="card-head"><h3>Items (${o.items.reduce((s, l) => s + l.qty, 0)})</h3>${o.items.some((l) => l.preorder) ? '<span class="pill blue">Includes pre-order</span>' : ''}</div>
        <div class="card-body" style="padding-top:4px;padding-bottom:4px"><div class="items-list">
          ${o.items.map((l) => `<div class="it"><img src="${esc(thumb(l.image))}" alt=""><div style="min-width:0">
            <strong class="ellipsis">${pById.has(l.productId) ? `<a href="#/products/${esc(l.productId)}">${esc(l.name)}</a>` : esc(l.name)}</strong>
            <span>${esc(l.sku)}${Object.keys(l.options || {}).length ? ' · ' + Object.entries(l.options).map(([k, v]) => `${esc(k)}: <b style="color:var(--ink)">${esc(v)}</b>`).join(' · ') : ''}</span>
            <div style="margin-top:3px">${l.preorder ? '<span class="pill blue" style="height:20px;font-size:11px">Pre-order · buy from supplier</span>' : l.fromStock ? '<span class="pill gray" style="height:20px;font-size:11px">From stock</span>' : ''}</div></div>
            <div style="text-align:right"><strong class="num">${money(l.lineTotal)}</strong><span class="num">${l.qty} × ${money(l.price)}</span></div></div>`).join('')}
        </div></div>
        <div class="card-foot" style="display:block"><div class="totals">
          <div><span class="muted">Subtotal</span><span class="num">${money(o.subtotal)}</span></div>
          <div><span class="muted">Delivery${o.delivery.state ? ` (${esc(o.delivery.state)})` : ''}</span><span class="num">${o.deliveryFee ? money(o.deliveryFee) : 'Free'}</span></div>
          <div class="grand"><span>Total</span><span class="num">${money(o.total)}</span></div>
          <div><span class="muted">Estimated gross profit</span><span class="num" style="color:var(--green);font-weight:700">${money(profit)} · ${o.subtotal ? fmt.pct((profit / o.subtotal) * 100) : '0%'}</span></div>
        </div></div>
      </div>

      <div class="grid-2">
        <div class="card"><div class="card-head"><h3>Customer</h3><a class="card-link" href="#/customers?q=${encodeURIComponent(DB.util.digits(o.customer.phone).slice(-10))}">${custOrders.length} order${custOrders.length === 1 ? '' : 's'}</a></div>
          <div class="card-body"><dl class="kv"><dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>Phone</dt><dd><a class="card-link" href="tel:${esc(DB.util.digits(o.customer.phone))}">${esc(o.customer.phone)}</a></dd>${o.customer.email ? `<dt>Email</dt><dd><a class="card-link" href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></dd>` : ''}</dl></div></div>
        <div class="card"><div class="card-head"><h3>${o.delivery.method === 'pickup' ? 'Pickup' : 'Delivery'}</h3></div>
          <div class="card-body"><dl class="kv">${o.delivery.method === 'pickup' ? `<dt>Method</dt><dd>Pickup in Lagos</dd>` : `<dt>Address</dt><dd>${esc(o.delivery.address)}</dd><dt>Area</dt><dd>${esc(o.delivery.city)}, ${esc(o.delivery.state)}</dd>${o.delivery.landmark ? `<dt>Landmark</dt><dd>${esc(o.delivery.landmark)}</dd>` : ''}<dt>Estimate</dt><dd>${esc(o.delivery.eta || '')}</dd>`}</dl></div></div>
      </div>
      ${o.notes ? `<div class="card card-body"><div class="section-title" style="margin:0 0 6px">Customer note</div><p>${esc(o.notes)}</p></div>` : ''}

      <div class="card">
        <div class="card-head"><h3>Timeline</h3><span class="muted" style="font-size:12.5px">${o.events.length} events</span></div>
        <div class="card-body">
          <form data-note-form style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
            <input class="input" name="note" placeholder="Add a note…" style="flex:1 1 220px" aria-label="Note">
            <label class="check" style="font-size:13px;font-weight:600"><input type="checkbox" name="internal" checked> Internal only</label>
            <button class="btn btn-outline" type="submit">Add note</button>
          </form>
          <div class="timeline">${o.events.slice().reverse().map((e) => {
            const tone = e.type === 'payment' ? 'green' : e.status === 'cancelled' ? 'red' : e.type === 'status' ? 'ink' : 'blue';
            const icon = e.type === 'payment' ? 'banknote' : e.type === 'status' ? 'check' : 'note';
            return `<div class="tl"><span class="tl-dot ${tone}">${I(icon)}</span><div><strong>${esc(e.type === 'status' ? label(e.status) : e.type === 'payment' ? 'Payment' : 'Note')}</strong>${e.type === 'internal' ? '<span class="internal">Internal</span>' : ''}
              ${e.note ? `<p>${esc(e.note)}</p>` : ''}<time>${fmt.dateTime(e.at)} · ${esc(e.actor || '')}</time></div></div>`;
          }).join('')}</div>
        </div>
      </div>`;
    };

    const actor = () => Admin.state.user?.name || 'admin';
    const refresh = async (msg, waStatus, waNote) => {
      changed = true;
      Admin.invalidate('orders', 'products', 'movements');
      const fresh = (await Admin.load('orders')).orders.find((x) => x.id === o.id);
      if (fresh) o = fresh;
      flash = msg ? `<div class="banner" style="margin:0;border-color:#bfe3cc;background:var(--green-soft)"><span class="b-icon" style="background:#fff;color:var(--green)">${I('check')}</span><div><strong>${esc(msg)}</strong><p>Let the customer know with a ready-made WhatsApp message.</p></div>
        <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${Admin.whatsapp(o.customer.phone, waMessage(o, waStatus || o.status, waNote))}"><i class="fa-brands fa-whatsapp"></i>Send update</a></div>` : '';
      d.setBody(body());
      d.setHead(`Order ${esc(o.number)}`, `Placed ${fmt.dateTime(o.createdAt)} · ${esc(o.customer.name)}`);
      Admin.refreshCounts();
    };

    const d = Admin.drawer({
      title: `Order ${esc(o.number)}`,
      sub: `Placed ${fmt.dateTime(o.createdAt)} · ${esc(o.customer.name)}`,
      actions: `<button class="btn btn-outline btn-sm" type="button" data-invoice>${I('printer')}<span class="hide-sm">Invoice</span></button>`,
      body: body(),
      onClose: (silent) => { if (!silent) onChange ? onChange(changed) : null; }
    });

    d.el.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const btn = $('button[type="submit"]', f);
      btn.classList.add('is-loading');
      try {
        if (f.matches('[data-status-form]')) {
          const status = f.status.value, note = f.note.value.trim();
          await DB.orders.updateStatus(o.id, status, note, actor());
          await refresh(`Status updated to ${label(status)}`, status, note);
        } else if (f.matches('[data-note-form]')) {
          await DB.orders.addNote(o.id, f.note.value, actor(), { internal: f.internal.checked });
          flash = '';
          await refresh('');
          Admin.toast('Note added');
        }
      } catch (err) { btn.classList.remove('is-loading'); Admin.toast(err.message, { type: 'error' }); }
    });
    d.el.addEventListener('click', async (e) => {
      const pay = e.target.closest('[data-pay]');
      if (pay) {
        try {
          await DB.orders.setPayment(o.id, pay.dataset.pay, '', actor());
          await refresh(pay.dataset.pay === 'paid' ? 'Payment recorded' : `Payment marked ${pay.dataset.pay}`, o.status, pay.dataset.pay === 'paid' ? 'We have received your payment, thank you.' : '');
        } catch (err) { Admin.toast(err.message, { type: 'error' }); }
        return;
      }
      if (e.target.closest('[data-cancel]')) {
        const ok = await Admin.confirm({ title: `Cancel order ${o.number}?`, text: 'Items that were taken from stock will be returned to inventory automatically. This cannot be undone.', confirm: 'Cancel order', danger: true });
        if (!ok) return;
        try { await DB.orders.updateStatus(o.id, 'cancelled', 'Cancelled by store', actor()); await refresh('Order cancelled and stock returned', 'cancelled', ''); }
        catch (err) { Admin.toast(err.message, { type: 'error' }); }
        return;
      }
      if (e.target.closest('[data-invoice]')) invoice(o, settings);
    });
    return d;
  }
  Admin.openOrder = openOrder;

  // ---------------------------------------------------------------
  // List
  // ---------------------------------------------------------------
  const PAGE = 50;
  let shown = PAGE;

  Admin.view('orders', {
    live: true,
    keepsDrawer: true,
    async render(el, route, isCurrent) {
      Admin.setTitle('Orders');
      const { orders } = await Admin.load('orders');
      if (!isCurrent()) return;
      const q = route.query;
      const status = q.get('status') || 'all';
      const payment = q.get('payment') || '';
      const search = (q.get('q') || '').trim().toLowerCase();

      const counts = { all: orders.length };
      STATUSES.forEach((s) => { counts[s.id] = orders.filter((o) => o.status === s.id).length; });
      let list = orders.filter((o) => (status === 'all' || o.status === status) && (!payment || o.paymentStatus === payment));
      if (search) {
        const digits = search.replace(/\D/g, '');
        list = list.filter((o) => o.number.toLowerCase().includes(search) || o.customer.name.toLowerCase().includes(search) ||
          (o.customer.email || '').toLowerCase().includes(search) || (digits.length >= 4 && DB.util.digits(o.customer.phone).includes(digits)) ||
          o.items.some((l) => l.name.toLowerCase().includes(search)));
      }
      const totalValue = list.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);

      el.innerHTML = `
        <div class="page-head"><div><h2>Orders</h2><p>${fmt.int(list.length)} order${list.length === 1 ? '' : 's'} · ${money(totalValue)} total value${status === 'all' ? '' : ` · ${esc(label(status))}`}</p></div>
          <div class="page-actions"><button class="btn btn-outline" type="button" data-export>${I('download')}Export CSV</button><a class="btn btn-outline" href="index.html" target="_blank">${I('external')}Open store</a></div></div>
        <div class="card">
          <div class="tabs" role="tablist">${[{ id: 'all', admin: 'All' }, ...STATUSES].map((s) => `<button type="button" role="tab" data-tab="${s.id}" class="${status === s.id ? 'is-on' : ''}">${esc(s.admin)}<span class="n">${counts[s.id]}</span></button>`).join('')}</div>
          <div class="toolbar">
            <label class="affix search">${I('search')}<input class="input" type="search" data-search placeholder="Search order, customer, phone or item" value="${esc(q.get('q') || '')}" aria-label="Search orders"></label>
            <select class="select" data-payment aria-label="Payment status"><option value="">All payments</option>${DB.const.PAYMENT_STATUSES.map((p) => `<option value="${p.id}" ${payment === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
          </div>
          ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>
            ${list.slice(0, shown).map((o) => `<tr class="clickable" data-id="${esc(o.id)}">
              <td><strong class="num">${esc(o.number)}</strong><span class="cell-sub">${fmt.dateTime(o.createdAt)}</span></td>
              <td><strong style="font-weight:650">${esc(o.customer.name)}</strong><span class="cell-sub">${esc(o.customer.phone)}${o.delivery.state ? ` · ${esc(o.delivery.state)}` : ' · Pickup'}</span></td>
              <td><div style="display:flex;align-items:center;gap:8px"><div class="thumb-stack">${o.items.slice(0, 3).map((l) => `<img src="${esc(thumb(l.image))}" alt="">`).join('')}${o.items.length > 3 ? `<span>+${o.items.length - 3}</span>` : ''}</div><span class="muted">${o.items.reduce((s, l) => s + l.qty, 0)}</span>${o.items.some((l) => l.preorder) ? `<span class="pill blue" style="height:20px;font-size:11px">Pre-order</span>` : ''}</div></td>
              <td>${pill.payment(o.paymentStatus)}<span class="cell-sub">${esc(METHODS[o.paymentMethod]?.short || '')}</span></td>
              <td>${pill.order(o.status)}</td>
              <td class="r"><strong class="num">${money(o.total)}</strong></td></tr>`).join('')}
          </tbody></table></div>
          ${list.length > shown ? `<div class="table-foot"><span>Showing ${shown} of ${list.length}</span><button class="btn btn-outline btn-sm" type="button" data-more>Show more</button></div>` : ''}`
          : `<div class="empty"><div class="e-icon">${I('receipt')}</div><h4>${orders.length ? 'No orders match' : 'No orders yet'}</h4><p>${orders.length ? 'Try another status or search term.' : 'Orders placed on your storefront will appear here.'}</p></div>`}
        </div>`;

      const reRender = () => Admin.render();
      el.onclick = (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) { shown = PAGE; Admin.setQuery({ status: tab.dataset.tab === 'all' ? null : tab.dataset.tab }); reRender(); return; }
        const row = e.target.closest('tr[data-id]');
        if (row) { const qs = location.hash.split('?')[1]; Admin.go(`#/orders/${row.dataset.id}${qs ? `?${qs}` : ''}`); return; }
        if (e.target.closest('[data-more]')) { shown += PAGE; reRender(); return; }
        if (e.target.closest('[data-export]')) {
          Admin.csv(`chibest-orders-${Admin.today()}.csv`,
            ['Order', 'Date', 'Status', 'Payment status', 'Payment method', 'Customer', 'Phone', 'Email', 'State', 'City', 'Address', 'Items', 'Units', 'Subtotal', 'Delivery', 'Total', 'Est. gross profit'],
            list.map((o) => [o.number, fmt.dateTime(o.createdAt), label(o.status), o.paymentStatus, METHODS[o.paymentMethod]?.label, o.customer.name, o.customer.phone, o.customer.email, o.delivery.state, o.delivery.city, o.delivery.address,
              o.items.map((l) => `${l.name}${Object.keys(l.options || {}).length ? ` (${Object.values(l.options).join('/')})` : ''} x${l.qty}`).join('; '),
              o.items.reduce((s, l) => s + l.qty, 0), o.subtotal, o.deliveryFee, o.total, o.items.reduce((s, l) => s + (l.price - (l.unitCost || 0)) * l.qty, 0)]));
        }
      };
      let t;
      $('[data-search]', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { shown = PAGE; Admin.setQuery({ q: e.target.value }); reRender(); }, 250); });
      $('[data-payment]', el).addEventListener('change', (e) => { Admin.setQuery({ payment: e.target.value }); reRender(); });
      if (search) { const s = $('[data-search]', el); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }

      if (route.id && (!Admin.activeDrawer || Admin.activeDrawer.orderId !== route.id)) {
        const d = await openOrder(route.id, {
          onChange: () => { const qs = location.hash.split('?')[1]; Admin.go(`#/orders${qs ? `?${qs}` : ''}`, { replace: true }); }
        });
        if (d) d.orderId = route.id;
      } else if (!route.id && Admin.activeDrawer) Admin.activeDrawer.close(true);
    }
  });
})();
