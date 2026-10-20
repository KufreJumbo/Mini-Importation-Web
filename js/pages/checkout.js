// Checkout + order confirmation
UI.boot({ page: 'checkout', minimal: true }).then((ctx) => {
  const { $, $$, esc, money, I, thumb } = UI;
  const s = ctx.settings;
  const root = $('[data-checkout]');
  const pay = s.payments || {};
  const d = s.delivery || {};
  const params = new URLSearchParams(location.search);

  // Confirmation view (after an order is placed, or on refresh)
  const orderParam = params.get('order');
  if (orderParam) {
    let last = null;
    try { last = JSON.parse(sessionStorage.getItem('chibest.lastOrder') || 'null'); } catch (e) { /* ignore */ }
    renderConfirmation(last && last.number === orderParam ? last : null, orderParam);
    return;
  }

  const items = UI.Cart.items();
  if (!items.length) {
    root.innerHTML = `<div class="card" style="margin:40px 0 80px"><div class="empty"><div class="empty-art">${I('bag')}</div><h3>Your cart is empty</h3><p>Add something you love, then come back to check out.</p><a class="btn btn-primary btn-lg" href="shop.html">Continue shopping</a></div></div>`;
    return;
  }

  const saved = UI.Cart && (() => { try { return JSON.parse(localStorage.getItem('chibest.customer') || '{}'); } catch (e) { return {}; } })();
  const state = {
    method: 'delivery',
    state: saved.state || '',
    payment: pay.bankTransfer !== false ? 'bank_transfer' : pay.payOnDelivery ? 'pay_on_delivery' : 'whatsapp'
  };

  const field = (id, label, input, hint = '') => `<div class="field" data-field="${id}"><label for="f-${id}">${label}</label>${input}${hint ? `<span class="field-hint">${hint}</span>` : ''}<span class="field-error"></span></div>`;

  root.innerHTML = `
    <div class="checkout-layout">
      <form class="card" data-form novalidate>
        <section class="co-step">
          <div class="co-step-head"><span class="co-step-num">1</span><div><h2>Contact details</h2><p>We'll send order updates to this number on WhatsApp.</p></div></div>
          <div class="form-grid cols-2">
            <div class="span-2">${field('name', 'Full name', `<input class="input" id="f-name" name="name" autocomplete="name" value="${esc(saved.name || '')}" required>`)}</div>
            ${field('phone', 'Phone / WhatsApp number', `<input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="${esc(saved.phone || '')}" required>`)}
            ${field('email', 'Email <span class="opt">(optional)</span>', `<input class="input" id="f-email" name="email" type="email" autocomplete="email" value="${esc(saved.email || '')}">`)}
          </div>
        </section>

        <section class="co-step">
          <div class="co-step-head"><span class="co-step-num">2</span><div><h2>Delivery</h2><p>Choose how you'd like to receive your order.</p></div></div>
          <div class="choices" data-field="method" style="margin-bottom:18px">
            <label class="choice"><input type="radio" name="method" value="delivery" checked><span class="radio"></span><span class="choice-icon">${I('truck')}</span><span class="choice-body"><span class="choice-title">Home delivery<span data-fee-label></span></span><span class="choice-sub">Lagos ${esc(d.lagosTime)} · Other states ${esc(d.otherTime)}</span></span></label>
            ${d.pickupEnabled ? `<label class="choice"><input type="radio" name="method" value="pickup"><span class="radio"></span><span class="choice-icon">${I('store')}</span><span class="choice-body"><span class="choice-title">Pickup in Lagos<span>Free</span></span><span class="choice-sub">${esc(d.pickupNote || '')}</span></span></label>` : ''}
          </div>
          <div class="form-grid cols-2" data-address>
            ${field('state', 'State', `<select class="select" id="f-state" name="state" autocomplete="address-level1"><option value="">Select state</option>${DB.const.NG_STATES.map((x) => `<option ${x === state.state ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}
            ${field('city', 'City / area', `<input class="input" id="f-city" name="city" autocomplete="address-level2" placeholder="e.g. Lekki Phase 1" value="${esc(saved.city || '')}">`)}
            <div class="span-2">${field('address', 'Street address', `<input class="input" id="f-address" name="address" autocomplete="street-address" placeholder="House number and street" value="${esc(saved.address || '')}">`)}</div>
            <div class="span-2">${field('landmark', 'Nearest landmark <span class="opt">(optional)</span>', `<input class="input" id="f-landmark" name="landmark" placeholder="Helps our rider find you" value="${esc(saved.landmark || '')}">`)}</div>
          </div>
        </section>

        <section class="co-step">
          <div class="co-step-head"><span class="co-step-num">3</span><div><h2>Payment</h2><p>No card details needed. Pay securely by transfer or on delivery.</p></div></div>
          <div class="choices" data-field="payment">
            ${pay.bankTransfer !== false ? `<label class="choice"><input type="radio" name="payment" value="bank_transfer"><span class="radio"></span><span class="choice-icon">${I('banknote')}</span><span class="choice-body"><span class="choice-title">Bank transfer</span><span class="choice-sub">Transfer after placing your order. Account details are shown on the next screen.</span></span></label>` : ''}
            ${pay.payOnDelivery ? `<label class="choice"><input type="radio" name="payment" value="pay_on_delivery"><span class="radio"></span><span class="choice-icon">${I('wallet')}</span><span class="choice-body"><span class="choice-title">Pay on delivery</span><span class="choice-sub" data-pod-note>${pay.payOnDeliveryLagosOnly ? 'Cash or transfer when your order arrives. Lagos only.' : 'Cash or transfer when your order arrives.'}</span></span></label>` : ''}
            <label class="choice"><input type="radio" name="payment" value="whatsapp"><span class="radio"></span><span class="choice-icon"><i class="fa-brands fa-whatsapp" style="font-size:20px;color:#1faa53"></i></span><span class="choice-body"><span class="choice-title">Confirm on WhatsApp</span><span class="choice-sub">Our team will message you to confirm details and payment.</span></span></label>
            <span class="field-error"></span>
          </div>
          <div style="margin-top:18px">${field('notes', 'Order notes <span class="opt">(optional)</span>', `<textarea class="textarea" id="f-notes" name="notes" rows="3" style="min-height:90px" placeholder="Anything we should know? e.g. preferred delivery time"></textarea>`)}</div>
          <label class="check" style="margin-top:18px"><input type="checkbox" name="remember" ${saved.name ? 'checked' : ''}><span>Save my details on this device for next time</span></label>
        </section>
      </form>

      <aside class="card summary co-summary" data-summary></aside>
    </div>`;

  const form = $('[data-form]');
  $(`input[name="payment"][value="${state.payment}"]`, form).checked = true;

  function delivery() {
    return { method: state.method, state: form.state.value, city: form.city.value, address: form.address.value, landmark: form.landmark.value };
  }

  async function renderSummary() {
    const q = await DB.quote(UI.Cart.items(), delivery());
    const sum = $('[data-summary]');
    const feeKnown = state.method === 'pickup' || q.delivery.free || !!form.state.value;
    const feeText = state.method === 'pickup' || q.delivery.free ? '<span class="free">Free</span>' : form.state.value ? money(q.deliveryFee) : '<span class="muted">Select a state</span>';
    const shownTotal = feeKnown ? q.total : q.subtotal;
    sum.innerHTML = `<div class="card-pad">
      <h2 class="card-title" style="margin-bottom:8px">Order summary <a class="link-arrow" style="font-size:13.5px" href="cart.html">Edit</a></h2>
      <div class="co-lines">${q.lines.map((l) => `<div class="line-item">
        <div class="line-thumb"><img src="${esc(thumb(l.image) || UI.PLACEHOLDER)}" alt=""><span class="qty-dot">${l.qty}</span></div>
        <div><div class="line-top"><span class="line-name">${esc(l.name)}</span><span class="line-price">${money(l.lineTotal)}</span></div>
          <div class="line-meta">${Object.keys(l.options).length ? `<span>${UI.optionText(l.options)}</span>` : ''}${l.preorder ? '<span style="color:var(--blue);font-weight:650">Pre-order</span>' : ''}</div>
          ${l.issue ? `<div class="line-warning">${I('alert-triangle')}${esc(l.issue.message)}</div>` : ''}</div></div>`).join('')}</div>
      <div class="totals" style="margin-top:14px;padding-top:16px;border-top:1px solid var(--line)">
        <div class="totals-row"><span class="muted">Subtotal</span><span>${money(q.subtotal)}</span></div>
        <div class="totals-row"><span class="muted">Delivery${q.delivery.zone && state.method !== 'pickup' ? ` · ${esc(q.delivery.zone)}` : ''}</span><span>${feeText}</span></div>
        <div class="totals-row grand"><span>Total${feeKnown ? '' : ' <small class="muted" style="font-weight:600;font-size:13px">+ delivery</small>'}</span><span>${money(shownTotal)}</span></div>
      </div>
      ${q.hasPreorder ? `<div class="pay-details" style="display:flex;gap:10px">${I('plane')}<span>Your order includes pre-order items that arrive in about <strong>${esc(s.preorderLeadTime)}</strong>. We'll ship everything together unless you ask otherwise.</span></div>` : ''}
      ${q.hasIssues ? `<div class="line-warning" style="margin-top:14px">${I('alert-triangle')}Please <a class="link" href="cart.html">update your cart</a> before placing the order.</div>` : ''}
      <button class="btn btn-primary btn-lg btn-block" type="button" data-place ${q.hasIssues ? 'disabled' : ''}>${I('lock')}Place order${feeKnown ? ` · ${money(q.total)}` : ''}</button>
      <p class="legal-note">By placing your order you agree to our <a class="link" href="help.html#terms">terms of sale</a>.</p>
    </div>`;
    const feeLabel = $('[data-fee-label]');
    if (feeLabel) feeLabel.textContent = form.state.value ? (q.delivery.free ? 'Free' : money(state.method === 'delivery' ? q.deliveryFee : d.lagosFee)) : `From ${money(Math.min(d.lagosFee, d.otherFee))}`;
    $('[data-place]').addEventListener('click', place);
  }

  function syncPayOnDelivery() {
    const pod = $('input[value="pay_on_delivery"]', form);
    if (!pod) return;
    const allowed = !pay.payOnDeliveryLagosOnly || state.method === 'pickup' || form.state.value === 'Lagos' || !form.state.value;
    pod.disabled = !allowed;
    if (!allowed && pod.checked) { pod.checked = false; $(`input[name="payment"]:not(:disabled)`, form).checked = true; }
  }

  function setErrors(errs = {}) {
    $$('[data-field]', form).forEach((f) => {
      const msg = errs[f.dataset.field];
      f.classList.toggle('has-error', !!msg);
      const el = $('.field-error', f);
      if (el) el.textContent = msg || '';
    });
    const first = $('.has-error', form);
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('input,select,textarea', first)?.focus({ preventScroll: true }); }
  }

  async function place() {
    const btn = $('[data-place]');
    const payload = {
      customer: { name: form.name.value, phone: form.phone.value, email: form.email.value },
      delivery: delivery(),
      paymentMethod: $('input[name="payment"]:checked', form)?.value,
      notes: form.notes.value,
      items: UI.Cart.items().map((i) => ({ productId: i.productId, qty: i.qty, options: i.options }))
    };
    setErrors({});
    btn.classList.add('is-loading');
    try {
      const order = await DB.orders.place(payload);
      if (form.remember.checked) localStorage.setItem('chibest.customer', JSON.stringify({ name: payload.customer.name, phone: payload.customer.phone, email: payload.customer.email, state: payload.delivery.state, city: payload.delivery.city, address: payload.delivery.address, landmark: payload.delivery.landmark }));
      else localStorage.removeItem('chibest.customer');
      sessionStorage.setItem('chibest.lastOrder', JSON.stringify(order));
      UI.MyOrders.add(order);
      UI.Cart.clear();
      history.replaceState(null, '', `checkout.html?order=${encodeURIComponent(order.number)}`);
      window.scrollTo(0, 0);
      renderConfirmation(order, order.number);
    } catch (err) {
      btn.classList.remove('is-loading');
      if (err.code === 'VALIDATION' && err.details) { setErrors(err.details); UI.toast({ type: 'error', title: 'Please check your details', sub: err.message }); }
      else { UI.toast({ type: 'error', title: "We couldn't place your order", sub: err.message, duration: 6000 }); renderSummary(); }
    }
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'method') {
      state.method = e.target.value;
      $('[data-address]').hidden = state.method === 'pickup';
    }
    if (e.target.name === 'method' || e.target.name === 'state') { syncPayOnDelivery(); renderSummary(); }
    const f = e.target.closest('[data-field]');
    if (f) f.classList.remove('has-error');
  });
  form.addEventListener('input', (e) => { const f = e.target.closest('[data-field]'); if (f) f.classList.remove('has-error'); });
  syncPayOnDelivery();
  renderSummary();

  // ---------------------------------------------------------------
  function renderConfirmation(order, number) {
    const total = order ? money(order.total) : '';
    const method = order?.paymentMethod;
    const hasBank = pay.bankName && pay.accountNumber;
    const wa = UI.waLink(`Hello Chi-Best! I just placed order ${number}${order ? ` (total ${money(order.total)})` : ''}. ${method === 'bank_transfer' ? "Here is my payment receipt:" : 'Please confirm my order.'}`);
    const bankBlock = method === 'bank_transfer' ? (hasBank ? `
        <div class="card card-pad">
          <h2 class="card-title start">${I('banknote')} Pay by bank transfer</h2>
          <p class="muted" style="margin-top:6px;font-size:14px">Transfer <strong style="color:var(--ink)">${total}</strong> to the account below, using your order number as the reference.</p>
          <div class="bank-rows">
            <div class="bank-row"><span>Bank</span><strong>${esc(pay.bankName)}</strong></div>
            <div class="bank-row"><span>Account name</span><strong>${esc(pay.accountName)}</strong></div>
            <div class="bank-row"><span>Account number</span><strong>${esc(pay.accountNumber)} <button class="copy-btn" type="button" data-copy="${esc(pay.accountNumber)}">${I('copy')}Copy</button></strong></div>
            <div class="bank-row"><span>Amount</span><strong>${total}</strong></div>
            <div class="bank-row"><span>Reference</span><strong>${esc(number)} <button class="copy-btn" type="button" data-copy="${esc(number)}">${I('copy')}Copy</button></strong></div>
          </div>
          <a class="btn btn-whatsapp btn-block" style="margin-top:16px" href="${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>Send payment receipt on WhatsApp</a>
        </div>` : `
        <div class="card card-pad">
          <h2 class="card-title start">${I('banknote')} Pay by bank transfer</h2>
          <p class="muted" style="margin-top:8px">Our team will send our account details on WhatsApp shortly. You can also message us now to get them straight away.</p>
          <a class="btn btn-whatsapp btn-block" style="margin-top:16px" href="${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>Get payment details on WhatsApp</a>
        </div>`) : `
        <div class="card card-pad">
          <h2 class="card-title start">${I(method === 'pay_on_delivery' ? 'wallet' : 'message')} ${method === 'pay_on_delivery' ? 'Pay on delivery' : 'We\'ll confirm on WhatsApp'}</h2>
          <p class="muted" style="margin-top:8px">${method === 'pay_on_delivery' ? `Please have <strong style="color:var(--ink)">${total}</strong> ready (cash or transfer) when your order arrives. We'll call before delivery.` : 'Our team will message you shortly to confirm your order and payment.'}</p>
          <a class="btn btn-whatsapp btn-block" style="margin-top:16px" href="${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>Message us on WhatsApp</a>
        </div>`;

    root.innerHTML = `
      <div class="confirm-hero">
        <div class="confirm-check">${I('check')}</div>
        <h1>Thank you${order ? `, ${esc(order.customer.name.split(' ')[0])}` : ''}!</h1>
        <p>Your order has been placed. We've saved it and will keep you updated on WhatsApp.</p>
        <div class="order-no">Order ${esc(number)} <button class="copy-btn" type="button" data-copy="${esc(number)}">${I('copy')}Copy</button></div>
      </div>
      <div class="confirm-grid">
        <div style="display:grid;gap:20px;align-content:start">
          ${bankBlock}
          <div class="card card-pad">
            <h2 class="card-title">What happens next</h2>
            <ol class="next-steps" style="margin-top:16px">
              <li><span class="ns-n">1</span><div><strong>We confirm your order</strong><span>${method === 'bank_transfer' ? 'As soon as your transfer is received.' : 'Our team checks stock and confirms with you.'}</span></div></li>
              <li><span class="ns-n">2</span><div><strong>We pack and ship</strong><span>${order?.items?.some((i) => i.preorder) ? `Pre-order items arrive in about ${esc(s.preorderLeadTime)}.` : `Delivery takes ${esc(order?.delivery?.state === 'Lagos' ? d.lagosTime : d.otherTime)}.`}</span></div></li>
              <li><span class="ns-n">3</span><div><strong>Track every step</strong><span>Use your order number and phone number on the tracking page.</span></div></li>
            </ol>
            <a class="btn btn-outline btn-block" style="margin-top:20px" href="track.html?order=${encodeURIComponent(number)}">${I('truck')}Track this order</a>
          </div>
        </div>
        ${order ? `<div class="card card-pad co-summary" style="align-self:start">
          <h2 class="card-title" style="margin-bottom:6px">Order summary</h2>
          ${order.items.map((l) => `<div class="line-item"><div class="line-thumb"><img src="${esc(thumb(l.image) || UI.PLACEHOLDER)}" alt=""><span class="qty-dot">${l.qty}</span></div><div><div class="line-top"><span class="line-name">${esc(l.name)}</span><span class="line-price">${money(l.lineTotal)}</span></div><div class="line-meta">${Object.keys(l.options || {}).length ? `<span>${UI.optionText(l.options)}</span>` : ''}${l.preorder ? '<span style="color:var(--blue);font-weight:650">Pre-order</span>' : ''}</div></div></div>`).join('')}
          <div class="totals" style="margin-top:14px;padding-top:16px;border-top:1px solid var(--line)">
            <div class="totals-row"><span class="muted">Subtotal</span><span>${money(order.subtotal)}</span></div>
            <div class="totals-row"><span class="muted">Delivery</span><span>${order.deliveryFee ? money(order.deliveryFee) : '<span class="free">Free</span>'}</span></div>
            <div class="totals-row grand"><span>Total</span><span>${money(order.total)}</span></div>
          </div>
          <div class="pay-details"><strong style="color:var(--ink)">${order.delivery.method === 'pickup' ? 'Pickup in Lagos' : 'Deliver to'}</strong><br>${order.delivery.method === 'pickup' ? esc(d.pickupNote || '') : `${esc(order.customer.name)}<br>${esc(order.delivery.address)}, ${esc(order.delivery.city)}, ${esc(order.delivery.state)}`}</div>
          <a class="btn btn-ghost btn-block" style="margin-top:12px" href="shop.html">Continue shopping ${I('arrow-right')}</a>
        </div>` : ''}
      </div>`;
    root.addEventListener('click', (e) => { const c = e.target.closest('[data-copy]'); if (c) UI.copy(c.dataset.copy); });
    const back = document.querySelector('.checkout-head .btn');
    if (back) { back.href = 'shop.html'; back.innerHTML = `<span>Continue shopping</span>${I('arrow-right')}`; }
    const secure = document.querySelector('.secure-pill');
    if (secure) secure.innerHTML = `${I('check-circle')}Order confirmed`;
  }
});
