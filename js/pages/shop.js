// Shop / catalogue page
UI.boot({ page: 'shop' }).then((ctx) => {
  const { $, $$, esc, money, I, productCard, thumb } = UI;
  const PAGE = 24;
  const PRESETS = [
    { label: 'Under ₦10k', min: 0, max: 10000 },
    { label: '₦10k – ₦25k', min: 10000, max: 25000 },
    { label: '₦25k – ₦50k', min: 25000, max: 50000 },
    { label: '₦50k +', min: 50000, max: null }
  ];
  const AVAIL = [
    { id: 'in', label: 'In stock in Lagos' },
    { id: 'pre', label: 'Available to pre-order' }
  ];

  const params = new URLSearchParams(location.search);
  const state = {
    c: params.get('c') || '',
    q: params.get('q') || '',
    sort: params.get('sort') || 'featured',
    min: params.get('min') ? Number(params.get('min')) : null,
    max: params.get('max') ? Number(params.get('max')) : null,
    avail: (params.get('avail') || '').split(',').filter(Boolean),
    sale: params.get('sale') === '1',
    shown: PAGE
  };

  $('[data-close]', $('#filter-drawer')).innerHTML = I('x');

  // ---------- filtering ----------
  const availOf = (p) => DB.util.availability(p, ctx.settings).state;
  function matches(p, skip) {
    if (skip !== 'c' && state.c && p.categoryId !== state.c) return false;
    if (state.min != null && p.price < state.min) return false;
    if (state.max != null && p.price > state.max) return false;
    if (state.sale && !(p.compareAtPrice > p.price)) return false;
    if (skip !== 'avail' && state.avail.length) {
      const a = availOf(p);
      const ok = (state.avail.includes('in') && (a === 'in' || a === 'low')) || (state.avail.includes('pre') && a === 'pre');
      if (!ok) return false;
    }
    return true;
  }
  function baseList() {
    return state.q ? UI.searchProducts(state.q, Infinity) : ctx.products.slice();
  }
  function sortList(list) {
    const disc = (p) => (p.compareAtPrice > p.price ? 1 - p.price / p.compareAtPrice : 0);
    const rank = { in: 0, low: 0, pre: 1, out: 2 };
    const sorters = {
      featured: (a, b) => rank[availOf(a)] - rank[availOf(b)] || (b.featured - a.featured) || String(b.createdAt).localeCompare(String(a.createdAt)),
      newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      discount: (a, b) => disc(b) - disc(a),
      name: (a, b) => a.name.localeCompare(b.name)
    };
    if (state.q && state.sort === 'featured') return list; // keep relevance order for searches
    return list.sort(sorters[state.sort] || sorters.featured);
  }

  // ---------- rendering ----------
  function filtersHtml(prefix) {
    const base = baseList();
    const catCounts = new Map();
    base.filter((p) => matches(p, 'c')).forEach((p) => catCounts.set(p.categoryId, (catCounts.get(p.categoryId) || 0) + 1));
    const forAvail = base.filter((p) => matches(p, 'avail'));
    const availCount = { in: forAvail.filter((p) => ['in', 'low'].includes(availOf(p))).length, pre: forAvail.filter((p) => availOf(p) === 'pre').length };
    const totalCat = [...catCounts.values()].reduce((s, n) => s + n, 0);
    return `
      <div class="fgroup">
        <h4>Category ${state.c ? `<button type="button" data-set-c="">Clear</button>` : ''}</h4>
        <div class="flist">
          <a href="#" class="fcat ${!state.c ? 'is-active' : ''}" data-set-c=""><span>All products</span><span class="count">${totalCat}</span></a>
          ${ctx.categories.map((c) => `<a href="#" class="fcat ${state.c === c.id ? 'is-active' : ''}${catCounts.get(c.id) ? '' : ' is-empty'}" data-set-c="${esc(c.id)}"><span>${esc(c.name)}</span><span class="count">${catCounts.get(c.id) || 0}</span></a>`).join('')}
        </div>
      </div>
      <div class="fgroup">
        <h4>Price ${state.min != null || state.max != null ? `<button type="button" data-clear-price>Clear</button>` : ''}</h4>
        <form class="price-inputs" data-price-form>
          <input class="input" type="number" inputmode="numeric" min="0" step="500" placeholder="Min ₦" aria-label="Minimum price" name="min" value="${state.min ?? ''}">
          <span class="muted">–</span>
          <input class="input" type="number" inputmode="numeric" min="0" step="500" placeholder="Max ₦" aria-label="Maximum price" name="max" value="${state.max ?? ''}">
          <button type="submit" hidden>Apply</button>
        </form>
        <div class="price-presets">${PRESETS.map((p, i) => `<button type="button" data-preset="${i}" class="${state.min === p.min && state.max === p.max ? 'is-active' : ''}">${p.label}</button>`).join('')}</div>
      </div>
      <div class="fgroup">
        <h4>Availability</h4>
        <div class="flist">${AVAIL.map((a) => `<label class="check"><input type="checkbox" data-avail="${a.id}" ${state.avail.includes(a.id) ? 'checked' : ''}><span>${a.label}</span><span class="count">${availCount[a.id]}</span></label>`).join('')}</div>
      </div>
      <div class="fgroup">
        <h4>Offers</h4>
        <div class="flist"><label class="check"><input type="checkbox" data-sale ${state.sale ? 'checked' : ''}><span>On sale</span><span class="count">${base.filter((p) => p.compareAtPrice > p.price).length}</span></label></div>
      </div>
      <div class="fgroup" style="border:0">
        <div class="card card-pad" style="padding:18px;background:var(--surface-2);border:0">
          <strong style="display:block;font-size:14.5px;margin-bottom:4px">Can't find it?</strong>
          <span class="muted" style="font-size:13.5px">Send us a photo or link and we'll source it from China.</span>
          <a class="btn btn-dark btn-sm btn-block" style="margin-top:12px" href="request.html${state.q ? `?q=${encodeURIComponent(state.q)}` : ''}">${I('sparkles')}Request a product</a>
        </div>
      </div>`;
  }

  function activeChips() {
    const chips = [];
    if (state.q) chips.push([`"${state.q}"`, 'q']);
    if (state.c) chips.push([ctx.catById.get(state.c)?.name || state.c, 'c']);
    if (state.min != null || state.max != null) chips.push([`${state.min != null ? money(state.min) : '₦0'} – ${state.max != null ? money(state.max) : 'any'}`, 'price']);
    state.avail.forEach((a) => chips.push([AVAIL.find((x) => x.id === a)?.label, 'avail:' + a]));
    if (state.sale) chips.push(['On sale', 'sale']);
    return chips;
  }

  function render() {
    const list = sortList(baseList().filter((p) => matches(p)));
    const cat = ctx.catById.get(state.c);
    // Heading
    const title = state.q ? `Results for <span class="serif">“${esc(state.q)}”</span>` : cat ? esc(cat.name) : state.sale ? 'Deals &amp; <span class="serif">price drops</span>' : state.sort === 'newest' ? 'New <span class="serif">in</span>' : 'Shop <span class="serif">all</span>';
    $('[data-title]').innerHTML = title;
    $('[data-sub]').textContent = cat ? cat.description || '' : state.q ? '' : state.sale ? 'Limited-time prices on selected items.' : 'Ready stock in Lagos, pre-orders from China, all in one place.';
    document.title = `${state.q ? `Search: ${state.q}` : cat ? cat.name : 'Shop'} · Chi-Best`;
    $('[data-crumbs]').innerHTML = `<a href="index.html">Home</a>${I('chevron-right')}${cat || state.q ? `<a href="shop.html">Shop</a>${I('chevron-right')}<span aria-current="page">${esc(cat ? cat.name : 'Search')}</span>` : '<span aria-current="page">Shop</span>'}`;

    // Category chips
    $('[data-chips]').innerHTML = `<a class="chip no-img ${!state.c ? 'is-active' : ''}" href="#" data-set-c="">All</a>` +
      ctx.categories.map((c) => `<a class="chip ${state.c === c.id ? 'is-active' : ''}" href="#" data-set-c="${esc(c.id)}"><img src="${esc(thumb(c.image))}" alt="" loading="lazy">${esc(c.name)}</a>`).join('');

    // Filters
    $('[data-filters]').innerHTML = filtersHtml('d');
    $('[data-filters-mobile]').innerHTML = filtersHtml('m');
    const n = activeChips().filter(([, k]) => k !== 'q').length;
    $('[data-open-filters]').innerHTML = `${I('sliders')}Filters${n ? `<span class="n">${n}</span>` : ''}`;
    $('[data-show-results]').textContent = `Show ${list.length} result${list.length === 1 ? '' : 's'}`;
    $('[data-sort]').value = state.sort;

    // Toolbar + active filters
    $('[data-count]').innerHTML = `<b>${list.length}</b> product${list.length === 1 ? '' : 's'}`;
    const chips = activeChips();
    $('[data-active]').innerHTML = chips.length ? chips.map(([label, key]) => `<button class="af-chip" type="button" data-remove="${esc(key)}">${esc(label)}${I('x')}</button>`).join('') + (chips.length > 1 ? `<button class="af-clear" type="button" data-clear-all>Clear all</button>` : '') : '';

    // Grid
    const grid = $('[data-grid]');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-art">${I('search')}</div><h3>No products found</h3>
        <p>${state.q ? `We couldn't find anything for “${esc(state.q)}”.` : 'No products match these filters.'} Try removing a filter, or ask us to source it for you.</p>
        <button class="btn btn-dark" type="button" data-clear-all>Clear filters</button>
        <a class="btn btn-ghost" href="request.html${state.q ? `?q=${encodeURIComponent(state.q)}` : ''}">${I('sparkles')}Request this product</a></div>`;
      $('[data-more]').innerHTML = '';
    } else {
      grid.innerHTML = list.slice(0, state.shown).map((p, i) => productCard(p, { eager: i < 6 })).join('');
      const shown = Math.min(state.shown, list.length);
      $('[data-more]').innerHTML = `<p>Showing ${shown} of ${list.length}</p><div class="load-meter"><span style="width:${(shown / list.length) * 100}%"></span></div>
        ${shown < list.length ? `<button class="btn btn-outline" type="button" data-load-more>Load more products</button>` : ''}`;
    }
    syncUrl();
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.c) p.set('c', state.c);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    if (state.min != null) p.set('min', state.min);
    if (state.max != null) p.set('max', state.max);
    if (state.avail.length) p.set('avail', state.avail.join(','));
    if (state.sale) p.set('sale', '1');
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    $$('.catnav-scroll a').forEach((a) => {
      const u = new URL(a.href, location.href);
      a.classList.toggle('is-active', u.pathname.endsWith('shop.html') && (u.searchParams.get('c') || '') === state.c && !state.q && !!state.c === !!u.searchParams.get('c') && !u.searchParams.get('sort') && !u.searchParams.get('sale'));
    });
  }

  function update(patch) {
    Object.assign(state, patch, { shown: PAGE });
    render();
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    const setC = t.closest('[data-set-c]');
    if (setC) { e.preventDefault(); update({ c: setC.dataset.setC }); if (!t.closest('#filter-drawer')) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const preset = t.closest('[data-preset]');
    if (preset) { const p = PRESETS[+preset.dataset.preset]; const same = state.min === p.min && state.max === p.max; update(same ? { min: null, max: null } : { min: p.min, max: p.max }); return; }
    if (t.closest('[data-clear-price]')) { update({ min: null, max: null }); return; }
    if (t.closest('[data-clear-all]')) { update({ c: '', q: '', min: null, max: null, avail: [], sale: false }); $$('.search-input').forEach((i) => (i.value = '')); return; }
    const rm = t.closest('[data-remove]');
    if (rm) {
      const k = rm.dataset.remove;
      if (k === 'q') { $$('.search-input').forEach((i) => (i.value = '')); update({ q: '' }); }
      else if (k === 'c') update({ c: '' });
      else if (k === 'price') update({ min: null, max: null });
      else if (k === 'sale') update({ sale: false });
      else if (k.startsWith('avail:')) update({ avail: state.avail.filter((a) => a !== k.slice(6)) });
      return;
    }
    if (t.closest('[data-load-more]')) { state.shown += PAGE; render(); return; }
    if (t.closest('[data-open-filters]')) UI.openDrawer('filter-drawer');
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-avail]')) update({ avail: t.checked ? [...new Set([...state.avail, t.dataset.avail])] : state.avail.filter((a) => a !== t.dataset.avail) });
    else if (t.matches('[data-sale]')) update({ sale: t.checked });
    else if (t.matches('[data-sort]')) update({ sort: t.value });
    else if (t.closest('[data-price-form]')) {
      const f = t.closest('[data-price-form]');
      const min = f.min.value === '' ? null : Math.max(0, Number(f.min.value));
      const max = f.max.value === '' ? null : Math.max(0, Number(f.max.value));
      update({ min, max: max != null && min != null && max < min ? min : max });
    }
  });
  document.addEventListener('submit', (e) => { if (e.target.closest('[data-price-form]')) { e.preventDefault(); e.target.querySelector('input').dispatchEvent(new Event('change', { bubbles: true })); } });

  // The header search submits to shop.html; on this page, filter in place instead of reloading.
  $$('.search-form').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault(); e.stopImmediatePropagation();
    const q = $('.search-input', f).value.trim();
    $$('.search-panel').forEach((p) => p.classList.remove('is-open'));
    $('.search-input', f).blur();
    update({ q, sort: q ? 'featured' : state.sort });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, true));

  DB.on((topic) => { if (['products', 'all', 'inventory', 'categories'].includes(topic)) setTimeout(render, 50); });
  render();
});
