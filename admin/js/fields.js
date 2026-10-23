/* Form controls used by every screen. */
(function () {
  'use strict';
  const A = window.ADM, h = A.h;

  A.imgUrl = (v) => (!v ? '' : /^(https?:|data:|\/\/)/.test(v) ? v : '../' + String(v).replace(/^(\.\.\/)+/, ''));
  A.rootRel = (v) => (/^(https?:|data:|\/\/)/.test(v) ? v : String(v).replace(/^(\.\.\/)+/, ''));

  /* wrapper: label, chip, help, control */
  A.frow = function (o) {
    return h('div', { class: 'field' + (o.hl ? ' hl' : ''), 'data-key': o.key || null },
      h('div', { class: 'flabel' }, o.label, o.chip ? h('span', { class: 'chip ' + (o.chipCls || '') }, o.chip) : null, o.extra || null),
      o.help ? h('div', { class: 'fhelp' }, o.help) : null,
      o.control, o.foot || null);
  };

  /* link target suggestions */
  A.ensureLinkList = function () {
    if (document.getElementById('pagelinks')) return;
    const dl = h('datalist', { id: 'pagelinks' });
    (A.defaults.pages || []).forEach((p) => dl.appendChild(h('option', { value: p.file }, A.pageName(p.file, p.title))));
    ['mailto:', 'tel:', 'https://'].forEach((v) => dl.appendChild(h('option', { value: v })));
    document.body.appendChild(dl);
  };

  /* image picker */
  A.pickImage = function (current) {
    return new Promise(async (resolve) => {
      let chosen = null, tab = 'site';
      const box = h('div');
      const grid = h('div', { class: 'mediagrid' });
      const tabs = h('div', { class: 'tabs' });
      let media = [];
      try { const r = await A.sb.from('cms_media').select('*').order('created_at', { ascending: false }).limit(200); media = r.data || []; } catch (e) { /* ignore */ }
      const siteImgs = Array.from(new Set(Object.values(A.defaults.fields).filter((f) => f.kind === 'src').map((f) => A.rootRel(f.value)).concat(A.products().map((p) => p.image).filter(Boolean)))).filter((v) => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(v));
      const draw = () => {
        grid.innerHTML = '';
        const list = tab === 'media' ? media.map((m) => ({ url: m.url, name: m.name })) : siteImgs.map((u) => ({ url: u, name: u.split('/').pop() }));
        if (!list.length) grid.appendChild(h('div', { class: 'empty' }, tab === 'media' ? 'No uploaded images yet. Use "Upload new".' : 'No images found.'));
        list.forEach((m) => grid.appendChild(h('div', { class: 'mitem' + (chosen === m.url ? ' sel' : ''), onclick: () => { chosen = m.url; draw(); } }, h('div', { class: 'im', style: 'background-image:url(' + JSON.stringify(A.imgUrl(m.url)) + ')' }), h('div', { class: 'n' }, m.name))));
        Array.from(tabs.children).forEach((a) => a.classList.toggle('active', a.dataset.t === tab));
      };
      [['site', 'Images already on the site'], ['media', 'Uploaded images']].forEach(([t, l]) => tabs.appendChild(h('a', { href: 'javascript:void 0', 'data-t': t, onclick: () => { tab = t; draw(); } }, l)));
      const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const m = await A.upload(f); media.unshift(m); chosen = m.url; tab = 'media'; draw(); A.toast('Uploaded.', 'ok'); } catch (err) { A.toast(A.dbErr(err), 'err'); }
      } });
      box.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => file.click() }, 'Upload new image'), file, h('span', { class: 'mini' }, 'JPG, PNG, WEBP or SVG, up to 8 MB.')), tabs, grid);
      draw();
      A.modal('Choose an image', box, [{ label: 'Cancel', onclick: () => resolve(null) }, { label: 'Use this image', cls: 'primary', onclick: () => { if (!chosen) { A.toast('Click an image first.', 'err'); return false; } resolve(chosen); } }], { width: '860px' });
    });
  };

  A.imageControl = function (value, onChange, opts) {
    opts = opts || {};
    const thumb = h('div', { class: 'thumb', style: value ? 'background-image:url(' + JSON.stringify(A.imgUrl(value)) + ')' : null });
    const inp = h('input', { type: 'text', value: value || '', placeholder: opts.placeholder || 'Image address or choose one', oninput: () => { set(inp.value, true); } });
    const set = (v, fromInput) => { if (!fromInput) inp.value = v; thumb.style.backgroundImage = v ? 'url(' + JSON.stringify(A.imgUrl(v)) + ')' : ''; onChange(v); inp.classList.toggle('changed', v !== (opts.orig || '')); };
    const btn = h('button', { class: 'btn small', type: 'button', onclick: async () => { const u = await A.pickImage(inp.value); if (u) set(u); } }, 'Choose or upload');
    return h('div', { class: 'imgfield' }, thumb, h('div', { class: 'meta' }, inp, h('div', { class: 'inline', style: 'margin-top:8px' }, btn, opts.alt ? opts.alt : null)));
  };

  A.toggle = function (checked, onChange, label) {
    const i = h('input', { type: 'checkbox', checked, onchange: () => onChange(i.checked) });
    return h('label', { class: 'toggle' }, i, h('i'), h('span', null, label || ''));
  };

  /* discount steps editor */
  A.tiersControl = function (value, onChange) {
    let rows = (value || []).map((r) => ({ min: r.min, max: r.max, pct: r.pct }));
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      const tb = h('table', { class: 't' }, h('thead', null, h('tr', null, ['From (quantity)', 'Up to (empty = no limit)', 'Percent off', ''].map((x) => h('th', null, x)))));
      const body = h('tbody');
      rows.forEach((r, i) => {
        const mk = (k, ph) => h('input', { type: 'number', min: 0, step: '1', value: r[k] === 0 && k === 'max' ? '' : (r[k] == null ? '' : r[k]), placeholder: ph || '', oninput: (e) => { r[k] = e.target.value === '' ? (k === 'max' ? 0 : '') : Number(e.target.value); onChange(rows.map((x) => ({ min: Number(x.min) || 0, max: Number(x.max) || 0, pct: Number(x.pct) || 0 }))); } });
        body.appendChild(h('tr', null, h('td', null, mk('min')), h('td', null, mk('max', 'no limit')), h('td', null, mk('pct')), h('td', null, h('button', { class: 'btn small danger', type: 'button', onclick: () => { rows.splice(i, 1); onChange(rows.slice()); draw(); } }, 'Remove'))));
      });
      tb.appendChild(body); box.append(tb, h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn small', type: 'button', onclick: () => { const last = rows[rows.length - 1]; rows.push({ min: last ? (last.max ? last.max + 1 : last.min + 5) : 2, max: 0, pct: last ? last.pct + 5 : 5 }); onChange(rows.map((x) => ({ min: Number(x.min) || 0, max: Number(x.max) || 0, pct: Number(x.pct) || 0 }))); draw(); } }, 'Add a step')));
    };
    draw();
    return box;
  };

  /* one setting field */
  A.settingControl = function (f, val, onChange) {
    const cur = val === undefined ? f.def : val;
    const mark = (el, orig) => { el.classList.toggle('changed', !A.eq(val === undefined ? undefined : val, undefined) && !A.eq(el.value, orig == null ? '' : String(orig))); };
    switch (f.t) {
      case 'toggle': return A.toggle(cur === undefined ? !!f.def : !!cur, (v) => onChange(v), (cur === undefined ? !!f.def : !!cur) ? 'On' : 'Off');
      case 'textarea': case 'code': {
        const t = h('textarea', { class: f.t === 'code' ? 'code' : '', placeholder: f.placeholder || '', spellcheck: f.t === 'code' ? 'false' : null, oninput: () => onChange(t.value) }); t.value = cur == null ? '' : cur; return t;
      }
      case 'number': return h('input', { type: 'number', step: f.step || '1', value: cur == null ? '' : cur, placeholder: f.def != null ? String(f.def) : '', oninput: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)) });
      case 'color': {
        const txt = h('input', { type: 'text', value: cur || '', placeholder: f.def || '#000000', style: 'max-width:160px', oninput: () => { sw.value = /^#[0-9a-f]{6}$/i.test(txt.value) ? txt.value : sw.value; onChange(txt.value || null); } });
        const sw = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur || '') ? cur : (/^#[0-9a-f]{6}$/i.test(f.def || '') ? f.def : '#000000'), style: 'width:46px;height:40px;padding:2px;border:1px solid var(--line2);border-radius:9px;background:#fff', oninput: () => { txt.value = sw.value; onChange(sw.value); } });
        return h('div', { class: 'inline' }, sw, txt, h('button', { class: 'link-btn', type: 'button', onclick: () => { txt.value = ''; onChange(null); } }, 'Use original'));
      }
      case 'image': return A.imageControl(cur || '', (v) => onChange(v || null));
      case 'link': return h('input', { type: 'text', list: 'pagelinks', value: cur || '', placeholder: f.placeholder || 'shop.html', oninput: (e) => onChange(e.target.value || null) });
      case 'select': { const s = h('select', { onchange: () => onChange(s.value) }, f.options.map(([v, l]) => h('option', { value: v, selected: v === (cur || f.def) }, l))); return s; }
      case 'tiers': return A.tiersControl(cur, (v) => onChange(v));
      default: return h('input', { type: 'text', value: cur == null ? '' : cur, placeholder: f.placeholder || (f.def != null ? String(f.def) : ''), oninput: (e) => onChange(e.target.value === '' ? null : e.target.value) });
    }
  };

  /* simple visual editor for text that contains formatting (bold, links, coloured words) */
  A.richControl = function (value, onChange, isChanged) {
    const wrap = h('div', { class: 'rich' });
    const ed = h('div', { class: 'rich-ed', contenteditable: 'true', spellcheck: 'true' });
    ed.innerHTML = value;
    const ta = h('textarea', { class: 'code', style: 'display:none;min-height:120px' }); ta.value = value;
    let mode = 'visual';
    const push = (v) => { onChange(v); const c = isChanged ? isChanged(v) : false; ed.classList.toggle('changed', c); ta.classList.toggle('changed', c); };
    ed.addEventListener('input', () => { ta.value = ed.innerHTML; push(ed.innerHTML); });
    ta.addEventListener('input', () => { ed.innerHTML = ta.value; push(ta.value); });
    const cmd = (c, arg) => () => { if (mode !== 'visual') return; ed.focus(); document.execCommand(c, false, arg); ta.value = ed.innerHTML; push(ed.innerHTML); };
    const bar = h('div', { class: 'rtb' },
      h('button', { type: 'button', title: 'Bold', onclick: cmd('bold') }, h('b', null, 'B')),
      h('button', { type: 'button', title: 'Italic', onclick: cmd('italic') }, h('i', null, 'I')),
      h('button', { type: 'button', title: 'Add a link', onclick: () => { if (mode !== 'visual') return; const u = window.prompt('Link address (for example shop.html or https://...)'); if (u) cmd('createLink', u)(); } }, 'Link'),
      h('button', { type: 'button', title: 'Remove formatting from the selected text', onclick: cmd('removeFormat') }, 'Clear'),
      h('span', { class: 'sp' }),
      h('button', { type: 'button', class: 'mode', onclick: (e) => { mode = mode === 'visual' ? 'html' : 'visual'; ed.style.display = mode === 'visual' ? '' : 'none'; ta.style.display = mode === 'html' ? '' : 'none'; if (mode === 'visual') ed.innerHTML = ta.value; e.target.textContent = mode === 'visual' ? 'Show HTML (advanced)' : 'Back to visual editor'; } }, 'Show HTML (advanced)'));
    wrap.append(bar, ed, ta);
    return wrap;
  };

  /* content field (text, link, image) bound to saved content */
  A.contentField = function (f, opts) {
    opts = opts || {};
    const key = f.key;
    const saved = () => A.getContent(key);
    const isEdited = () => saved() !== undefined;
    const cur = () => (saved() === undefined ? f.value : saved());
    const ctl = h('div');
    const wrap = A.frow({ key, hl: opts.hl, label: f.label || f.tag, chip: f.kind === 'src' ? 'Image' : f.kind === 'href' ? 'Link' : f.kind === 'h' ? 'Text with formatting' : 'Text', chipCls: f.kind === 'src' ? 'image' : f.kind === 'href' ? 'link' : 'text', help: opts.help, control: ctl });
    const flag = h('span', { class: 'chip edited', style: 'display:none' }, 'Edited');
    wrap.querySelector('.flabel').appendChild(flag);
    const foot = h('div', { class: 'orig', style: 'display:none' });
    wrap.appendChild(foot);
    const refresh = () => {
      const ed = isEdited() && !A.eq(saved(), f.value);
      flag.style.display = ed ? '' : 'none';
      foot.style.display = ed ? '' : 'none';
      foot.innerHTML = '';
      if (ed) foot.append('Original: ', h('i', null, A.strip(f.value).slice(0, 140) || '(empty)'), h('button', { type: 'button', onclick: () => { A.stage('content', key, null); build(); } }, 'Reset to original'));
    };
    const set = (v) => { A.stage('content', key, A.eq(v, f.value) ? null : v); refresh(); };
    const build = () => {
      ctl.innerHTML = '';
      let el;
      if (f.kind === 'src') {
        const altKey = key.replace(/@src$/, '@alt'); const altF = A.defaults.fields[altKey];
        const altIn = altF ? h('input', { type: 'text', placeholder: 'Describe the picture (for accessibility and search)', style: 'flex:1', value: A.getContent(altKey) === undefined ? altF.value : A.getContent(altKey), oninput: (e) => A.stage('content', altKey, e.target.value === altF.value ? null : e.target.value) }) : null;
        el = A.imageControl(cur(), (v) => set(v), { orig: f.value, alt: altIn });
      } else if (f.kind === 'href') {
        el = h('input', { type: 'text', list: 'pagelinks', value: cur(), oninput: (e) => { set(e.target.value); e.target.classList.toggle('changed', e.target.value !== f.value); } });
      } else {
        if (f.kind === 'h') {
          el = A.richControl(cur(), (v) => set(v), (v) => v !== f.value);
        } else {
          const long = cur().length > 70 || /\n/.test(cur());
          el = long ? h('textarea', { style: 'min-height:' + Math.min(220, 54 + Math.ceil(cur().length / 80) * 22) + 'px', oninput: () => { set(el.value); el.classList.toggle('changed', el.value !== f.value); } }) : h('input', { type: 'text', oninput: () => { set(el.value); el.classList.toggle('changed', el.value !== f.value); } });
          el.value = cur(); el.classList.toggle('changed', isEdited() && cur() !== f.value);
        }
      }
      ctl.appendChild(el);
      if (f.kind === 'h') ctl.appendChild(h('div', { class: 'mini', style: 'margin-top:6px' }, 'Type to change the words. Use B, I and Link for formatting. Coloured or styled words keep their style.'));
      refresh();
    };
    build();
    return wrap;
  };

  /* collapsible card */
  A.card = function (title, sub, body, opts) {
    opts = opts || {};
    const c = h('section', { class: 'card' + (opts.collapsible ? ' collapsible' : '') + (opts.collapsed ? ' collapsed' : '') },
      h('header', { onclick: opts.collapsible ? () => c.classList.toggle('collapsed') : null }, h('h3', null, title, sub ? h('small', null, '  ' + sub) : null), opts.right || (opts.collapsible ? h('span', { class: 'mini' }, '▾') : null)),
      h('div', { class: 'body' }, body));
    return c;
  };

  /* help note */
  A.note = function (tag, lines, kind) {
    lines = Array.isArray(lines) ? lines : [lines];
    return h('div', { class: 'note ' + (kind || '') }, h('span', { class: 'tag' }, tag), h('div', null, lines.length === 1 ? h('p', null, lines[0]) : [h('p', null, lines[0]), h('ul', null, lines.slice(1).map((l) => h('li', null, l)))]));
  };

  A.pageHead = function (title, sub, actions, crumbs) {
    return [
      crumbs ? h('div', { class: 'crumbs' }, crumbs.flatMap((c, i) => [i ? h('span', null, '/') : null, c.href ? h('a', { href: c.href }, c.label) : c.label])) : null,
      h('div', { class: 'pagehead' }, h('div', null, h('h1', null, title), sub ? h('p', null, sub) : null), actions ? h('div', { class: 'actions' }, actions) : null)
    ];
  };

  /* a settings form (one group) */
  A.settingsForm = function (formId) {
    const def = A.SETTINGS[formId]; const gk = def.group || formId;
    const box = h('div');
    const fieldsEl = def.fields.map((f) => {
      const get = () => { const g = A.getSetting(gk); return g ? g[f.k] : undefined; };
      const put = (v) => { const g = Object.assign({}, A.getSetting(gk) || {}); if (v === null || v === undefined || v === '') delete g[f.k]; else g[f.k] = v; A.stage('settings', gk, Object.keys(g).length ? g : null); };
      const ctl = A.settingControl(f, get(), put);
      return A.frow({ key: gk + '.' + f.k, label: f.label, chip: def.tag || 'Setting', chipCls: 'setting', help: f.help, control: ctl });
    });
    box.appendChild(A.card(def.title, null, fieldsEl));
    return box;
  };
})();
