// Home page
UI.boot({ page: 'home' }).then((ctx) => {
  const { $, esc, money, thumb, productCard, productUrl, I } = UI;
  const { products, categories, settings } = ctx;
  const s = settings;

  // Hero proof points & figures driven by settings
  const proof = [
    s.payments?.payOnDelivery ? 'Pay on delivery in Lagos' : 'Secure bank transfer',
    `${s.returnsDays || 7}-day returns`,
    'WhatsApp support'
  ];
  $('[data-proof]').innerHTML = proof.map((t) => `<li>${I('check')}${esc(t)}</li>`).join('');
  $('[data-lead]').textContent = s.preorderLeadTime || '14-21 days';
  const inStock = products.filter((p) => p.stock > 0).length;
  $('[data-count]').textContent = inStock >= 10 ? `${Math.floor(inStock / 10) * 10}+` : String(inStock);

  // Hero mosaic: preferred hero products, falling back to featured items
  const preferred = ['kids-heart-zip-boots', 'wave-shoulder-bag', 'oud-perfume-gift-box'].map((sl) => ctx.bySlug.get(sl)).filter(Boolean);
  const hero = [...preferred, ...products.filter((p) => p.featured && p.images?.length && !preferred.includes(p))].slice(0, 3);
  $('[data-mosaic]').innerHTML = hero.map((p, i) => `
    <a href="${productUrl(p)}" aria-label="${esc(p.name)}">
      <img src="${esc(i === 0 ? p.images[0] : thumb(p.images[0]))}" alt="${esc(p.name)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
      <span class="tag-chip"><span style="min-width:0"><strong>${esc(p.name)}</strong><span>${money(p.price)}</span></span><span class="go">${I('arrow-up-right')}</span></span>
    </a>`).join('');

  // Value strip
  const freeT = Number(s.delivery?.freeThreshold || 0);
  const values = [
    ['truck', 'Nationwide delivery', freeT ? `Free on orders over ${money(freeT)}` : `Lagos ${s.delivery?.lagosTime || ''}`],
    ['plane', 'Pre-order from China', `Delivered in ${s.preorderLeadTime}`],
    ['shield', 'Checked before dispatch', `${s.returnsDays || 7}-day returns on faulty items`],
    ['message', 'Real people on WhatsApp', 'Order help, sizing and tracking']
  ];
  $('[data-values]').innerHTML = values.map(([ic, t, d]) => `<div class="value"><span class="value-icon">${I(ic)}</span><div><strong>${esc(t)}</strong><span>${esc(d)}</span></div></div>`).join('');

  // Categories
  const counts = new Map();
  products.forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1));
  $('[data-categories]').innerHTML = categories.map((c) => `
    <a class="cat-tile" href="shop.html?c=${esc(c.id)}">
      <span class="ct-img"><img src="${esc(thumb(c.image) || UI.PLACEHOLDER)}" alt="" loading="lazy"></span>
      <span><strong>${esc(c.name)}</strong><small>${counts.get(c.id) || 0} items</small></span>
    </a>`).join('');

  // New in
  const newest = products.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
  $('[data-new]').innerHTML = newest.map((p) => productCard(p)).join('');

  // Promos
  const promos = [
    { cat: 'kids-clothing', img: 'girls-ruffle-bow-dress', eyebrow: "The kids' edit", title: 'Party-ready <span class="serif">looks</span> for little ones', text: 'Dresses, sets and sparkly shoes for birthdays, weddings and every celebration.', cta: "Shop kids' fashion" },
    { cat: 'bags', img: 'teddy-charm-tote-bag', eyebrow: 'The bag edit', title: 'Statement bags, <span class="serif">everyday</span> prices', text: 'Totes, crossbodies, clutches and mini bags in every colour of the season.', cta: 'Shop bags & purses' }
  ].filter((p) => ctx.catById.has(p.cat));
  $('[data-promos]').innerHTML = promos.map((p) => {
    const prod = ctx.bySlug.get(p.img);
    const img = prod?.images?.[0] || ctx.catById.get(p.cat).image;
    return `<a class="promo reveal" href="shop.html?c=${esc(p.cat)}">
      <img src="${esc(img)}" alt="" loading="lazy">
      <div class="promo-body"><span class="eyebrow">${esc(p.eyebrow)}</span><h3>${p.title}</h3><p>${esc(p.text)}</p><span class="btn btn-light">${esc(p.cta)}${I('arrow-right')}</span></div>
    </a>`;
  }).join('');

  // Trending (featured)
  const featured = products.filter((p) => p.featured);
  const shown = new Set(newest.map((p) => p.id));
  const pool = (featured.length >= 8 ? featured : products).filter((p) => !shown.has(p.id));
  const trending = pool.slice().sort((a, b) => (b.stock > 0) - (a.stock > 0)).slice(0, 8);
  $('[data-featured]').innerHTML = trending.map((p) => productCard(p)).join('');

  // Deals
  const deals = products.filter((p) => p.compareAtPrice > p.price)
    .sort((a, b) => (1 - a.price / a.compareAtPrice) < (1 - b.price / b.compareAtPrice) ? 1 : -1).slice(0, 10);
  if (deals.length) $('[data-deals]').innerHTML = deals.map((p) => productCard(p)).join('');
  else $('[data-deals-section]').hidden = true;

  // Recently viewed
  const recent = UI.Recent.ids().map((id) => ctx.byId.get(id)).filter(Boolean).slice(0, 10);
  if (recent.length >= 2) {
    $('[data-recent]').innerHTML = recent.map((p) => productCard(p)).join('');
    $('[data-recent-section]').hidden = false;
  }

  $('[data-wa-request]').href = UI.waLink('Hello Chi-Best! I would like you to source a product for me.');
  $('[data-wa-request]').target = '_blank';

  document.querySelectorAll('[data-rail-section]').forEach(UI.bindRail);
  UI.reveal();
});
