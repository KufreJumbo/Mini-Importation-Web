// Cart page
UI.boot({ page: 'cart' }).then((ctx) => {
  const { $, esc, money, I } = UI;
  const root = $('[data-cart-page]');
  const s = ctx.settings;

  async function render() {
    const items = UI.Cart.items();
    if (!items.length) {
      root.innerHTML = `<div class="card" style="margin:12px 0 80px"><div class="empty"><div class="empty-art">${I('bag')}</div><h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet. Explore new arrivals or tell us what you're looking for.</p>
        <a class="btn btn-primary btn-lg" href="shop.html">Start shopping</a><a class="btn btn-ghost" href="request.html">${I('sparkles')}Request a product</a></div></div>`;
      renderSuggestions([]);
      return;
    }
    const q = await DB.quote(items, { method: 'delivery', state: '' });
    const byKey = new Map(items.map((i) => [`${i.productId}#${DB.util.optionsKey(i.options)}`, i]));
    const lineFor = (l) => UI.lineItemHtml(l, byKey.get(`${l.productId}#${DB.util.optionsKey(l.options)}`) || { key: '' });
    const ready = q.lines.filter((l) => !l.preorder);
    const pre = q.lines.filter((l) => l.preorder);
    const d = s.delivery || {};

    root.innerHTML = `<div class="cart-layout">
      <div class="card card-pad">
        <div class="card-title"><span>${q.count} item${q.count === 1 ? '' : 's'}</span><button class="btn btn-ghost btn-xs" type="button" data-clear>${I('trash')}Clear cart</button></div>
        <div class="cart-lines">
          ${pre.length && ready.length ? `<div class="group-label">${I('store')}Ships from Lagos</div>` : ''}
          ${ready.map(lineFor).join('')}
          ${pre.length ? `<div class="group-label" style="color:var(--blue)">${I('plane')}Pre-order · arrives in about ${esc(s.preorderLeadTime)}</div>${pre.map(lineFor).join('')}` : ''}
        </div>
      </div>
      <aside class="card summary">
        ${UI.shipProgressHtml(q.subtotal).replace('class="ship-progress', 'style="border-radius:18px 18px 0 0" class="ship-progress')}
        <div class="card-pad">
          <h2 class="card-title" style="margin-bottom:18px">Order summary</h2>
          <div class="totals">
            <div class="totals-row"><span class="muted">Subtotal (${q.count} item${q.count === 1 ? '' : 's'})</span><strong>${money(q.subtotal)}</strong></div>
            <div class="totals-row"><span class="muted">Delivery</span><span>${q.delivery.free ? '<span class="free">Free</span>' : `<span class="muted">From </span>${money(Math.min(d.lagosFee, d.otherFee))}`}</span></div>
            <div class="totals-row grand"><span>Estimated total</span><span>${money(q.subtotal + (q.delivery.free ? 0 : Math.min(d.lagosFee, d.otherFee)))}</span></div>
          </div>
          ${q.hasIssues ? `<div class="line-warning" style="margin-top:14px">${I('alert-triangle')}Some items need attention before checkout.</div>` : ''}
          <a class="btn btn-primary btn-lg btn-block ${q.hasIssues || !q.count ? 'is-disabled' : ''}" href="checkout.html">${I('lock')}Proceed to checkout</a>
          <a class="btn btn-outline btn-block" style="margin-top:10px" target="_blank" rel="noopener" href="${UI.waLink(whatsappOrder(q))}"><i class="fa-brands fa-whatsapp" style="color:#1faa53;font-size:18px"></i>Order via WhatsApp instead</a>
          <ul class="trust-list">
            <li>${I('shield')}Every item checked before dispatch</li>
            <li>${I('rotate-ccw')}${esc(s.returnsDays)}-day returns on faulty items</li>
            <li>${I('truck')}Track your order online and on WhatsApp</li>
          </ul>
        </div>
      </aside>
    </div>`;
    renderSuggestions(items);
  }

  function whatsappOrder(q) {
    const lines = q.lines.filter((l) => !l.issue).map((l, i) => `${i + 1}. ${l.name}${Object.keys(l.options).length ? ` (${Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''} x${l.qty} = ${money(l.lineTotal)}${l.preorder ? ' [pre-order]' : ''}`);
    return `Hello Chi-Best! I'd like to order:\n\n${lines.join('\n')}\n\nSubtotal: ${money(q.subtotal)}\n\nPlease confirm availability and delivery to: `;
  }

  function renderSuggestions(items) {
    const inCart = new Set(items.map((i) => i.productId));
    const cats = new Set(items.map((i) => ctx.byId.get(i.productId)?.categoryId).filter(Boolean));
    const pool = ctx.products.filter((p) => !inCart.has(p.id) && DB.util.availability(p, s).canBuy);
    const list = [...pool.filter((p) => cats.has(p.categoryId)), ...pool.filter((p) => !cats.has(p.categoryId) && p.featured)].slice(0, 10);
    $('[data-suggest]').innerHTML = list.map((p) => UI.productCard(p)).join('');
    $('[data-suggest-section]').hidden = !list.length;
  }

  UI.bindLineItems(root, render);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]') && confirm('Remove all items from your cart?')) { UI.Cart.clear(); render(); }
  });
  document.addEventListener('cart:change', () => { if (!root.contains(document.activeElement)) render(); });
  render();
});
