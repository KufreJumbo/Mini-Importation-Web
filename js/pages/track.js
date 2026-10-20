// Order tracking
UI.boot({ page: 'track' }).then((ctx) => {
  const { $, esc, money, I, thumb, fmtDate } = UI;
  const form = $('[data-track-form]');
  const result = $('[data-result]');
  const STATUSES = DB.const.ORDER_STATUSES;
  const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  const label = (id) => STATUSES.find((x) => x.id === id)?.label || id;

  function renderMine() {
    const mine = UI.MyOrders.list();
    $('[data-mine]').innerHTML = mine.length ? `<div class="card card-pad">
      <h2 class="card-title" style="margin-bottom:6px">Orders placed on this device</h2>
      ${mine.map((o) => `<div class="line-item" style="grid-template-columns:44px 1fr;align-items:center">
        <span class="choice-icon">${I('receipt')}</span>
        <div class="line-top" style="align-items:center"><div><strong>${esc(o.number)}</strong><div class="line-meta">${fmtDate(o.createdAt)} · ${money(o.total)}</div></div>
        <button class="btn btn-outline btn-sm" type="button" data-mine-track="${esc(o.number)}" data-phone="${esc(o.phone)}">Track</button></div></div>`).join('')}
    </div>` : '';
  }

  async function track(number, phone) {
    if (!number.trim() || DB.util.digits(phone).length < 10) {
      result.innerHTML = notice('alert', 'Enter both details', 'We need your order number and the phone number used at checkout.');
      return;
    }
    const btn = $('[data-track-submit]');
    btn.classList.add('is-loading');
    try {
      const o = await DB.orders.track(number, phone);
      result.innerHTML = o ? orderHtml(o) : notice('search', "We couldn't find that order", `Check the order number and phone number, or <a class="link" target="_blank" rel="noopener" href="${UI.waLink(`Hello Chi-Best! I need help tracking order ${number}.`)}">message us on WhatsApp</a>.`);
      if (o) history.replaceState(null, '', `track.html?order=${encodeURIComponent(o.number)}`);
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      result.innerHTML = notice('alert-triangle', 'Something went wrong', esc(e.message));
    } finally { btn.classList.remove('is-loading'); }
  }

  function notice(icon, title, text) {
    return `<div class="card"><div class="empty" style="padding:40px 24px"><div class="empty-art">${I(icon)}</div><h3>${esc(title)}</h3><p style="margin-bottom:0">${text}</p></div></div>`;
  }

  function orderHtml(o) {
    const cancelled = o.status === 'cancelled';
    const idx = FLOW.indexOf(o.status);
    const current = STATUSES.find((x) => x.id === o.status);
    const events = (o.events || []).slice().reverse();
    return `<div class="card">
      <div class="card-pad" style="border-bottom:1px solid var(--line)">
        <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:flex-start">
          <div><div class="muted" style="font-size:13px;font-weight:600">Order ${esc(o.number)} · ${fmtDate(o.createdAt)}</div>
            <h2 style="font-size:26px;letter-spacing:-0.035em;margin-top:6px">${esc(current?.label || o.status)}</h2>
            <p class="muted" style="margin-top:4px">${esc(current?.desc || '')}</p></div>
          <div style="text-align:right"><span class="status-chip s-${esc(o.status)}"><span class="dot"></span>${esc(label(o.status))}</span>
            <div style="margin-top:10px;font-weight:800;font-size:20px">${money(o.total)}</div>
            <div class="muted" style="font-size:13px">${o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Awaiting payment'} · ${esc(DB.const.PAYMENT_METHODS[o.paymentMethod]?.label || '')}</div></div>
        </div>
        ${cancelled ? '' : `<div class="progress-track" role="list" aria-label="Order progress">${FLOW.map((st, i) => `<div class="pt-step ${i < idx ? 'is-done' : ''} ${i === idx ? 'is-current is-done' : ''}" role="listitem"><span class="pt-dot">${I(i < idx ? 'check' : STATUSES.find((x) => x.id === st).icon)}</span><span>${esc(label(st))}</span></div>`).join('')}</div>`}
      </div>
      <div style="display:grid;gap:0" class="track-body">
        <div class="card-pad">
          <h3 style="font-size:16px;margin-bottom:16px">Updates</h3>
          <div class="timeline">${events.map((e) => `<div class="tl-item"><span class="tl-dot"></span><div>
            <strong>${esc(e.type === 'payment' ? 'Payment update' : e.type === 'note' ? 'Update' : label(e.status))}</strong>
            ${e.note && e.note !== 'Order placed' ? `<p>${esc(e.note)}</p>` : ''}
            <time datetime="${esc(e.at)}">${fmtDate(e.at, { time: true })}</time></div></div>`).join('')}</div>
        </div>
        <div class="card-pad" style="border-top:1px solid var(--line)">
          <h3 style="font-size:16px;margin-bottom:6px">Items</h3>
          ${o.items.map((l) => `<div class="line-item" style="grid-template-columns:56px 1fr"><div class="line-thumb" style="width:56px;height:56px"><img src="${esc(thumb(l.image) || UI.PLACEHOLDER)}" alt=""></div>
            <div><div class="line-top"><span class="line-name">${esc(l.name)}</span><span class="line-price">${money(l.lineTotal)}</span></div>
            <div class="line-meta"><span>Qty ${l.qty}</span>${Object.keys(l.options || {}).length ? `<span>${UI.optionText(l.options)}</span>` : ''}${l.preorder ? '<span style="color:var(--blue);font-weight:650">Pre-order</span>' : ''}</div></div></div>`).join('')}
          <div class="pay-details" style="display:flex;gap:10px;align-items:flex-start">${I(o.delivery.method === 'pickup' ? 'store' : 'map-pin')}<span>${o.delivery.method === 'pickup' ? 'Pickup in Lagos' : `Delivering to ${esc(o.delivery.city)}, ${esc(o.delivery.state)}`}${o.items.some((l) => l.preorder) ? ` · includes pre-order items (about ${esc(ctx.settings.preorderLeadTime)})` : o.delivery.eta ? ` · ${esc(o.delivery.eta)}` : ''}</span></div>
          <a class="btn btn-whatsapp btn-block" style="margin-top:16px" target="_blank" rel="noopener" href="${UI.waLink(`Hello Chi-Best! I have a question about my order ${o.number}.`)}"><i class="fa-brands fa-whatsapp"></i>Questions? Chat with us</a>
        </div>
      </div>
    </div>`;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); track(form.order.value, form.phone.value); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mine-track]');
    if (b) { form.order.value = b.dataset.mineTrack; form.phone.value = b.dataset.phone; track(b.dataset.mineTrack, b.dataset.phone); }
  });

  const params = new URLSearchParams(location.search);
  const pre = params.get('order');
  if (pre) {
    form.order.value = pre;
    const mine = UI.MyOrders.list().find((x) => x.number === pre);
    if (mine) { form.phone.value = mine.phone; track(pre, mine.phone); } else form.phone.focus();
  }
  renderMine();
});
