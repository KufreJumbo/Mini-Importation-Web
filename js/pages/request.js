// Product sourcing request
UI.boot({ page: 'request' }).then((ctx) => {
  const { $, $$, esc, I } = UI;
  const root = $('[data-request]');
  const images = [];
  const q = new URLSearchParams(location.search).get('q') || '';
  const saved = (() => { try { return JSON.parse(localStorage.getItem('chibest.customer') || '{}'); } catch (e) { return {}; } })();

  const field = (id, label, input, hint = '') => `<div class="field" data-field="${id}"><label for="r-${id}">${label}</label>${input}${hint ? `<span class="field-hint">${hint}</span>` : ''}<span class="field-error"></span></div>`;

  root.innerHTML = `
    <form class="card card-pad" data-form novalidate>
      <div class="form-grid">
        ${field('description', 'What are you looking for?', `<textarea class="textarea" id="r-description" name="description" placeholder="Describe the product: type, colour, size, material, brand, anything that helps.">${esc(q)}</textarea>`)}
        ${field('link', 'Product link <span class="opt">(optional)</span>', `<div class="input-group">${I('link')}<input class="input" id="r-link" name="link" type="url" inputmode="url" placeholder="https://detail.1688.com/…"></div>`)}
        <div class="field"><span class="label">Photos <span class="opt">(optional, up to 4)</span></span>
          <label class="dropzone" data-drop>${I('upload')}<strong>Add photos or screenshots</strong><span>JPG or PNG. Tap to choose, or drag them here.</span><input type="file" accept="image/*" multiple data-files aria-label="Upload photos"></label>
          <div class="thumbs" data-thumbs></div>
        </div>
        <div class="form-grid cols-2">
          ${field('quantity', 'Quantity', `<input class="input" id="r-quantity" name="quantity" type="number" min="1" value="1" inputmode="numeric">`)}
          ${field('budget', 'Budget per item <span class="opt">(optional)</span>', `<input class="input" id="r-budget" name="budget" placeholder="e.g. ₦20,000">`)}
          ${field('category', 'Category', `<select class="select" id="r-category" name="category"><option value="">Choose one</option>${ctx.categories.map((c) => `<option>${esc(c.name)}</option>`).join('')}<option>Something else</option></select>`)}
          ${field('location', 'Delivery state', `<select class="select" id="r-location" name="location"><option value="">Choose state</option>${DB.const.NG_STATES.map((s) => `<option ${saved.state === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`)}
        </div>
        <div class="form-grid cols-2" style="padding-top:8px;border-top:1px solid var(--line)">
          ${field('customerName', 'Your name', `<input class="input" id="r-customerName" name="customerName" autocomplete="name" value="${esc(saved.name || '')}">`)}
          ${field('whatsapp', 'WhatsApp number', `<input class="input" id="r-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="${esc(saved.phone || '')}">`, "We'll send your quote here.")}
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${I('send')}Send request</button>
        <p class="legal-note" style="margin-top:0">No payment needed now. You only pay if you accept the quote.</p>
      </div>
    </form>
    <aside style="display:grid;gap:20px">
      <div class="card card-pad">
        <h2 class="card-title" style="margin-bottom:20px">How sourcing works</h2>
        <ol class="side-steps">
          <li><span class="ss-icon">${I('send')}</span><div><strong>Send your request</strong><span>A link, photo or description is all we need.</span></div></li>
          <li><span class="ss-icon">${I('search')}</span><div><strong>We find the best supplier</strong><span>We compare suppliers on price, quality and reliability.</span></div></li>
          <li><span class="ss-icon">${I('receipt')}</span><div><strong>You get a landed quote</strong><span>One price in Naira covering the item, shipping and clearing.</span></div></li>
          <li><span class="ss-icon">${I('plane')}</span><div><strong>We ship it to you</strong><span>Delivered in about ${esc(ctx.settings.preorderLeadTime)} after payment.</span></div></li>
        </ol>
      </div>
      <a class="card card-pad" style="display:flex;gap:14px;align-items:center" href="${UI.waLink('Hello Chi-Best! I want you to source a product for me.')}" target="_blank" rel="noopener">
        <span class="choice-icon" style="background:#e7f7ed"><i class="fa-brands fa-whatsapp" style="font-size:22px;color:#1faa53"></i></span>
        <span><strong style="display:block">Prefer WhatsApp?</strong><span class="muted" style="font-size:14px">Send your photos and links straight to our team.</span></span>
        ${I('chevron-right')}
      </a>
    </aside>`;

  const form = $('[data-form]');
  const thumbs = $('[data-thumbs]');
  const renderThumbs = () => {
    thumbs.innerHTML = images.map((src, i) => `<div class="thumb"><img src="${src}" alt="Uploaded photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo">${I('x')}</button></div>`).join('');
  };
  async function addFiles(files) {
    for (const f of [...files]) {
      if (images.length >= 4) { UI.toast({ type: 'info', title: 'Up to 4 photos', sub: 'Remove one to add another.' }); break; }
      try { images.push((await DB.util.compressImage(f, { max: 900, quality: 0.78 })).dataUrl); }
      catch (e) { UI.toast({ type: 'error', title: e.message }); }
    }
    renderThumbs();
  }
  $('[data-files]').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('[data-drop]');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  thumbs.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { images.splice(+b.dataset.rm, 1); renderThumbs(); } });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errs = {};
    if ((data.description || '').trim().length < 5) errs.description = 'Tell us a little about the product.';
    if ((data.customerName || '').trim().length < 2) errs.customerName = 'Enter your name.';
    if (DB.util.digits(data.whatsapp).length < 10) errs.whatsapp = 'Enter a valid WhatsApp number.';
    if (data.link && !/^https?:\/\//i.test(data.link)) errs.link = 'Links should start with http:// or https://';
    $$('[data-field]', form).forEach((f) => { f.classList.toggle('has-error', !!errs[f.dataset.field]); $('.field-error', f).textContent = errs[f.dataset.field] || ''; });
    if (Object.keys(errs).length) { $('.has-error', form).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const btn = $('button[type="submit"]', form);
    btn.classList.add('is-loading');
    try {
      const { reference } = await DB.requests.create({ ...data, images });
      root.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty" style="padding:64px 24px">
        <div class="confirm-check">${I('check')}</div>
        <h3 style="font-size:26px">Request received!</h3>
        <p>Thanks ${esc(data.customerName.split(' ')[0])}. Your reference is <strong style="color:var(--ink)">${esc(reference)}</strong>. We'll send your quote to ${esc(data.whatsapp)} on WhatsApp, usually within 24 hours.</p>
        <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${UI.waLink(`Hello Chi-Best! I just sent sourcing request ${reference}: ${data.description.slice(0, 200)}`)}"><i class="fa-brands fa-whatsapp"></i>Follow up on WhatsApp</a>
        <a class="btn btn-ghost" href="shop.html">Keep browsing</a></div></div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      btn.classList.remove('is-loading');
      UI.toast({ type: 'error', title: "We couldn't send your request", sub: err.message });
    }
  });
});
