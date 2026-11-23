/** views-main.js — Login, Dashboard, Input Pengeluaran, Daftar Item, Verifikasi. */
window.Views = window.Views || {};
(function () {
  const COLORS = ['#2f4b7c', '#006b5f', '#f59e0b', '#dc2626', '#7c3aed', '#0ea5e9', '#64748b', '#be185d'];
  const isCMS = () => Api.user && Api.user.peran === 'Administrator CMS';

  // ---------- util status optimis ----------
  window.changeStatus = async function (ids, to, okMsg) {
    const prev = ids.map(id => Object.assign({}, Store.item(id))).filter(x => x.id);
    ids.forEach(id => { const it = Store.item(id); if (it) { it.status = to; it._pending = true; } });
    Store.touch();
    try {
      await Api.call('item.status', { ids, status: to });
      ids.forEach(id => { const it = Store.item(id); if (it) delete it._pending; });
      Store.emit(); Sync.run();
      if (okMsg) toast(okMsg, 'ok');
      return true;
    } catch (e) {
      prev.forEach(p => { const i = Store.s.items.findIndex(x => x.id === p.id); if (i >= 0) Store.s.items[i] = p; });
      Store.touch(); toast(e.message, 'err'); return false;
    }
  };

  // =========================================================
  // LOGIN
  // =========================================================
  Views.login = {
    title: 'Masuk',
    render() {
      return '<div class="login"><div class="box">' +
        '<div class="logo">' + icon('wallet') + '</div>' +
        '<h1>' + esc(APP_CONFIG.APP_NAME) + '</h1><div class="muted">Sistem pengeluaran & settlement HRGA</div>' +
        '<div id="login-err"></div>' +
        '<form id="ml-form" style="display:grid;gap:12px;margin-top:20px" autocomplete="on">' +
        '<div class="field"><label for="ml-email">Email</label><input class="in" id="ml-email" type="email" autocomplete="username" inputmode="email" placeholder="nama@perusahaan.com" required></div>' +
        '<div class="field"><label for="ml-pass">Sandi</label><div style="position:relative"><input class="in" id="ml-pass" type="password" autocomplete="current-password" placeholder="Sandi Anda" required style="padding-right:64px"><button type="button" class="btn ghost sm" id="ml-eye" style="position:absolute;right:4px;top:5px">Lihat</button></div></div>' +
        '<button class="btn pri" type="submit" id="ml-btn" style="min-height:44px">Masuk</button></form>' +
        '<div id="g-wrap" class="hidden"><div style="display:flex;align-items:center;gap:10px;margin:18px 0;color:var(--text2);font-size:12px"><span style="flex:1;border-top:1px solid var(--border)"></span>atau<span style="flex:1;border-top:1px solid var(--border)"></span></div>' +
        '<div id="g-btn" style="min-height:44px;display:flex;justify-content:center"></div></div>' +
        '<div id="em-wrap" class="hidden" style="margin-top:18px;border-top:1px solid var(--border);padding-top:12px">' +
        '<button class="btn ghost sm" id="em-toggle" style="width:100%">' + icon('key', 'sm') + ' Akses darurat</button>' +
        '<form id="em-form" style="margin-top:10px;display:none;gap:10px;flex-direction:column"><input class="in" type="password" id="em-pass" placeholder="Sandi akses darurat" autocomplete="off">' +
        '<button class="btn" type="submit">Masuk darurat</button></form></div>' +
        '</div></div>';
    },
    async mount(root) {
      const err = msg => { $('#login-err', root).innerHTML = msg ? '<div class="denied">' + esc(msg) + '</div>' : ''; };
      if (App.loginMsg) { err(App.loginMsg); App.loginMsg = ''; }

      // --- Login manual (selalu tersedia) ---
      $('#ml-eye', root).onclick = () => { const i = $('#ml-pass', root), show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#ml-eye', root).textContent = show ? 'Sembunyi' : 'Lihat'; };
      $('#ml-form', root).onsubmit = async ev => {
        ev.preventDefault(); err('');
        const b = $('#ml-btn', root); btnBusy(b, true, 'Memeriksa…');
        try { const s = await Api.call('auth.manual', { email: $('#ml-email', root).value, password: $('#ml-pass', root).value }); App.onLogin(s); }
        catch (e) { err(e.message === 'Failed to fetch' ? 'Tidak dapat terhubung ke server.' : e.message); btnBusy(b, false); }
      };

      // --- Opsi tambahan: konfigurasi server (Google + akses darurat) ---
      let cfg = {};
      try { cfg = await Api.publicGet('auth.config'); }
      catch (e) { err('Tidak dapat terhubung ke server. Periksa GAS_URL di js/config.js dan deployment Apps Script.'); }
      if (cfg.emergencyEnabled) {
        $('#em-wrap', root).classList.remove('hidden');
        $('#em-toggle', root).onclick = () => { const f = $('#em-form', root); f.style.display = f.style.display === 'none' ? 'flex' : 'none'; };
        $('#em-form', root).onsubmit = async ev => {
          ev.preventDefault(); err('');
          const b = ev.target.querySelector('button'); btnBusy(b, true);
          try { const s = await Api.call('auth.emergency', { password: $('#em-pass', root).value }); App.onLogin(s); }
          catch (e) { err(e.message); btnBusy(b, false); }
        };
      }
      const clientId = APP_CONFIG.GOOGLE_CLIENT_ID || cfg.clientId;
      if (!clientId) return; // Google belum dikonfigurasi: cukup tampilkan login manual
      $('#g-wrap', root).classList.remove('hidden');
      const gb = $('#g-btn', root);
      try {
        await loadScript('https://accounts.google.com/gsi/client');
        google.accounts.id.initialize({
          client_id: clientId, auto_select: false,
          callback: async resp => {
            err(''); gb.style.opacity = .5;
            try { const s = await Api.call('auth.google', { idToken: resp.credential }); App.onLogin(s); }
            catch (e) { gb.style.opacity = 1; err(e.message); }
          }
        });
        google.accounts.id.renderButton(gb, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280, locale: 'id' });
      } catch (e) { gb.innerHTML = '<div class="muted small">Gagal memuat Google Sign-In.</div>'; }
    }
  };
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  // =========================================================
  // DASHBOARD
  // =========================================================
  Views.dashboard = {
    title: 'Dashboard',
    render() {
      const items = Store.s.items;
      const now = new Date(); const ym = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
      const bulanIni = items.filter(i => String(i.tanggal).startsWith(ym));
      const totalBulan = bulanIni.reduce((s, i) => s + i.total, 0);
      const cnt = st => items.filter(i => i.status === st).length;

      // 6 bulan terakhir
      const months = [];
      for (let k = 5; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({ key: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2), label: BLN[d.getMonth()], v: 0 }); }
      items.forEach(i => { const m = months.find(x => String(i.tanggal).startsWith(x.key)); if (m) m.v += i.total; });
      const max = Math.max(1, ...months.map(m => m.v));
      const bars = months.map(m => '<div class="b"><em>' + (m.v ? (m.v >= 1e6 ? (m.v / 1e6).toFixed(1) + ' jt' : Math.round(m.v / 1e3) + ' rb') : '') + '</em><i style="height:' + Math.max(1, Math.round(m.v / max * 140)) + 'px"></i><span>' + m.label + '</span></div>').join('');

      // per kategori (bulan ini)
      const byCat = {};
      bulanIni.forEach(i => { byCat[i.kategori] = (byCat[i.kategori] || 0) + i.total; });
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      let acc = 0; const stops = [];
      cats.forEach(([k, v], idx) => { const p = v / (totalBulan || 1) * 100; stops.push(COLORS[idx % COLORS.length] + ' ' + acc + '% ' + (acc + p) + '%'); acc += p; });
      const donut = cats.length ? '<div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(' + stops.join(',') + ');position:relative;flex:none"><div style="position:absolute;inset:26px;background:#fff;border-radius:50%"></div></div>' : '';
      const legend = cats.length ? cats.slice(0, 7).map(([k, v], idx) => '<div><i style="background:' + COLORS[idx % COLORS.length] + '"></i><span>' + esc(k) + '</span><b>' + rp(v) + '</b></div>').join('') : '<div class="muted">Belum ada pengeluaran bulan ini.</div>';

      const recent = items.slice().sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada))).slice(0, 6);
      const rows = recent.map(i => '<tr data-go="#/item-list"><td>' + esc(i.deskripsi) + '<div class="muted small">' + fmtTgl(i.tanggal) + ' · ' + esc(i.kategori) + '</div></td><td class="r">' + rp(i.total) + '</td><td>' + pill(i.status) + '</td></tr>').join('');

      return '<div class="grid g4" style="margin-bottom:24px">' +
        kpi('wallet', 'Total bulan ini', rp(totalBulan), bulanIni.length + ' item') +
        kpi('send', 'Menunggu verifikasi', cnt('Submitted'), 'Submitted', '#/verification') +
        kpi('alert', 'Perlu revisi', cnt('Revision'), 'Revision', '#/revision-center') +
        kpi('check', 'Final', cnt('Final'), 'siap dicetak', '#/reports') + '</div>' +
        '<div class="grid g-main" style="margin-bottom:24px">' +
        '<div class="card"><div class="card-h"><h3>Pengeluaran 6 bulan terakhir</h3><a class="btn pri sm" href="#/expense-input">' + icon('plusS', 'sm') + ' Input baru</a></div><div class="card-b"><div class="bars">' + bars + '</div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Per kategori (bulan ini)</h3></div><div class="card-b" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' + donut + '<div class="legend" style="flex:1;min-width:150px">' + legend + '</div></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Aktivitas terbaru</h3><a class="btn sm" href="#/item-list">Lihat semua</a></div>' +
        (rows ? '<div class="tbl-wrap"><table class="tbl-cards"><tbody>' + rows + '</tbody></table></div>' : emptyState('Belum ada data. Mulai dengan input pengeluaran pertama.')) + '</div>';
    },
    mount(root) { root.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) location.hash = t.dataset.go; }); }
  };
  function kpi(ic, label, val, sub, go) {
    return '<div class="card kpi" ' + (go ? 'data-go="' + go + '" style="cursor:pointer"' : '') + '><div class="l">' + icon(ic, 'sm') + ' ' + label + '</div><div class="v">' + val + '</div><div class="s">' + sub + '</div></div>';
  }
  function emptyState(msg) { return '<div class="empty">' + icon('file', 'lg') + '<div style="margin-top:8px">' + esc(msg) + '</div></div>'; }
  window.emptyState = emptyState;

  // =========================================================
  // INPUT PENGELUARAN
  // =========================================================
  Views.input = {
    title: 'Input Pengeluaran', live: false,
    P: [], removed: [], editId: null,
    render(ctx) {
      this.P = []; this.removed = []; this.editId = null;
      let it = null;
      if (ctx.q.id) {
        it = Store.item(ctx.q.id);
        if (!it) { setTimeout(() => { toast('Item tidak ditemukan.', 'err'); location.hash = '#/item-list'; }, 0); return ''; }
        if (it.status === 'Final') { setTimeout(() => { toast('Item Final terkunci.', 'err'); location.hash = '#/item-list'; }, 0); return ''; }
        this.editId = it.id;
        this.P = (it.foto || []).map(f => ({ id: f.id, name: f.name, remote: true }));
      } else if (App.failed) { it = App.failed.form; this.P = App.failed.photos || []; App.failed = null; }
      it = it || { tanggal: today(), kategori: '', deskripsi: '', vendor: '', qty: 1, satuan: 'pcs', harga: '', modePajak: 'Non-PPN', catatan: '' };
      const kats = Store.s.kategori.filter(k => String(k.aktif).toLowerCase() === 'true' || k.aktif === true);
      const opt = kats.map(k => '<option ' + (k.nama === it.kategori ? 'selected' : '') + '>' + esc(k.nama) + '</option>').join('');
      const rate = Store.s.pengaturan.PPN_PERSEN || 11;
      return '<form id="f" class="grid g-main" autocomplete="off" novalidate>' +
        '<div class="card"><div class="card-h"><h3>' + (this.editId ? 'Ubah item ' + esc(this.editId) : 'Detail pengeluaran') + '</h3></div><div class="card-b"><div class="row">' +
        '<div class="row r2"><div class="field"><label>Tanggal</label><input class="in" type="date" name="tanggal" value="' + esc(it.tanggal) + '" required></div>' +
        '<div class="field"><label>Kategori</label><select class="in" name="kategori" required><option value="">Pilih kategori…</option>' + opt + '</select></div></div>' +
        '<div class="field"><label>Deskripsi</label><input class="in" name="deskripsi" maxlength="200" placeholder="mis. Makan siang rapat vendor" value="' + esc(it.deskripsi) + '" required></div>' +
        '<div class="field"><label>Vendor / Toko</label><input class="in" name="vendor" maxlength="120" value="' + esc(it.vendor) + '"></div>' +
        '<div class="row r3"><div class="field"><label>Qty</label><input class="in tn" name="qty" inputmode="decimal" value="' + esc(it.qty) + '"></div>' +
        '<div class="field"><label>Satuan</label><input class="in" name="satuan" maxlength="20" value="' + esc(it.satuan) + '"></div>' +
        '<div class="field"><label>Harga satuan (Rp)</label><input class="in tn" name="harga" inputmode="numeric" placeholder="0" value="' + esc(it.harga) + '"></div></div>' +
        '<div class="field"><label>Mode pajak (PPN ' + esc(rate) + '%)</label><div class="seg" id="seg">' + ['Non-PPN', 'Include', 'Exclude'].map(m => '<button type="button" data-m="' + m + '" class="' + (m === it.modePajak ? 'on' : '') + '">' + m + '</button>').join('') + '</div>' +
        '<div class="muted small" id="seg-help"></div></div>' +
        '<div class="field"><label>Catatan</label><textarea class="in" name="catatan" maxlength="500">' + esc(it.catatan) + '</textarea></div>' +
        '</div></div></div>' +
        '<div style="display:grid;gap:24px;align-content:start">' +
        '<div class="card"><div class="card-h"><h3>Ringkasan</h3></div><div class="card-b"><div class="sum tn" id="sum"></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Foto bukti</h3><span class="muted small" id="pcount"></span></div><div class="card-b"><div class="thumbs" id="thumbs"></div>' +
        '<div class="drop" id="drop" style="margin-top:12px">' + icon('camera') + '<div>Ambil foto / pilih gambar</div><div class="small">Dikompres otomatis · maks. 5 foto</div></div>' +
        '<input type="file" id="file" accept="image/*" multiple hidden></div></div>' +
        '<div style="display:grid;gap:10px"><button class="btn teal" type="submit" data-st="Submitted">' + icon('send', 'sm') + ' Ajukan untuk verifikasi</button>' +
        '<button class="btn" type="button" id="draft">Simpan sebagai Draft</button></div></div></form>';
    },
    mount(root, ctx) {
      const self = this, f = $('#f', root);
      let mode = $('#seg .on', root) ? $('#seg .on', root).dataset.m : 'Non-PPN';
      const val = n => f.elements[n].value;
      const upd = () => {
        const t = calcTax(String(val('qty')).replace(',', '.'), String(val('harga')).replace(/\D/g, ''), mode, Store.ppnRate());
        $('#sum', root).innerHTML = '<div><span>Subtotal</span><b>' + rp(t.subtotal) + '</b></div><div><span>PPN</span><b>' + rp(t.ppn) + '</b></div><div class="tot"><span>Total</span><span>' + rp(t.total) + '</span></div>';
        $('#seg-help', root).textContent = { 'Non-PPN': 'Tanpa PPN. “Tambah PPN” hanya dapat diterapkan saat cetak laporan.', Include: 'Harga sudah termasuk PPN → dipisahkan otomatis.', Exclude: 'Harga belum termasuk PPN → PPN ditambahkan.' }[mode];
      };
      f.addEventListener('input', upd);
      $('#seg', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; $$('#seg button', root).forEach(x => x.classList.toggle('on', x === b)); upd(); };
      upd();

      const drawThumbs = () => {
        $('#pcount', root).textContent = self.P.length + '/5';
        $('#thumbs', root).innerHTML = self.P.map((p, i) => '<div class="thumb" data-i="' + i + '">' + (p.preview ? '<img src="' + p.preview + '" alt="">' : '<span>' + icon('image') + '</span>') + '<button type="button" class="x" data-rm="' + i + '" aria-label="Hapus foto">' + icon('x', 'sm') + '</button></div>').join('');
        self.P.forEach((p, i) => { if (p.remote && !p.preview) Photos.get(p.id).then(u => { p.preview = u; const el = $('.thumb[data-i="' + i + '"]', root); if (el) el.querySelector('span').outerHTML = '<img src="' + u + '" alt="">'; }).catch(() => {}); });
        $('#drop', root).style.display = self.P.length >= 5 ? 'none' : '';
      };
      drawThumbs();
      $('#thumbs', root).onclick = e => {
        const rm = e.target.closest('[data-rm]'); if (!rm) return;
        const p = self.P.splice(+rm.dataset.rm, 1)[0]; if (p.remote) self.removed.push(p.id); drawThumbs();
      };
      $('#drop', root).onclick = () => $('#file', root).click();
      $('#file', root).onchange = async e => {
        const files = Array.from(e.target.files).slice(0, 5 - self.P.length); e.target.value = '';
        for (const file of files) {
          try { self.P.push(await compressImage(file)); drawThumbs(); } catch (err) { toast('Gambar tidak dapat dibaca.', 'err'); }
        }
      };

      const submit = async status => {
        const v = n => String(val(n)).trim();
        if (!v('tanggal')) return toast('Tanggal wajib diisi.', 'err');
        if (!v('kategori')) return toast('Pilih kategori.', 'err');
        if (!v('deskripsi')) return toast('Deskripsi wajib diisi.', 'err');
        const qty = Number(v('qty').replace(',', '.')), harga = Number(v('harga').replace(/\D/g, ''));
        if (!(qty > 0)) return toast('Qty harus lebih dari 0.', 'err');
        const payload = { id: self.editId || undefined, tanggal: v('tanggal'), kategori: v('kategori'), deskripsi: v('deskripsi'), vendor: v('vendor'), qty, satuan: v('satuan') || 'pcs', harga, modePajak: mode, catatan: v('catatan'), status };
        saveItemOptimistic(payload, self.P.slice(), self.removed.slice());
      };
      f.onsubmit = e => { e.preventDefault(); submit('Submitted'); };
      $('#draft', root).onclick = () => submit('Draft');
    }
  };

  async function saveItemOptimistic(payload, photos, removed) {
    const isEdit = !!payload.id;
    const prev = isEdit ? Object.assign({}, Store.item(payload.id)) : null;
    const tmpId = isEdit ? payload.id : 'TMP-' + Date.now();
    const t = calcTax(payload.qty, payload.harga, payload.modePajak, Store.ppnRate());
    Store.upsertItem(Object.assign({}, prev || { foto: [], dibuatOleh: Api.user.email, dibuatPada: new Date().toISOString(), laporanId: '' }, payload, t, { id: tmpId, _pending: true }));
    location.hash = '#/item-list';
    const note = toast('Menyimpan…', '', 15000);
    try {
      const saved = await Api.call('item.save', payload);
      if (!isEdit) Store.s.items = Store.s.items.filter(i => i.id !== tmpId);
      let cur = saved;
      Store.upsertItem(cur);
      for (const id of removed) { try { const r = await Api.call('foto.remove', { itemId: saved.id, fileId: id }); cur = Object.assign({}, Store.item(saved.id), { foto: r.foto }); Store.upsertItem(cur); } catch (e) { toast('Hapus foto gagal: ' + e.message, 'err'); } }
      const fresh = photos.filter(p => !p.remote);
      for (let i = 0; i < fresh.length; i++) {
        note && (note.firstChild.textContent = 'Mengunggah foto ' + (i + 1) + '/' + fresh.length + '…');
        try { const r = await Api.call('foto.upload', { itemId: saved.id, mime: fresh[i].mime, base64: fresh[i].base64 }, { retry: 1 }); cur = Object.assign({}, Store.item(saved.id), { foto: r.foto }); Store.upsertItem(cur); }
        catch (e) { toast('Foto ' + (i + 1) + ' gagal diunggah: ' + e.message, 'err'); }
      }
      note && note.remove();
      toast(payload.status === 'Submitted' ? 'Item diajukan ✓' : 'Draft tersimpan ✓', 'ok');
      Sync.run();
    } catch (e) {
      note && note.remove();
      if (isEdit) Store.upsertItem(prev); else { Store.s.items = Store.s.items.filter(i => i.id !== tmpId); Store.touch(); }
      App.failed = { form: payload, photos };
      toast('Gagal menyimpan: ' + e.message, 'err', 8000);
      location.hash = isEdit ? '#/expense-input?id=' + payload.id : '#/expense-input';
    }
  }

  // =========================================================
  // DAFTAR ITEM
  // =========================================================
  const F = { q: '', status: '', kategori: '', bulan: '' };
  const SEL = new Set();
  Views.items = {
    title: 'Daftar Item',
    render() {
      const kats = Store.s.kategori.map(k => '<option>' + esc(k.nama) + '</option>').join('');
      return '<div class="toolbar"><div class="grow" style="position:relative"><input class="in" id="q" placeholder="Cari deskripsi / vendor / ID…" value="' + esc(F.q) + '" style="padding-left:36px"><span style="position:absolute;left:11px;top:10px;color:var(--text2)">' + icon('search', 'sm') + '</span></div>' +
        '<select class="in" id="fs"><option value="">Semua status</option>' + ['Draft', 'Submitted', 'Revision', 'Final'].map(s => '<option ' + (F.status === s ? 'selected' : '') + '>' + s + '</option>').join('') + '</select>' +
        '<select class="in" id="fk"><option value="">Semua kategori</option>' + kats + '</select>' +
        '<input class="in" type="month" id="fb" value="' + esc(F.bulan) + '">' +
        '<a class="btn pri" href="#/expense-input">' + icon('plusS', 'sm') + ' Item baru</a></div>' +
        '<div id="bulk"></div><div class="card"><div class="tbl-wrap" id="tbl"></div></div>';
    },
    mount(root) {
      const self = this;
      $('#fk', root).value = F.kategori;
      const draw = () => self.draw(root);
      $('#q', root).oninput = debounce(e => { F.q = e.target.value; draw(); }, 120);
      $('#fs', root).onchange = e => { F.status = e.target.value; draw(); };
      $('#fk', root).onchange = e => { F.kategori = e.target.value; draw(); };
      $('#fb', root).onchange = e => { F.bulan = e.target.value; draw(); };
      root.addEventListener('click', e => self.click(e, root));
      root.addEventListener('change', e => {
        if (e.target.matches('[data-sel]')) { e.target.checked ? SEL.add(e.target.dataset.sel) : SEL.delete(e.target.dataset.sel); self.drawBulk(root); }
        if (e.target.matches('#all')) { self.filtered().forEach(i => e.target.checked ? SEL.add(i.id) : SEL.delete(i.id)); draw(); }
      });
      draw();
    },
    onStore(root) { this.draw(root); },
    filtered() {
      const q = F.q.toLowerCase();
      return Store.s.items.filter(i => (!F.status || i.status === F.status) && (!F.kategori || i.kategori === F.kategori) && (!F.bulan || String(i.tanggal).startsWith(F.bulan)) &&
        (!q || (i.deskripsi + ' ' + i.vendor + ' ' + i.id).toLowerCase().includes(q)))
        .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.dibuatPada).localeCompare(String(a.dibuatPada)));
    },
    draw(root) {
      const list = this.filtered();
      [...SEL].forEach(id => { if (!Store.item(id)) SEL.delete(id); });
      const tbl = $('#tbl', root); if (!tbl) return;
      if (!list.length) { tbl.innerHTML = emptyState(Store.s.items.length ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada item pengeluaran.'); this.drawBulk(root); return; }
      const rows = list.map(i => {
        const locked = i.status === 'Final', tmp = String(i.id).startsWith('TMP-');
        return '<tr style="' + (i._pending ? 'opacity:.6' : '') + '"><td class="nol" style="width:36px"><input class="chk" type="checkbox" data-sel="' + esc(i.id) + '" ' + (SEL.has(i.id) ? 'checked' : '') + '></td>' +
          '<td data-l="Tanggal">' + fmtTgl(i.tanggal) + '</td>' +
          '<td data-l="Deskripsi"><div class="bold">' + esc(i.deskripsi) + '</div><div class="muted small">' + esc(i.id) + ' · ' + esc(i.kategori) + (i.vendor ? ' · ' + esc(i.vendor) : '') + '</div></td>' +
          '<td data-l="Foto" class="r">' + ((i.foto || []).length ? icon('camera', 'sm') + ' ' + i.foto.length : '<span class="muted">–</span>') + '</td>' +
          '<td data-l="Total" class="r bold">' + rp(i.total) + '</td><td data-l="Status">' + pill(i.status) + (i.laporanId ? '<div class="muted small">' + esc(i.laporanId) + '</div>' : '') + '</td>' +
          '<td class="nol r" style="white-space:nowrap">' +
          (tmp ? '<span class="muted small">menyimpan…</span>' : locked ? (isCMS() ? '<button class="btn sm" data-reopen="' + esc(i.id) + '" title="Buka kembali (CMS)">' + icon('unlock', 'sm') + '</button>' : '<span class="muted" title="Final — terkunci">' + icon('lock', 'sm') + '</span>') :
            '<a class="btn sm" href="#/expense-input?id=' + esc(i.id) + '" aria-label="Ubah">' + icon('edit', 'sm') + '</a> <button class="btn sm dng" data-del="' + esc(i.id) + '" aria-label="Hapus">' + icon('trash', 'sm') + '</button>') + '</td></tr>';
      }).join('');
      const allOn = list.length && list.every(i => SEL.has(i.id));
      tbl.innerHTML = '<table class="tbl-cards"><thead><tr><th style="width:36px"><input class="chk" id="all" type="checkbox" ' + (allOn ? 'checked' : '') + '></th><th>Tanggal</th><th>Deskripsi</th><th class="r">Foto</th><th class="r">Total</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
      this.drawBulk(root);
    },
    drawBulk(root) {
      const ids = [...SEL], its = ids.map(Store.item).filter(Boolean);
      const b = $('#bulk', root); if (!b) return;
      if (!its.length) { b.innerHTML = ''; return; }
      const drafts = its.filter(i => i.status === 'Draft' || i.status === 'Revision').length, finals = its.filter(i => i.status === 'Final').length;
      const tot = its.reduce((s, i) => s + i.total, 0);
      b.innerHTML = '<div class="card" style="padding:10px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:sticky;top:64px;z-index:5"><b>' + its.length + ' dipilih</b><span class="muted tn">' + rp(tot) + '</span><span style="flex:1"></span>' +
        '<button class="btn sm" data-bulk="submit" ' + (drafts ? '' : 'disabled') + '>' + icon('send', 'sm') + ' Ajukan (' + drafts + ')</button>' +
        '<button class="btn sm teal" data-bulk="report" ' + (finals ? '' : 'disabled') + '>' + icon('file', 'sm') + ' Buat laporan (' + finals + ')</button>' +
        '<button class="btn sm dng" data-bulk="del">' + icon('trash', 'sm') + ' Hapus</button><button class="btn sm ghost" data-bulk="clear">Batal</button></div>';
    },
    async click(e, root) {
      const del = e.target.closest('[data-del]'), re = e.target.closest('[data-reopen]'), bk = e.target.closest('[data-bulk]');
      if (del) return this.hapus([del.dataset.del], root);
      if (re) return this.reopen(re.dataset.reopen);
      if (!bk) return;
      const ids = [...SEL], its = ids.map(Store.item).filter(Boolean), act = bk.dataset.bulk;
      if (act === 'clear') { SEL.clear(); return this.draw(root); }
      if (act === 'del') return this.hapus(ids, root);
      if (act === 'submit') {
        const t = its.filter(i => i.status === 'Draft' || i.status === 'Revision').map(i => i.id);
        // Revision harus diajukan lewat simpan ulang (menutup catatan revisi); hanya Draft yang bisa massal
        const drafts = its.filter(i => i.status === 'Draft').map(i => i.id);
        if (t.length !== drafts.length) toast('Item berstatus Revision diajukan ulang lewat tombol ubah.', '', 4500);
        if (drafts.length) { SEL.clear(); await changeStatus(drafts, 'Submitted', drafts.length + ' item diajukan ✓'); }
      }
      if (act === 'report') { Views.reports.pre = its.filter(i => i.status === 'Final').map(i => i.id); SEL.clear(); location.hash = '#/reports'; }
    },
    async hapus(ids, root) {
      const its = ids.map(Store.item).filter(Boolean);
      if (its.some(i => i.status === 'Final')) return toast('Item Final tidak dapat dihapus.', 'err');
      if (!(await confirmBox('Hapus ' + its.length + ' item beserta foto buktinya? Tindakan ini tidak dapat dibatalkan.', 'Hapus', true))) return;
      const backup = its.map(i => Object.assign({}, i));
      ids.forEach(id => { Store.s.items = Store.s.items.filter(i => i.id !== id); SEL.delete(id); }); Store.touch();
      try { await Api.call('item.delete', { ids }); toast('Terhapus ✓', 'ok'); Sync.run(); }
      catch (e) { Store.s.items = backup.concat(Store.s.items); Store.touch(); toast(e.message, 'err'); }
    },
    reopen(id) {
      openModal({
        title: 'Buka kembali item Final', body: '<p class="muted" style="margin-top:0">Item akan kembali ke status Submitted. Tindakan dicatat pada audit log.</p><div class="field"><label>Alasan (wajib)</label><textarea class="in" id="ra" maxlength="300"></textarea></div>',
        footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="ok">Buka kembali</button>',
        onMount: m => { m.querySelector('#ok').onclick = async ev => {
          const alasan = m.querySelector('#ra').value.trim(); if (!alasan) return toast('Alasan wajib diisi.', 'err');
          btnBusy(ev.target, true);
          try { await Api.call('item.reopen', { id, alasan }); closeModal(); toast('Item dibuka kembali ✓', 'ok'); await Sync.run(true); }
          catch (e) { toast(e.message, 'err'); btnBusy(ev.target, false); }
        }; }
      });
    }
  };

  // =========================================================
  // VERIFIKASI
  // =========================================================
  Views.verification = {
    title: 'Verifikasi', curId: null, idx: 0, tab: 'angka',
    list() { return Store.s.items.filter(i => i.status === 'Submitted' && !String(i.id).startsWith('TMP-')).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))); },
    render() {
      const L = this.list();
      if (!L.length) return '<div class="card">' + emptyState('Tidak ada item yang menunggu verifikasi. 🎉') + '</div>';
      let i = L.findIndex(x => x.id === this.curId);
      if (i < 0) i = Math.max(0, Math.min(this.idx, L.length - 1));
      this.idx = i; this.curId = L[i].id;
      const it = L[i];
      const rate = Store.s.pengaturan.PPN_PERSEN || 11;
      Photos.prefetch((it.foto || []).map(f => f.id)); if (L[i + 1]) Photos.prefetch(L[i + 1].foto.map(f => f.id));
      const fotos = it.foto || [];
      return '<div class="toolbar"><button class="btn" data-nav="-1" ' + (i === 0 ? 'disabled' : '') + '>' + icon('left', 'sm') + ' Sebelumnya</button><b class="tn">' + (i + 1) + ' / ' + L.length + '</b>' +
        '<button class="btn" data-nav="1" ' + (i === L.length - 1 ? 'disabled' : '') + '>Berikutnya ' + icon('right', 'sm') + '</button><span style="flex:1"></span>' +
        '<button class="btn dng" data-act="rev">' + icon('alert', 'sm') + ' Tandai perlu revisi</button><button class="btn teal" data-act="final" ' + (it._pending ? 'disabled' : '') + '>' + icon('check', 'sm') + ' Finalkan</button></div>' +
        '<div class="tabs"><button class="' + (this.tab === 'angka' ? 'on' : '') + '" data-tab="angka">Angka</button><button class="' + (this.tab === 'foto' ? 'on' : '') + '" data-tab="foto">Foto (' + fotos.length + ')</button></div>' +
        '<div class="split tabbed"><div class="' + (this.tab === 'angka' ? 'show' : '') + '"><div class="card"><div class="card-h"><h3>' + esc(it.deskripsi) + '</h3>' + pill(it.status) + '</div><div class="card-b">' +
        '<dl class="kv"><dt>ID</dt><dd>' + esc(it.id) + '</dd><dt>Tanggal</dt><dd>' + fmtTgl(it.tanggal) + '</dd><dt>Kategori</dt><dd>' + esc(it.kategori) + '</dd><dt>Vendor</dt><dd>' + esc(it.vendor || '-') + '</dd>' +
        '<dt>Qty × Harga</dt><dd class="tn">' + esc(it.qty) + ' ' + esc(it.satuan) + ' × ' + rp(it.harga) + '</dd><dt>Mode pajak</dt><dd>' + esc(it.modePajak) + ' (' + rate + '%)</dd><dt>Dibuat oleh</dt><dd>' + esc(it.dibuatOleh) + '</dd><dt>Catatan</dt><dd>' + esc(it.catatan || '-') + '</dd></dl>' +
        '<div class="sum tn" style="margin-top:16px"><div><span>Subtotal</span><b>' + rp(it.subtotal) + '</b></div><div><span>PPN</span><b>' + rp(it.ppn) + '</b></div><div class="tot"><span>Total</span><span>' + rp(it.total) + '</span></div></div></div></div></div>' +
        '<div class="' + (this.tab === 'foto' ? 'show' : '') + '"><div class="card"><div class="card-h"><h3>Foto bukti</h3><span class="muted small">' + fotos.length + ' berkas</span></div><div class="card-b">' +
        (fotos.length ? '<div class="photo-view" id="pv"><div class="skel" style="width:60%"></div></div><div class="thumbs" id="pth" style="margin-top:12px">' + fotos.map((f, k) => '<div class="thumb" data-p="' + k + '"><span>' + icon('image') + '</span></div>').join('') + '</div>' : '<div class="empty">' + icon('image', 'lg') + '<div>Tanpa lampiran foto</div></div>') +
        '</div></div></div></div>';
    },
    mount(root) {
      const self = this;
      const it = Store.item(this.curId);
      const show = k => { const f = it && it.foto[k]; if (!f) return; Photos.get(f.id).then(u => { const pv = $('#pv', root); if (pv) pv.innerHTML = '<img src="' + u + '" alt="Foto bukti">'; }).catch(e => { const pv = $('#pv', root); if (pv) pv.innerHTML = '<div class="muted" style="color:#cbd5e1">' + esc(e.message) + '</div>'; }); };
      if (it && it.foto.length) { show(0); it.foto.forEach((f, k) => Photos.get(f.id).then(u => { const t = $('.thumb[data-p="' + k + '"]', root); if (t) t.innerHTML = '<img src="' + u + '" alt="">'; }).catch(() => {})); }
      if (root._bound) return; root._bound = true;
      root.addEventListener('click', async e => {
        const n = e.target.closest('[data-nav]'), a = e.target.closest('[data-act]'), t = e.target.closest('[data-tab]'), p = e.target.closest('[data-p]');
        const L = self.list();
        if (p) { const cur = Store.item(self.curId); const f = cur && cur.foto[+p.dataset.p]; if (f) Photos.get(f.id).then(u => { const pv = $('#pv', root); if (pv) pv.innerHTML = '<img src="' + u + '" alt="">'; }); }
        if (t) { self.tab = t.dataset.tab; App.rerender(); }
        if (n) { const i = Math.max(0, Math.min(L.length - 1, self.idx + (+n.dataset.nav))); self.idx = i; self.curId = L[i].id; self.tab = 'angka'; App.rerender(); }
        if (a && a.dataset.act === 'final') {
          const cur = Store.item(self.curId); if (!cur) return;
          self.idx = L.findIndex(x => x.id === cur.id); self.curId = null;
          changeStatus([cur.id], 'Final', 'Item difinalkan ✓');
        }
        if (a && a.dataset.act === 'rev') self.revisi();
      });
    },
    revisi() {
      const cur = Store.item(this.curId); if (!cur) return;
      const self = this;
      openModal({
        title: 'Tandai perlu revisi', body: '<div class="muted" style="margin-bottom:10px">' + esc(cur.deskripsi) + ' — ' + rp(cur.total) + '</div><div class="field"><label>Catatan revisi (wajib)</label><textarea class="in" id="rc" maxlength="500" placeholder="mis. Foto nota kurang jelas / nominal tidak sesuai"></textarea></div>',
        footer: '<button class="btn" data-close>Batal</button><button class="btn dng" id="ok">Kirim ke revisi</button>',
        onMount: m => { m.querySelector('#ok').onclick = async () => {
          const catatan = m.querySelector('#rc').value.trim(); if (!catatan) return toast('Catatan wajib diisi.', 'err');
          closeModal();
          const prev = Object.assign({}, cur), tmp = { id: 'TMP-' + Date.now(), itemId: cur.id, catatan, status: 'Open', dibuatOleh: Api.user.email, dibuatPada: new Date().toISOString() };
          self.idx = self.list().findIndex(x => x.id === cur.id); self.curId = null;
          cur.status = 'Revision'; Store.s.revisi.unshift(tmp); Store.touch();
          try { await Api.call('revisi.add', { itemId: cur.id, catatan }); toast('Dikirim ke Pusat Revisi ✓', 'ok'); Sync.run(); }
          catch (e) { const i = Store.s.items.findIndex(x => x.id === prev.id); if (i >= 0) Store.s.items[i] = prev; Store.s.revisi = Store.s.revisi.filter(r => r !== tmp); Store.touch(); toast(e.message, 'err'); }
        }; }
      });
    }
  };
})();
