// Lightweight SVG charts for the admin dashboard.
// Single-series columns (rounded data-end, ≤24px), sparklines and horizontal bars.
(function () {
  const { esc, fmt } = Admin;
  const NS = 'http://www.w3.org/2000/svg';

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /**
   * Column chart. points: [{ label, value, title }]
   */
  function columns(el, { points, format = fmt.compact, valueLabel = 'Sales', height = 260 }) {
    el.classList.add('chart');
    el.innerHTML = '';
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    el.appendChild(tip);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${valueLabel} by day`);
    el.appendChild(svg);

    function draw() {
      const W = Math.max(280, el.clientWidth);
      const H = height;
      const m = { t: 14, r: 6, b: 26, l: 46 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const max = Math.max(...points.map((p) => p.value), 0);
      const step = niceStep((max || 1) / 4);
      const top = step * 4;
      const n = points.length;
      const band = iw / n;
      const bw = Math.max(2, Math.min(24, band * 0.64));
      const every = Math.max(1, Math.ceil(n / Math.floor(iw / 62)));
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('height', H);
      let html = '<g class="grid">';
      for (let i = 0; i <= 4; i++) {
        const y = Math.round(m.t + ih - (i / 4) * ih) + 0.5;
        if (i > 0) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`;
      }
      html += '</g><g class="axis">';
      for (let i = 0; i <= 4; i++) {
        const y = m.t + ih - (i / 4) * ih;
        html += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end">${esc(format(step * i))}</text>`;
      }
      points.forEach((p, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        if (i !== n - 1 && n - 1 - i < every * 0.6) return; // avoid colliding with the last label
        html += `<text x="${m.l + i * band + band / 2}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`;
      });
      html += `</g><line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih + 0.5}" y2="${m.t + ih + 0.5}"/>`;
      points.forEach((p, i) => {
        const h = top ? (p.value / top) * ih : 0;
        const x = m.l + i * band + (band - bw) / 2;
        const y = m.t + ih - h;
        html += `<rect class="bar-hit" data-i="${i}" x="${m.l + i * band}" y="${m.t}" width="${band}" height="${ih}" tabindex="0" aria-label="${esc(p.title)}: ${esc(fmt.int(p.value))}"/>`;
        html += `<path class="bar" data-bar="${i}" d="${h > 0 ? roundedTop(x, y, bw, h, 4) : ''}"/>`;
      });
      svg.innerHTML = html;
      svg.dataset.band = band;
      svg.dataset.m = JSON.stringify(m);
      svg.dataset.ih = ih;
      svg.dataset.top = top;
    }

    function show(i) {
      const p = points[i];
      const band = +svg.dataset.band, m = JSON.parse(svg.dataset.m), ih = +svg.dataset.ih, top = +svg.dataset.top;
      const h = top ? (p.value / top) * ih : 0;
      const scale = el.clientWidth / svg.viewBox.baseVal.width;
      tip.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = DB.util.money(p.value);
      const row = document.createElement('div');
      row.className = 't-row';
      const key = document.createElement('span');
      key.className = 't-key';
      const label = document.createElement('span');
      label.textContent = `${p.title}${p.sub ? ` · ${p.sub}` : ''}`;
      row.append(key, label);
      tip.append(strong, row);
      tip.style.left = `${(m.l + i * band + band / 2) * scale}px`;
      tip.style.top = `${(m.t + ih - h) * scale}px`;
      tip.classList.add('show');
      el.classList.add('has-hover');
      svg.querySelectorAll('.bar').forEach((b) => b.classList.toggle('is-hover', +b.dataset.bar === i));
    }
    function hide() { tip.classList.remove('show'); el.classList.remove('has-hover'); svg.querySelectorAll('.bar.is-hover').forEach((b) => b.classList.remove('is-hover')); }
    svg.addEventListener('pointerover', (e) => { const r = e.target.closest('.bar-hit'); if (r) show(+r.dataset.i); });
    svg.addEventListener('focusin', (e) => { const r = e.target.closest('.bar-hit'); if (r) show(+r.dataset.i); });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focusout', hide);
    draw();
    if ('ResizeObserver' in window) new ResizeObserver(() => draw()).observe(el);
  }

  /** Sparkline: muted line, current (last) point in the accent. */
  function spark(values) {
    if (!values.length) return '';
    const W = 96, H = 28, pad = 3;
    const max = Math.max(...values), min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2), H - pad - ((v - min) / span) * (H - pad * 2)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="#c4c7cd" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#2a78d6" stroke="#fff" stroke-width="2"/></svg>`;
  }

  /** Horizontal bars as HTML. items: [{ label, value, sub, image }] */
  function hbars(items, { format = (v) => DB.util.money(v) } = {}) {
    if (!items.length) return '<div class="empty-chart">No sales in this period yet.</div>';
    const max = Math.max(...items.map((i) => i.value)) || 1;
    return `<div class="hbars">${items.map((it) => `<div class="hbar" title="${esc(it.label)}: ${esc(format(it.value))}">
      <div class="hbar-label">${it.image ? `<img src="${esc(it.image)}" alt="">` : ''}<span class="ellipsis">${esc(it.label)}</span></div>
      <div class="hbar-value">${esc(format(it.value))}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(1, (it.value / max) * 100)}%"></div></div>
    </div>`).join('')}</div>`;
  }

  window.Charts = { columns, spark, hbars };
})();
