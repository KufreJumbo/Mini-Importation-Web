// Sourcing requests: customers asking us to find a product.
Admin.view('requests', {
  live: true,
  keepsDrawer: true,
  async render(el, route, isCurrent) {
    const { I, $, esc, money, fmt, pill } = Admin;
    Admin.setTitle('Sourcing requests');
    const { requests, settings } = await Admin.load('requests', 'settings');
    if (!isCurrent()) return;
    const status = route.query.get('status') || 'all';
    const STATUSES = DB.const.REQUEST_STATUSES;
    const counts = { all: requests.length };
    STATUSES.forEach((s) => { counts[s.id] = requests.filter((r) => r.status === s.id).length; });
    const list = requests.filter((r) => status === 'all' || r.status === status);
    const quoted = requests.filter((r) => r.quotedPrice);
    const won = requests.filter((r) => ['accepted', 'completed'].includes(r.status)).length;

    el.innerHTML = `
      <div class="page-head"><div><h2>Sourcing requests</h2><p>Products customers asked you to find. Quote them a landed price on WhatsApp.</p></div>
        <div class="page-actions"><a class="btn btn-outline" href="request.html" target="_blank">${I('external')}Request form</a></div></div>
      <div class="cols-4" style="margin-bottom:16px">
        ${[['New', counts.new || 0, 'inbox'], ['In progress', (counts.sourcing || 0) + (counts.quoted || 0), 'clock'], ['Accepted', won, 'check-circle'], ['Quote win rate', quoted.length ? fmt.pct((won / quoted.length) * 100) : '—', 'trending-up']]
          .map(([l, v, ic]) => `<div class="card stat mini-stat"><div class="stat-label">${I(ic)}${l}</div><div class="stat-value">${v}</div></div>`).join('')}
      </div>
      <div class="card">
        <div class="tabs">${[{ id: 'all', label: 'All' }, ...STATUSES].map((s) => `<button type="button" data-tab="${s.id}" class="${status === s.id ? 'is-on' : ''}">${s.label}<span class="n">${counts[s.id] || 0}</span></button>`).join('')}</div>
        ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Request</th><th>Customer</th><th>Looking for</th><th class="r">Qty</th><th>Quote</th><th>Status</th></tr></thead><tbody>
          ${list.map((r) => `<tr class="clickable" data-id="${esc(r.id)}">
            <td><strong class="num">${esc(r.reference)}</strong><span class="cell-sub">${fmt.relative(r.createdAt)}</span></td>
            <td><strong style="font-weight:650">${esc(r.customerName)}</strong><span class="cell-sub">${esc(r.whatsapp)}${r.location ? ` · ${esc(r.location)}` : ''}</span></td>
            <td style="max-width:360px"><div style="display:flex;gap:10px;align-items:center">${Admin.safeUrl(r.images?.[0], { image: true }) ? `<img class="thumb-sm" src="${esc(Admin.safeUrl(r.images[0], { image: true }))}" alt="" style="width:38px;height:38px">` : ''}<span class="ellipsis">${esc(r.description)}</span></div></td>
            <td class="r num">${r.quantity}</td>
            <td class="num">${r.quotedPrice ? money(r.quotedPrice) : '<span class="subtle">—</span>'}</td>
            <td>${pill.request(r.status)}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><div class="e-icon">${I('inbox')}</div><h4>No requests here</h4><p>Requests from the "Request a product" page appear here.</p></div>`}
      </div>`;

    el.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { Admin.setQuery({ status: tab.dataset.tab === 'all' ? null : tab.dataset.tab }); Admin.render(); return; }
      const row = e.target.closest('tr[data-id]');
      if (row) Admin.go(`#/requests/${row.dataset.id}${location.hash.includes('?') ? '?' + location.hash.split('?')[1] : ''}`);
    });

    if (route.id && (!Admin.activeDrawer || Admin.activeDrawer.reqId !== route.id)) {
      const r = requests.find((x) => x.id === route.id);
      if (!r) return;
      const quoteMsg = (price, days) => `Hi ${r.customerName.split(' ')[0]}, thanks for your Chi-Best sourcing request ${r.reference}.\n\nWe found it! ${r.quantity > 1 ? `${r.quantity} units` : 'The item'} will cost ${money(price)}${r.quantity > 1 ? ' each' : ''}, delivered to you${days ? ` in about ${days}` : ''}.\n\nReply YES to confirm and we'll send payment details.`;
      const d = Admin.drawer({
        title: `Request ${esc(r.reference)}`, sub: `${esc(r.customerName)} · ${fmt.dateTime(r.createdAt)}`, width: 640,
        actions: `<a class="btn btn-whatsapp btn-sm" href="${Admin.whatsapp(r.whatsapp, `Hi ${r.customerName.split(' ')[0]}, about your sourcing request ${r.reference}: `)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>Chat</a>`,
        body: `<div class="card card-body stack">
            <div><div class="section-title" style="margin:0 0 6px">Looking for</div><p style="font-size:15px;white-space:pre-wrap">${esc(r.description)}</p></div>
            ${(r.images || []).map((u) => Admin.safeUrl(u, { image: true })).filter(Boolean).length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${r.images.map((u) => Admin.safeUrl(u, { image: true })).filter(Boolean).map((src) => `<button type="button" data-view-img="${esc(src)}" style="padding:0"><img src="${esc(src)}" alt="Reference photo" style="width:110px;height:110px;object-fit:cover;border-radius:12px;border:1px solid var(--line)"></button>`).join('')}</div>` : ''}
            <dl class="kv">${r.link ? `<dt>Link</dt><dd>${Admin.safeUrl(r.link) ? `<a class="card-link" href="${esc(Admin.safeUrl(r.link))}" target="_blank" rel="noopener noreferrer">${esc(r.link.length > 60 ? r.link.slice(0, 60) + '…' : r.link)} ${I('external')}</a>` : esc(r.link)}</dd>` : ''}
              <dt>Quantity</dt><dd>${r.quantity}</dd>${r.budget ? `<dt>Budget</dt><dd>${esc(r.budget)}</dd>` : ''}${r.category ? `<dt>Category</dt><dd>${esc(r.category)}</dd>` : ''}<dt>Deliver to</dt><dd>${esc(r.location || 'Not given')}</dd><dt>WhatsApp</dt><dd>${esc(r.whatsapp)}</dd></dl>
          </div>
          <form class="card card-body stack" data-req-form>
            <div class="section-title" style="margin:0">Quote &amp; progress</div>
            <div class="grid-3">
              <div class="field"><label for="r-status">Status</label><select class="select" id="r-status" name="status">${STATUSES.map((s) => `<option value="${s.id}" ${r.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
              <div class="field"><label for="r-price">Quoted price ${r.quantity > 1 ? '<span class="opt">per unit</span>' : ''}</label><div class="affix"><span>₦</span><input class="input num" id="r-price" name="quotedPrice" type="number" min="0" value="${esc(r.quotedPrice ?? '')}"></div></div>
              <div class="field"><label for="r-days">Delivery time</label><input class="input" id="r-days" name="quotedDays" value="${esc(r.quotedDays || settings.preorderLeadTime)}"></div>
            </div>
            <div class="field"><label for="r-notes">Internal notes <span class="opt">supplier, cost, links</span></label><textarea class="textarea" id="r-notes" name="adminNotes" rows="3">${esc(r.adminNotes)}</textarea></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <a class="btn btn-whatsapp" data-send-quote target="_blank" rel="noopener" href="#"><i class="fa-brands fa-whatsapp"></i>Send quote</a>
              <button class="btn btn-primary" type="submit">Save</button>
            </div>
          </form>`,
        onClose: (silent) => { if (!silent) Admin.go(`#/requests${location.hash.includes('?') ? '?' + location.hash.split('?')[1] : ''}`, { replace: true }); },
        onMount(dr) {
          const form = dr.$('[data-req-form]');
          const syncLink = () => {
            const a = dr.$('[data-send-quote]');
            const price = Number(form.quotedPrice.value);
            a.href = price ? Admin.whatsapp(r.whatsapp, quoteMsg(price, form.quotedDays.value)) : '#';
            a.classList.toggle('is-disabled', !price);
            a.style.opacity = price ? '' : '.5';
          };
          dr.el.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-view-img]');
            if (b) Admin.modal({ title: 'Reference photo', size: 'lg', body: `<img src="${esc(b.dataset.viewImg)}" alt="" style="width:100%;border-radius:12px;margin-bottom:16px">` });
          });
          form.addEventListener('input', syncLink);
          syncLink();
          dr.$('[data-send-quote]').addEventListener('click', async (ev) => {
            if (!Number(form.quotedPrice.value)) { ev.preventDefault(); Admin.toast('Enter a quoted price first', { type: 'error' }); return; }
            if (form.status.value === 'new' || form.status.value === 'sourcing') form.status.value = 'quoted';
            await DB.requests.update(r.id, Object.fromEntries(new FormData(form)));
            Admin.invalidate('requests');
            Admin.toast('Quote saved', { sub: 'WhatsApp opened with your quote.' });
          });
          form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const btn = $('button[type="submit"]', form);
            btn.classList.add('is-loading');
            try {
              await DB.requests.update(r.id, Object.fromEntries(new FormData(form)));
              Admin.invalidate('requests');
              Admin.toast('Request updated');
              dr.close();
            } catch (err) { btn.classList.remove('is-loading'); Admin.toast(err.message, { type: 'error' }); }
          });
        }
      });
      d.reqId = route.id;
    }
  }
});
