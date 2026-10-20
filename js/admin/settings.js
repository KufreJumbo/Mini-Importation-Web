// Store settings, security and data backup.
Admin.view('settings', {
  async render(el, route, isCurrent) {
    const { I, $, esc, money } = Admin;
    Admin.setTitle('Settings');
    const { settings: s } = await Admin.load('settings');
    if (!isCurrent()) return;
    const d = s.delivery || {}, p = s.payments || {};
    const field = (name, label, value, { type = 'text', prefix = '', hint = '', placeholder = '' } = {}) => `<div class="field" data-f="${name}"><label for="s-${name}">${label}</label>${prefix ? `<div class="affix"><span>${prefix}</span>` : ''}<input class="input${type === 'number' ? ' num' : ''}" id="s-${name}" name="${name}" type="${type}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}"${type === 'number' ? ' min="0"' : ''}>${prefix ? '</div>' : ''}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const toggle = (name, label, sub, on) => `<label class="switch"><div><strong>${label}</strong><small>${sub}</small></div><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span class="track"></span></label>`;
    let storageKb = 0;
    if (DB.isDemo) { try { for (const k of Object.keys(localStorage)) if (k.startsWith('chibest')) storageKb += (localStorage.getItem(k) || '').length * 2 / 1024; } catch (e) { /* ignore */ } }

    el.innerHTML = `
      <div class="page-head"><div><h2>Settings</h2><p>Changes apply to the storefront immediately after saving.</p></div></div>
      <form class="editor" data-settings novalidate>
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-head"><div><h3>Store details</h3><p>Shown in the footer, help page, invoices and WhatsApp links.</p></div></div><div class="card-body stack">
            <div class="grid-2">${field('storeName', 'Store name', s.storeName)}${field('tagline', 'Tagline', s.tagline)}</div>
            <div class="grid-2">${field('whatsapp', 'WhatsApp number', s.whatsapp, { hint: 'International format without + or spaces, e.g. 2348031234567', placeholder: '2348031234567' })}${field('phone', 'Phone (displayed)', s.phone)}</div>
            <div class="grid-2">${field('email', 'Email', s.email, { type: 'email' })}${field('address', 'Location', s.address)}</div>
            <div class="grid-3">${field('instagram', 'Instagram URL', s.instagram, { placeholder: 'https://instagram.com/…' })}${field('facebook', 'Facebook URL', s.facebook)}${field('tiktok', 'TikTok URL', s.tiktok)}</div>
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Delivery &amp; fees</h3><p>Used to calculate delivery at checkout.</p></div></div><div class="card-body stack">
            <div class="grid-2">${field('d.lagosFee', 'Lagos delivery fee', d.lagosFee, { type: 'number', prefix: '₦' })}${field('d.lagosTime', 'Lagos delivery time', d.lagosTime)}</div>
            <div class="grid-2">${field('d.otherFee', 'Other states fee', d.otherFee, { type: 'number', prefix: '₦' })}${field('d.otherTime', 'Other states delivery time', d.otherTime)}</div>
            ${field('d.freeThreshold', 'Free delivery on orders over', d.freeThreshold, { type: 'number', prefix: '₦', hint: 'Set to 0 to turn off free delivery.' })}
            ${toggle('d.pickupEnabled', 'Allow pickup', 'Customers can collect their order in Lagos for free.', d.pickupEnabled)}
            ${field('d.pickupNote', 'Pickup instructions', d.pickupNote)}
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Payments</h3><p>Bank details are shown to customers after they place an order.</p></div></div><div class="card-body stack">
            ${toggle('p.bankTransfer', 'Bank transfer', 'Customers transfer after ordering and send you the receipt.', p.bankTransfer !== false)}
            <div class="grid-3">${field('p.bankName', 'Bank', p.bankName, { placeholder: 'e.g. GTBank' })}${field('p.accountName', 'Account name', p.accountName)}${field('p.accountNumber', 'Account number', p.accountNumber, { placeholder: '10 digits' })}</div>
            ${!p.accountNumber ? `<p class="hint" style="color:var(--amber)">${I('alert-triangle')} Add your account details so customers can pay straight away.</p>` : ''}
            ${toggle('p.payOnDelivery', 'Pay on delivery', 'Customers pay cash or transfer when the order arrives.', p.payOnDelivery)}
            ${toggle('p.payOnDeliveryLagosOnly', 'Pay on delivery in Lagos only', 'Recommended. Other states must pay before dispatch.', p.payOnDeliveryLagosOnly)}
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Orders &amp; inventory</h3></div></div><div class="card-body stack">
            <div class="grid-3">${field('preorderLeadTime', 'Default pre-order delivery time', s.preorderLeadTime)}${field('returnsDays', 'Returns window (days)', s.returnsDays, { type: 'number' })}${field('inv.defaultLowStock', 'Default low-stock alert', s.inventory?.defaultLowStock, { type: 'number', hint: 'Used for new products.' })}</div>
          </div></div>

          <div class="card"><div class="card-head"><div><h3>Announcement bar</h3><p>Rotating messages at the very top of the store. One per line.</p></div></div><div class="card-body stack">
            <textarea class="textarea" name="announcements" rows="4">${esc((s.announcements || []).join('\n'))}</textarea>
            <p class="hint">Use <code>{freeThreshold}</code> and <code>{preorderLeadTime}</code> to insert your current settings automatically.</p>
          </div></div>
        </div>

        <div class="editor-side">
          <div class="card"><div class="card-head"><h3>Database</h3>${DB.isDemo ? '<span class="pill amber">Demo mode</span>' : '<span class="pill green">Live · Supabase</span>'}</div><div class="card-body stack">
            ${DB.isDemo ? `<p style="font-size:13.5px">Your store data is saved <strong>in this browser only</strong> (${storageKb.toFixed(0)} KB used). Customers on other devices won't see your changes until you connect a live database.</p>
              <p class="hint">To go live: create a free Supabase project, run <code>database/schema.sql</code> and <code>database/seed.sql</code>, then add your keys to <code>js/config.js</code>. Full steps are in <code>SETUP.md</code>.</p>`
              : `<p style="font-size:13.5px">Connected to your Supabase database. All devices see the same products, stock and orders in real time.</p>`}
            <button class="btn btn-outline btn-block" type="button" data-backup>${I('download')}Download full backup</button>
            ${DB.isDemo ? `<label class="btn btn-outline btn-block" style="position:relative;overflow:hidden">${I('upload')}Restore from backup<input type="file" accept="application/json,.json" data-restore style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
              <button class="btn btn-danger btn-block" type="button" data-reset>${I('refresh')}Reset demo data</button>` : ''}
          </div></div>
          ${DB.auth.usesPasscode ? `<div class="card"><div class="card-head"><h3>Admin passcode</h3></div><div class="card-body stack" data-pass>
            <div class="field" data-f="current"><label for="pw-cur">Current passcode</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>
            <div class="field" data-f="next"><label for="pw-new">New passcode</label><input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="6"></div>
            <button class="btn btn-outline" type="button" data-change-pass>${I('lock')}Change passcode</button>
            <p class="hint">Demo mode only. In live mode each staff member signs in with their own email and password.</p>
          </div></div>` : `<div class="card"><div class="card-head"><h3>Staff access</h3></div><div class="card-body"><p class="hint">Admins sign in with Supabase accounts. Add staff in Supabase (Authentication → Users), then add their user ID to the <code>admins</code> table. See SETUP.md.</p></div></div>`}
          <div class="card"><div class="card-head"><h3>Quick links</h3></div><div class="card-body stack" style="gap:8px">
            <a class="btn btn-ghost" style="justify-content:flex-start" href="index.html" target="_blank">${I('store')}Storefront</a>
            <a class="btn btn-ghost" style="justify-content:flex-start" href="help.html" target="_blank">${I('help')}Help &amp; policies page</a>
            <a class="btn btn-ghost" style="justify-content:flex-start" href="track.html" target="_blank">${I('truck')}Order tracking page</a>
          </div></div>
        </div>
      </form>
      <div class="savebar" data-savebar><span class="unsaved"><span class="dot"></span><span data-state>All changes saved</span></span><button class="btn btn-brand" type="button" data-save>${I('check')}Save settings</button></div>`;

    const form = $('[data-settings]', el);
    form.addEventListener('input', (e) => {
      if (e.target.closest('[data-pass]')) return;
      Admin.markDirty(true);
      $('[data-savebar]', el).classList.add('is-dirty');
      $('[data-state]', el).textContent = 'Unsaved changes';
    });
    form.addEventListener('change', (e) => { if (e.target.type === 'checkbox') form.dispatchEvent(new Event('input')); });

    const num = (v) => Math.max(0, Number(v) || 0);
    $('[data-save]', el).addEventListener('click', async (e) => {
      const f = Object.fromEntries(new FormData(form));
      const chk = (n) => !!form.querySelector(`[name="${n}"]`).checked;
      const wa = DB.util.normPhone(f.whatsapp);
      if (wa && wa.length < 12) { Admin.fieldErrors(form, { whatsapp: 'Use the full international number, e.g. 2348031234567.' }); return; }
      const patch = {
        storeName: f.storeName.trim() || 'Chi-Best', tagline: f.tagline.trim(), whatsapp: wa, phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(),
        instagram: f.instagram.trim(), facebook: f.facebook.trim(), tiktok: f.tiktok.trim(),
        delivery: { lagosFee: num(f['d.lagosFee']), lagosTime: f['d.lagosTime'].trim(), otherFee: num(f['d.otherFee']), otherTime: f['d.otherTime'].trim(), freeThreshold: num(f['d.freeThreshold']), pickupEnabled: chk('d.pickupEnabled'), pickupNote: f['d.pickupNote'].trim() },
        payments: { bankTransfer: chk('p.bankTransfer'), bankName: f['p.bankName'].trim(), accountName: f['p.accountName'].trim(), accountNumber: f['p.accountNumber'].replace(/\s/g, ''), payOnDelivery: chk('p.payOnDelivery'), payOnDeliveryLagosOnly: chk('p.payOnDeliveryLagosOnly') },
        preorderLeadTime: f.preorderLeadTime.trim(), returnsDays: num(f.returnsDays), inventory: { defaultLowStock: num(f['inv.defaultLowStock']) },
        announcements: f.announcements.split('\n').map((x) => x.trim()).filter(Boolean)
      };
      if (!patch.payments.bankTransfer && !patch.payments.payOnDelivery) Admin.toast('Customers can still confirm orders on WhatsApp', { sub: 'Both bank transfer and pay on delivery are off.' });
      const btn = e.currentTarget;
      btn.classList.add('is-loading');
      try {
        await DB.settings.save(patch);
        Admin.invalidate('settings');
        Admin.markDirty(false);
        Admin.toast('Settings saved', { sub: 'The storefront is already using them.' });
        Admin.render();
      } catch (err) { btn.classList.remove('is-loading'); Admin.toast(err.message, { type: 'error' }); }
    });

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-backup]')) {
        const data = await DB.data.export();
        Admin.download(`chibest-backup-${Admin.today()}.json`, JSON.stringify(data, null, 1), 'application/json');
        Admin.toast('Backup downloaded', { sub: `${data.products.length} products · ${data.orders.length} orders · ${data.movements.length} stock movements` });
      }
      if (e.target.closest('[data-reset]')) {
        const ok = await Admin.confirm({ title: 'Reset all demo data?', text: 'This deletes every order, stock movement, request and product change in this browser and restores the original catalogue. Download a backup first if you want to keep anything.', confirm: 'Reset everything', danger: true });
        if (!ok) return;
        await DB.data.reset();
        Admin.invalidate();
        Admin.state.lastOrderCount = undefined;
        Admin.toast('Demo data reset');
        Admin.go('#/dashboard');
      }
      if (e.target.closest('[data-change-pass]')) {
        const cur = $('#pw-cur', el).value, next = $('#pw-new', el).value;
        try { await DB.auth.changePasscode(cur, next); Admin.toast('Passcode changed'); $('#pw-cur', el).value = ''; $('#pw-new', el).value = ''; Admin.fieldErrors($('[data-pass]', el), {}); }
        catch (err) { Admin.fieldErrors($('[data-pass]', el), err.code === 'AUTH' ? { current: 'Current passcode is incorrect.' } : { next: err.message }); }
      }
    });
    $('[data-restore]', el)?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const json = JSON.parse(await file.text());
        const ok = await Admin.confirm({ title: 'Restore this backup?', text: `This replaces all data in this browser with the backup from ${esc(json.exportedAt ? new Date(json.exportedAt).toLocaleString('en-NG') : 'the file')}.`, confirm: 'Restore backup', danger: true });
        if (!ok) return;
        await DB.data.import(json);
        Admin.invalidate();
        Admin.toast('Backup restored');
        Admin.go('#/dashboard');
      } catch (err) { Admin.toast(err.message || 'Could not read that file', { type: 'error' }); }
      e.target.value = '';
    });
  }
});
