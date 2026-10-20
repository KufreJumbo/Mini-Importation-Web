// Product detail page
UI.boot({ page: 'product' }).then(async (ctx) => {
  const { $, $$, esc, money, I, thumb, productCard } = UI;
  const s = ctx.settings;
  const params = new URLSearchParams(location.search);
  const key = params.get('p') || params.get('id') || '';
  let p = ctx.bySlug.get(key) || ctx.byId.get(key);
  if (!p && key) { const found = await DB.products.get(key); if (found && found.status === 'active') p = found; }

  const root = $('[data-product]');
  if (!p) {
    $('[data-crumbs]').innerHTML = `<a href="index.html">Home</a>${I('chevron-right')}<a href="shop.html">Shop</a>`;
    root.innerHTML = `<div class="empty" style="min-height:50vh;justify-content:center"><div class="empty-art">${I('package')}</div><h3>This product isn't available</h3>
      <p>It may have sold out or been removed. Browse similar items, or ask us to source it for you.</p>
      <a class="btn btn-dark" href="shop.html">Browse the shop</a><a class="btn btn-ghost" href="request.html">${I('sparkles')}Request a product</a></div>`;
    document.title = 'Product not found · Chi-Best';
    return;
  }

  const cat = ctx.catById.get(p.categoryId);
  const images = p.images?.length ? p.images : [UI.PLACEHOLDER];
  let qty = 1;
  let a = DB.util.availability(p, s);

  UI.Recent.push(p.id);
  document.title = `${p.name} · Chi-Best`;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.content = `${p.name} for ${money(p.price)}. ${p.description}`.slice(0, 300);
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.description,
    image: images.map((src) => new URL(src, location.href).href), brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    offers: { '@type': 'Offer', priceCurrency: 'NGN', price: p.price, url: location.href,
      availability: a.state === 'out' ? 'https://schema.org/OutOfStock' : a.state === 'pre' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock' }
  });
  document.head.appendChild(ld);

  $('[data-crumbs]').innerHTML = `<a href="index.html">Home</a>${I('chevron-right')}<a href="shop.html">Shop</a>${cat ? `${I('chevron-right')}<a href="shop.html?c=${esc(cat.id)}">${esc(cat.name)}</a>` : ''}${I('chevron-right')}<span aria-current="page">${esc(p.name)}</span>`;

  const sale = p.compareAtPrice > p.price;
  const save = sale ? p.compareAtPrice - p.price : 0;
  const d = s.delivery || {};
  const lead = p.leadTime || s.preorderLeadTime;
  const wished = UI.Wish.has(p.id);
  const waText = `Hello Chi-Best! I'm interested in ${p.name} (${p.sku}) - ${location.href}`;

  const availHtml = () => {
    a = DB.util.availability(p, s);
    const icon = a.state === 'pre' ? 'plane' : a.state === 'out' ? 'x-circle' : a.state === 'low' ? 'clock' : 'check-circle';
    return `<div class="avail ${a.state}"><span class="avail-icon">${I(icon)}</span><div><strong>${esc(a.label)}</strong><span>${esc(a.detail)}</span></div></div>`;
  };

  root.innerHTML = `
    <div class="pdp">
      <div class="gallery">
        <div class="gallery-main" data-zoom>
          <div class="gallery-badges">${a.state === 'pre' ? '<span class="badge badge-light">Pre-order</span>' : ''}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}${sale ? `<span class="badge badge-brand">-${Math.round((save / p.compareAtPrice) * 100)}%</span>` : ''}</div>
          <div class="gallery-track" data-track>${images.map((src, i) => `<img src="${esc(src)}" alt="${esc(p.name)}${images.length > 1 ? ` - image ${i + 1}` : ''}" ${i === 0 ? 'class="is-current" fetchpriority="high"' : 'loading="lazy"'} width="1000" height="1000">`).join('')}</div>
          ${images.length > 1 ? `<div class="gallery-dots">${images.map((_, i) => `<span class="${i === 0 ? 'is-on' : ''}"></span>`).join('')}</div>` : ''}
          <span class="gallery-zoom-hint">${I('zoom-in')}Hover to zoom · click to expand</span>
        </div>
        ${images.length > 1 ? `<div class="gallery-thumbs" role="tablist" aria-label="Product images">${images.map((src, i) => `<button type="button" class="${i === 0 ? 'is-on' : ''}" data-thumb="${i}" aria-label="Show image ${i + 1}"><img src="${esc(thumb(src))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>

      <div class="pinfo">
        <div class="pinfo-top">
          ${cat ? `<a class="eyebrow" href="shop.html?c=${esc(cat.id)}">${esc(cat.name)}</a>` : ''}
          <h1>${esc(p.name)}</h1>
          <div class="pinfo-meta">${p.brand ? `<span>by <strong style="color:var(--ink)">${esc(p.brand)}</strong></span><span class="sep"></span>` : ''}<span>SKU ${esc(p.sku)}</span><span class="sep"></span><button type="button" class="link-arrow" data-share style="font-size:13px">${I('share')}Share</button></div>
        </div>
        <div class="pprice"><span class="price${sale ? ' sale' : ''}">${money(p.price)}</span>${sale ? `<span class="price-was">${money(p.compareAtPrice)}</span><span class="save-pill">You save ${money(save)}</span>` : ''}</div>
        <div data-avail>${availHtml()}</div>
        ${p.description ? `<p style="color:var(--ink-3);font-size:15.5px;line-height:1.65">${esc(p.description.split('\n')[0])}</p>` : ''}
        <div data-options>${UI.optionsHtml(p)}</div>
        <div class="buy-stack" data-buy>
          <div class="buy-row">
            <div class="stepper lg"><button type="button" data-q="-1" aria-label="Decrease quantity">${I('minus')}</button><input type="number" min="1" value="1" aria-label="Quantity" data-qty><button type="button" data-q="1" aria-label="Increase quantity">${I('plus')}</button></div>
            <button class="btn btn-primary btn-lg" type="button" data-add ${a.canBuy ? '' : 'disabled'}>${I('bag')}${a.state === 'pre' ? 'Pre-order now' : a.canBuy ? 'Add to cart' : 'Sold out'}</button>
            <button class="icon-btn${wished ? ' is-on' : ''}" type="button" data-wish="${esc(p.id)}" aria-pressed="${wished}" aria-label="Save to wishlist">${I('heart')}</button>
          </div>
          ${a.canBuy ? `<button class="btn btn-dark btn-lg btn-block" type="button" data-buy-now>Buy it now</button>` : ''}
          <a class="btn btn-outline btn-block" href="${UI.waLink(a.canBuy ? waText : `Hello Chi-Best! Please let me know when ${p.name} (${p.sku}) is back in stock.`)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" style="color:#1faa53;font-size:18px"></i>${a.canBuy ? 'Ask about this item on WhatsApp' : 'Notify me on WhatsApp'}</a>
        </div>
        <div class="perks">
          ${a.state === 'pre' ? `<div class="perk">${I('plane')}<div><strong>Pre-order from China</strong><br><span>Arrives in about ${esc(lead)}. We'll update you at every step.</span></div></div>` : ''}
          <div class="perk">${I('truck')}<div><strong>Lagos delivery</strong><br><span>${esc(d.lagosTime || '')}</span></div><span class="perk-r">${money(d.lagosFee)}</span></div>
          <div class="perk">${I('map-pin')}<div><strong>Other states</strong><br><span>${esc(d.otherTime || '')}</span></div><span class="perk-r">${money(d.otherFee)}</span></div>
          ${Number(d.freeThreshold) > 0 ? `<div class="perk">${I('gift')}<div><strong>Free delivery</strong><br><span>On orders over ${money(d.freeThreshold)}</span></div></div>` : ''}
          <div class="perk">${I('rotate-ccw')}<div><strong>${esc(s.returnsDays)}-day returns</strong><br><span>On faulty or wrong items</span></div></div>
        </div>
        <div class="accordion">
          <details class="acc" open><summary>Description${I('plus')}</summary><div class="acc-body">${(p.description || 'No description yet.').split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join('')}</div></details>
          <details class="acc"><summary>Product details${I('plus')}</summary><div class="acc-body"><dl class="spec">
            <dt>SKU</dt><dd>${esc(p.sku)}</dd>
            ${cat ? `<dt>Category</dt><dd><a class="link" href="shop.html?c=${esc(cat.id)}">${esc(cat.name)}</a></dd>` : ''}
            ${p.brand ? `<dt>Brand</dt><dd>${esc(p.brand)}</dd>` : ''}
            ${(p.options || []).map((g) => `<dt>${esc(g.name)}</dt><dd>${g.values.map(esc).join(', ')}</dd>`).join('')}
            <dt>Ships from</dt><dd>${a.state === 'pre' ? 'China (pre-order)' : 'Lagos, Nigeria'}</dd>
          </dl></div></details>
          <details class="acc"><summary>Delivery &amp; returns${I('plus')}</summary><div class="acc-body">
            <p>Lagos orders arrive in ${esc(d.lagosTime)} (${money(d.lagosFee)}). Other states arrive in ${esc(d.otherTime)} (${money(d.otherFee)}).${Number(d.freeThreshold) > 0 ? ` Delivery is free on orders over ${money(d.freeThreshold)}.` : ''}</p>
            <p>Pre-order items ship from China and arrive in about ${esc(s.preorderLeadTime)}. You can track every order on our <a class="link" href="track.html">order tracking page</a>.</p>
            <p>If an item arrives faulty or isn't what you ordered, message us within ${esc(s.returnsDays)} days for a replacement or refund. <a class="link" href="help.html#returns">Read the returns policy</a>.</p>
          </div></details>
        </div>
      </div>
    </div>`;

  // ---------- Gallery ----------
  const track = $('[data-track]');
  const imgs = $$('img', track);
  let current = 0;
  const go = (i, smooth = true) => { track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' }); };
  const setCurrent = (i) => {
    current = i;
    imgs.forEach((im, k) => { im.classList.toggle('is-current', k === i); im.style.transformOrigin = ''; });
    $$('[data-thumb]').forEach((b, k) => b.classList.toggle('is-on', k === i));
    $$('.gallery-dots span').forEach((b, k) => b.classList.toggle('is-on', k === i));
  };
  track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== current) setCurrent(i); }, { passive: true });
  $$('[data-thumb]').forEach((b) => b.addEventListener('click', () => { setCurrent(+b.dataset.thumb); go(+b.dataset.thumb); }));
  const zoom = $('[data-zoom]');
  zoom.addEventListener('mousemove', (e) => {
    const r = zoom.getBoundingClientRect();
    imgs[current].style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });
  zoom.addEventListener('click', (e) => { if (!e.target.closest('.badge')) UI.lightbox(images, current); });

  // ---------- Options & quantity ----------
  const optsRoot = $('[data-options]');
  UI.bindOptions(optsRoot);
  const qtyInput = $('[data-qty]');
  const maxQty = () => (a.state === 'pre' ? 99 : Math.max(1, a.max - UI.Cart.qtyOf(p.id)));
  const setQty = (n) => { qty = Math.max(1, Math.min(maxQty(), n || 1)); qtyInput.value = qty; };
  root.addEventListener('click', (e) => {
    const qb = e.target.closest('[data-q]');
    if (qb) setQty(qty + Number(qb.dataset.q));
  });
  qtyInput.addEventListener('change', () => setQty(parseInt(qtyInput.value, 10)));

  const add = (then) => {
    if (!UI.validateOptions(optsRoot)) { UI.toast({ type: 'error', title: 'Please choose your options', sub: 'Select a value for each option above.' }); return; }
    if (UI.addToCart(p, qty, UI.readOptions(optsRoot), { openDrawer: !then, silent: !!then })) { setQty(1); then && then(); }
  };
  $('[data-add]')?.addEventListener('click', () => add());
  $('[data-buy-now]')?.addEventListener('click', () => add(() => { location.href = 'checkout.html'; }));
  $('[data-share]').addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ title: p.name, text: `${p.name} - ${money(p.price)}`, url: location.href }); } catch (e) { /* dismissed */ } }
    else UI.copy(location.href, 'Link copied');
  });

  // ---------- Sticky mobile buy bar ----------
  const bar = $('[data-sticky-buy]');
  if (a.canBuy) {
    bar.innerHTML = `<div class="sb-info"><strong>${esc(p.name)}</strong><span>${money(p.price)}</span></div><button class="btn btn-primary" type="button">${I('bag')}${a.state === 'pre' ? 'Pre-order' : 'Add to cart'}</button>`;
    $('button', bar).addEventListener('click', () => {
      const hasChoices = (p.options || []).some((g) => g.values?.length > 1);
      if (hasChoices && !UI.validateOptions(optsRoot)) return;
      add();
    });
    document.body.classList.add('has-sticky-buy');
    new IntersectionObserver(([en]) => bar.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0)).observe($('[data-buy]'));
  }

  // ---------- Related & recent ----------
  const related = ctx.products.filter((x) => x.id !== p.id && x.categoryId === p.categoryId)
    .sort((x, y) => (DB.util.availability(y, s).canBuy - DB.util.availability(x, s).canBuy) || (y.featured - x.featured))
    .concat(ctx.products.filter((x) => x.id !== p.id && x.categoryId !== p.categoryId && x.featured))
    .slice(0, 10);
  if (related.length) {
    $('[data-related]').innerHTML = related.map((x) => productCard(x)).join('');
    $('[data-related-section]').hidden = false;
    UI.bindRail($('[data-related-section]'));
  }
  const recent = UI.Recent.ids().filter((id) => id !== p.id).map((id) => ctx.byId.get(id)).filter(Boolean).slice(0, 10);
  if (recent.length) {
    $('[data-recent]').innerHTML = recent.map((x) => productCard(x)).join('');
    $('[data-recent-section]').hidden = false;
  }

  // Keep stock info fresh if inventory changes in another tab (e.g. admin).
  DB.on((topic) => {
    if (!['products', 'inventory', 'all', 'orders'].includes(topic)) return;
    setTimeout(() => { const fresh = UI.ctx.byId.get(p.id); if (fresh) { p = fresh; $('[data-avail]').innerHTML = availHtml(); } }, 60);
  });
});
