// Categories: the storefront's departments.
Admin.view('categories', {
  live: true,
  async render(el, route, isCurrent) {
    const { I, esc, money, thumb } = Admin;
    Admin.setTitle('Categories');
    const { categories, products } = await Admin.load('categories', 'products');
    if (!isCurrent()) return;
    const stats = new Map();
    products.forEach((p) => {
      const s = stats.get(p.categoryId) || { total: 0, active: 0, units: 0, value: 0 };
      s.total++; if (p.status === 'active') s.active++;
      s.units += Math.max(0, p.stock); s.value += Math.max(0, p.stock) * (p.costPrice || 0);
      stats.set(p.categoryId, s);
    });

    el.innerHTML = `
      <div class="page-head"><div><h2>Categories</h2><p>Organise products into departments. The order here is the order in the store menu.</p></div>
        <div class="page-actions"><button class="btn btn-primary" type="button" data-new>${I('plus')}New category</button></div></div>
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th>Code</th><th class="r">Products</th><th class="r">Units</th><th class="r">Stock value</th><th>Visible</th><th class="r">Order</th><th class="r">Actions</th></tr></thead><tbody>
        ${categories.map((c, i) => { const s = stats.get(c.id) || { total: 0, active: 0, units: 0, value: 0 }; return `<tr>
          <td><div class="cell-product"><img src="${esc(thumb(c.image))}" alt=""><div><strong>${esc(c.name)}</strong><span>${esc(c.description || '')}</span></div></div></td>
          <td class="num muted">${esc(c.code)}</td>
          <td class="r num"><a class="card-link" href="#/products?status=all&cat=${esc(c.id)}">${s.active} active</a><span class="cell-sub">${s.total} total</span></td>
          <td class="r num">${s.units}</td><td class="r num">${money(s.value)}</td>
          <td>${c.active !== false ? '<span class="pill green">Visible</span>' : '<span class="pill gray">Hidden</span>'}</td>
          <td class="r"><div class="row-actions"><button class="icon-btn" type="button" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${I('arrow-up')}</button><button class="icon-btn" type="button" data-move="1" data-i="${i}" ${i === categories.length - 1 ? 'disabled' : ''} aria-label="Move down">${I('arrow-down')}</button></div></td>
          <td><div class="row-actions"><a class="icon-btn" href="#/products/new?cat=${esc(c.id)}" title="Add product here" aria-label="Add product">${I('plus')}</a><button class="icon-btn" type="button" data-edit="${esc(c.id)}" aria-label="Edit">${I('edit')}</button><button class="icon-btn danger" type="button" data-del="${esc(c.id)}" aria-label="Delete">${I('trash')}</button></div></td></tr>`; }).join('')}
      </tbody></table></div></div>`;

    const editor = (c) => {
      let image = c?.image || '';
      Admin.modal({
        title: c ? 'Edit category' : 'New category',
        body: `<form class="stack" data-cat-form novalidate>
          <div class="grid-2"><div class="field" data-f="name"><label for="c-name">Name</label><input class="input" id="c-name" name="name" value="${esc(c?.name || '')}" autofocus></div>
            <div class="field"><label for="c-code">SKU code <span class="opt">2–4 letters</span></label><input class="input" id="c-code" name="code" maxlength="4" value="${esc(c?.code || '')}" style="text-transform:uppercase" placeholder="Auto"></div></div>
          <div class="field"><label for="c-desc">Description <span class="opt">shown on the category page</span></label><input class="input" id="c-desc" name="description" value="${esc(c?.description || '')}"></div>
          <div class="field"><span class="label">Image</span><div style="display:flex;gap:12px;align-items:center"><img data-img src="${esc(thumb(image))}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:var(--surface-2)">
            <select class="select" data-pick><option value="">Use a product photo…</option>${products.filter((p) => p.images?.[0] && (!c || p.categoryId === c.id)).slice(0, 80).map((p) => `<option value="${esc(p.images[0])}">${esc(p.name)}</option>`).join('')}</select>
            <label class="btn btn-outline btn-sm" style="position:relative;overflow:hidden">${I('upload')}Upload<input type="file" accept="image/*" data-upload style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div></div>
          <label class="switch"><div><strong>Visible in store</strong><small>Hidden categories don't appear in menus.</small></div><input type="checkbox" name="active" ${c?.active === false ? '' : 'checked'}><span class="track"></span></label>
        </form>`,
        foot: `<button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="button" data-save>${c ? 'Save' : 'Create category'}</button>`,
        onMount(m) {
          const form = m.$('[data-cat-form]');
          m.$('[data-pick]').addEventListener('change', (e) => { if (e.target.value) { image = e.target.value; m.$('[data-img]').src = thumb(image); } });
          m.$('[data-upload]').addEventListener('change', async (e) => { try { image = await DB.media.upload(e.target.files[0]); m.$('[data-img]').src = image; } catch (err) { Admin.toast(err.message, { type: 'error' }); } });
          const save = async () => {
            try {
              await DB.categories.save({ id: c?.id, name: form.name.value, code: form.code.value, description: form.description.value, image, active: form.active.checked });
              Admin.invalidate('categories');
              m.close();
              Admin.toast(c ? 'Category saved' : 'Category created');
              Admin.render();
            } catch (err) { Admin.fieldErrors(form, err.details || {}); Admin.toast(err.message, { type: 'error' }); }
          };
          m.$('[data-save]').addEventListener('click', save);
          form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
        }
      });
    };

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-new]')) { editor(null); return; }
      const ed = e.target.closest('[data-edit]');
      if (ed) { editor(categories.find((c) => c.id === ed.dataset.edit)); return; }
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const i = +mv.dataset.i, j = i + +mv.dataset.move;
        const order = categories.slice();
        [order[i], order[j]] = [order[j], order[i]];
        for (let k = 0; k < order.length; k++) if (order[k].sortOrder !== k + 1) await DB.categories.save({ ...order[k], sortOrder: k + 1 });
        Admin.invalidate('categories');
        Admin.render();
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const c = categories.find((x) => x.id === del.dataset.del);
        if (!(await Admin.confirm({ title: `Delete "${c.name}"?`, text: 'Only empty categories can be deleted.', confirm: 'Delete', danger: true }))) return;
        try { await DB.categories.remove(c.id); Admin.invalidate('categories'); Admin.toast('Category deleted'); Admin.render(); }
        catch (err) { Admin.toast(err.message, { type: 'error' }); }
      }
    });
  }
});
