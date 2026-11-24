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
  const BLN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const CAT_COLORS = ['#153464', '#4fa66f', '#f5a524', '#8b5cf6', '#0ea5b7', '#e5484d', '#64748b', '#be185d'];
  const D = { range: '6', catMonth: '' };
  const ymKey = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  const nameOf = email => {
    const u = (Store.s.pengguna || []).find(x => String(x.email).toLowerCase() === String(email || '').toLowerCase());
    if (u && u.nama) return u.nama;
    return String(email || '-').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  const pct1 = n => n.toFixed(1).replace('.', ',') + '%';
  const STATUS_ID = { Submitted: 'Menunggu', Revision: 'Revisi', Draft: 'Draft', Final: 'Final', Tercetak: 'Tercetak' };

  Views.dashboard = {
    title: 'Dashboard',
    render() {
      const items = Store.s.items;
      const now = new Date(), ym = ymKey(now);
      if (!D.catMonth) D.catMonth = ym;
      const bulanIni = items.filter(i => String(i.tanggal).startsWith(ym));
      const totalBulan = bulanIni.reduce((s, i) => s + i.total, 0);
      const cnt = st => items.filter(i => i.status === st).length;

      // ---- Tren ----
      const n = D.range === '12' ? 12 : D.range === 'ytd' ? now.getMonth() + 1 : 6;
      const months = [];
      for (let k = n - 1; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({ key: ymKey(d), label: BLN[d.getMonth()], v: 0 }); }
      items.forEach(i => { const m = months.find(x => String(i.tanggal).startsWith(x.key)); if (m) m.v += i.total; });
      const max = Math.max(...months.map(m => m.v), 1);
      const niceMax = v => { const mag = Math.pow(10, Math.floor(Math.log10(v))); for (const c of [1, 2, 2.5, 5, 10]) if (c * mag >= v) return c * mag; return 10 * mag; };
      const top = niceMax(max);
      const compact = v => v >= 1e9 ? (v / 1e9).toFixed(1).replace('.0', '') + ' M' : v >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + ' jt' : v >= 1e3 ? Math.round(v / 1e3) + ' rb' : String(Math.round(v));
      const ticks = [0, 1, 2, 3, 4].map(k => ({ p: k * 25, v: top * k / 4 }));
      const yAxis = ticks.map(t => '<span style="bottom:' + t.p + '%">' + (t.v ? compact(t.v) : '0') + '</span>').join('');
      const grid = ticks.map(t => '<i class="gl" style="bottom:' + t.p + '%"></i>').join('');
      const cols = months.map((m, idx) => {
        const h = m.v ? Math.max(1.5, m.v / top * 100) : 0, cur = idx === months.length - 1;
        const lbl = m.v ? (n > 6 ? 'Rp ' + compact(m.v) : rp(m.v)) : 'Rp 0';
        return '<div class="ch-col' + (cur ? ' cur' : '') + '" title="' + m.label + ': ' + rp(m.v) + '"><span class="ch-v' + (m.v ? '' : ' z') + '" style="bottom:calc(' + h + '% + 4px)">' + lbl + '</span><b class="ch-bar" style="height:' + h + '%"></b></div>';
      }).join('');
      const xAxis = months.map(m => '<span>' + m.label + '</span>').join('');
      const barChart = '<div class="chart"><div class="ch-y">' + yAxis + '</div><div class="ch-plot">' + grid + '<div class="ch-bars">' + cols + '</div></div><div></div><div class="ch-x">' + xAxis + '</div></div>';
      const seg = '<div class="seg sm" id="dr">' + [['6', '6 Bulan'], ['12', '12 Bulan'], ['ytd', 'YTD']].map(x => '<button data-r="' + x[0] + '" class="' + (D.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';

      // ---- Per kategori (bulan terpilih) ----
      const sel = items.filter(i => String(i.tanggal).startsWith(D.catMonth));
      const totalSel = sel.reduce((s, i) => s + i.total, 0);
      const byCat = {};
      sel.forEach(i => { byCat[i.kategori] = (byCat[i.kategori] || 0) + i.total; });
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const kOrder = (Store.s.kategori || []).map(k => k.nama);
      const colorOf = nm => { const x = kOrder.indexOf(nm); return CAT_COLORS[(x < 0 ? Math.abs(String(nm).length) : x) % CAT_COLORS.length]; };
      const mOpts = []; for (let k = 0; k < 12; k++) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); mOpts.push('<option value="' + ymKey(d) + '" ' + (ymKey(d) === D.catMonth ? 'selected' : '') + '>' + BLN_FULL[d.getMonth()] + ' ' + d.getFullYear() + '</option>'); }
      const catRows = cats.length ? cats.slice(0, 8).map(([k, v]) => {
        const p = v / (totalSel || 1) * 100, c = colorOf(k);
        return '<div class="cr"><span class="cn"><i style="background:' + c + '"></i>' + esc(k) + '</span><span class="cb"><u style="width:' + Math.max(p, 1.5) + '%;background:' + c + '"></u></span><span class="cp">' + pct1(p) + '</span><span class="cv">' + rp(v) + '</span></div>';
      }).join('') : '<div class="muted" style="padding:18px 0;text-align:center">Belum ada pengeluaran pada bulan ini.</div>';

      // ---- Terbaru ----
      const recent = items.slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.dibuatPada).localeCompare(String(a.dibuatPada))).slice(0, 5);
      const rows = recent.map(i => {
        const c = colorOf(i.kategori), ds = displayStatus(i);
        return '<tr data-go="#/item-list"><td data-l="Tanggal" class="nw">' + fmtTgl(i.tanggal) + '</td><td data-l="No. Pengajuan" class="nw tn">' + esc(i.id) + '</td><td data-l="Keterangan" class="desc">' + esc(i.deskripsi) + '</td>' +
          '<td data-l="Kategori"><span class="chipc" style="--c:' + c + '">' + esc(i.kategori) + '</span></td><td data-l="Pemohon">' + esc(nameOf(i.dibuatOleh)) + '</td><td data-l="Nominal" class="r nw bold">' + rp(i.total) + '</td>' +
          '<td data-l="Status"><span class="pill ' + esc(ds) + '">' + esc(STATUS_ID[ds] || ds) + '</span></td><td data-l="Aksi" class="nol r"><a class="eye" href="#/item-list" aria-label="Lihat">' + icon('eye', 'sm') + '</a></td></tr>';
      }).join('');

      return '<div class="grid g4" style="margin-bottom:24px">' +
        kpi('wallet', 'blue', 'Total Pengeluaran Bulan Ini', rp(totalBulan), 'file', bulanIni.length + ' Transaksi', '#/item-list') +
        kpi('clock', 'blue', 'Menunggu Finalisasi', cnt('Submitted'), '', 'Menunggu Persetujuan', '#/item-list?status=Submitted') +
        kpi('alert', 'orange', 'Perlu Revisi', cnt('Revision'), '', 'Perlu Perbaikan', '#/revision-center') +
        kpi('check', 'green', 'Final', items.filter(i => i.status === 'Final' && !i.laporanId).length, '', 'Siap Dicetak', '#/item-list?status=Final') + '</div>' +
        '<div class="grid g-main" style="margin-bottom:24px">' +
        '<div class="card"><div class="card-h"><h3 class="ttl">' + icon('trend') + ' Tren Pengeluaran ' + (D.range === '12' ? '12 Bulan' : D.range === 'ytd' ? 'Tahun Ini' : '6 Bulan Terakhir') + '</h3>' + seg + '</div><div class="card-b">' + barChart + '</div></div>' +
        '<div class="card"><div class="card-h"><h3 class="ttl">' + icon('dashboard') + ' Pengeluaran per Kategori</h3><select class="in sm" id="cm" style="width:auto">' + mOpts.join('') + '</select></div><div class="card-b">' +
        '<div class="catsum"><div><small>Total Pengeluaran</small><b>' + rp(totalSel) + '</b></div><div class="sep"></div><div class="kc"><b>' + cats.length + ' Kategori</b></div></div>' +
        '<div class="cr ch"><span>Kategori</span><span></span><span class="cp">Persentase</span><span class="cv">Nominal</span></div>' + catRows + '</div></div></div>' +
        '<div class="card"><div class="card-h"><h3 class="ttl">' + icon('list') + ' Transaksi Pengeluaran Terbaru</h3><a class="lnk" href="#/item-list">Lihat Semua ' + icon('right', 'sm') + '</a></div>' +
        (rows ? '<div class="tbl-wrap"><table class="tbl-cards"><thead><tr><th>Tanggal</th><th>No. Pengajuan</th><th>Keterangan</th><th>Kategori</th><th>Pemohon</th><th class="r">Nominal</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : emptyState('Belum ada data. Mulai dengan input pengeluaran pertama.')) + '</div>';
    },
    mount(root) {
      root.addEventListener('click', e => {
        const r = e.target.closest('[data-r]'); if (r) { D.range = r.dataset.r; return App.rerender(); }
        const t = e.target.closest('[data-go]'); if (t && !e.target.closest('a')) location.hash = t.dataset.go;
      });
      const cm = $('#cm', root); if (cm) cm.onchange = () => { D.catMonth = cm.value; App.rerender(); };
    }
  };
  function kpi(ic, tone, label, val, subIc, sub, go) {
    return '<div class="card kpi" data-go="' + go + '"><div class="ki ' + tone + '">' + icon(ic) + '</div><div class="kb"><div class="l">' + label + '</div><div class="v">' + val + '</div><div class="s">' + (subIc ? icon(subIc, 'sm') + ' ' : '') + sub + '</div></div><span class="ka">' + icon('right', 'sm') + '</span></div>';
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
        '<div class="field"><label>Deskripsi</label><textarea class="in" name="deskripsi" maxlength="400" rows="3" placeholder="mis. Baterai Dell Precision 5550 P91F XPS 15 9500 9510" required>' + esc(it.deskripsi) + '</textarea></div>' +
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
  window.displayStatus = i => (i.status === 'Final' && i.laporanId) ? 'Tercetak' : i.status;
  const lapNomor = id => { const l = Store.s.laporan.find(x => x.id === id); return l ? (l.nomor || l.id) : id; };
  const F = { q: '', status: '', kategori: '', bulan: '', limit: 50 };
  const SEL = new Set();

  // ---- lightbox foto bukti ----
  window.openLightbox = function (itemId, start) {
    const it = Store.item(itemId); if (!it || !(it.foto || []).length) return;
    let k = Math.max(0, Math.min(start || 0, it.foto.length - 1));
    const m = openModal({
      title: it.deskripsi.slice(0, 60) + ' — foto bukti', wide: true, noFocus: true,
      body: '<div class="lb"><button class="btn lb-nav" data-d="-1" aria-label="Sebelumnya">' + icon('left') + '</button><div class="photo-view" id="lbv"><div class="skel" style="width:50%"></div></div><button class="btn lb-nav" data-d="1" aria-label="Berikutnya">' + icon('right') + '</button></div>' +
        '<div class="muted small" id="lbc" style="text-align:center;margin-top:10px"></div><div class="thumbs" id="lbt" style="margin-top:10px;justify-content:center"></div>'
    });
    const show = i => {
      k = (i + it.foto.length) % it.foto.length;
      $('#lbc', m).textContent = (k + 1) + ' / ' + it.foto.length + ' · ' + it.id + ' · ' + rp(it.total);
      $$('#lbt .thumb', m).forEach((t, x) => t.style.outline = x === k ? '3px solid var(--primary-c)' : 'none');
      const v = $('#lbv', m); v.innerHTML = '<div class="skel" style="width:50%"></div>';
      const my = k; Photos.get(it.foto[k].id).then(u => { const vv = $('#lbv', m); if (vv && my === k) vv.innerHTML = '<img src="' + u + '" alt="Foto bukti ' + (k + 1) + '">'; })
        .catch(e => { const vv = $('#lbv', m); if (vv) vv.innerHTML = '<div style="color:#cbd5e1;padding:20px">' + esc(e.message) + '</div>'; });
      Photos.prefetch([it.foto[(k + 1) % it.foto.length].id]);
    };
    $('#lbt', m).innerHTML = it.foto.map((f, x) => '<div class="thumb" data-i="' + x + '"><span>' + icon('image') + '</span></div>').join('');
    it.foto.forEach((f, x) => Photos.get(f.id).then(u => { const t = $('#lbt .thumb[data-i="' + x + '"]', m); if (t) t.innerHTML = '<img src="' + u + '" alt="">'; }).catch(() => {}));
    m.addEventListener('click', e => { const n = e.target.closest('[data-d]'), t = e.target.closest('.thumb[data-i]'); if (n) show(k + (+n.dataset.d)); if (t) show(+t.dataset.i); });
    const key = e => { if (!$('#modal')) return document.removeEventListener('keydown', key); if (e.key === 'ArrowLeft') show(k - 1); if (e.key === 'ArrowRight') show(k + 1); };
    document.addEventListener('keydown', key);
    show(k);
  };

  // ---- tandai perlu revisi (dipindah dari halaman Verifikasi) ----
  window.markRevisi = function (id) {
    const cur = Store.item(id); if (!cur) return;
    if (cur.status === 'Final') return toast('Item Final terkunci. Minta Administrator CMS membukanya kembali.', 'err');
    openModal({
      title: 'Tandai perlu revisi', body: '<div class="muted" style="margin-bottom:10px">' + esc(cur.deskripsi) + ' — ' + rp(cur.total) + '</div><div class="field"><label>Catatan revisi (wajib)</label><textarea class="in" id="rc" maxlength="500" placeholder="mis. Foto nota kurang jelas / nominal tidak sesuai"></textarea></div>',
      footer: '<button class="btn" data-close>Batal</button><button class="btn dng" id="ok">Kirim ke revisi</button>',
      onMount: m => { m.querySelector('#ok').onclick = async () => {
        const catatan = m.querySelector('#rc').value.trim(); if (!catatan) return toast('Catatan wajib diisi.', 'err');
        closeModal();
        const prev = Object.assign({}, cur), tmp = { id: 'TMP-' + Date.now(), itemId: cur.id, catatan, status: 'Open', dibuatOleh: Api.user.email, dibuatPada: new Date().toISOString() };
        cur.status = 'Revision'; Store.s.revisi.unshift(tmp); Store.touch();
        try { await Api.call('revisi.add', { itemId: cur.id, catatan }); toast('Dikirim ke Pusat Revisi ✓', 'ok'); Sync.run(); }
        catch (e) { const i = Store.s.items.findIndex(x => x.id === prev.id); if (i >= 0) Store.s.items[i] = prev; Store.s.revisi = Store.s.revisi.filter(r => r !== tmp); Store.touch(); toast(e.message, 'err'); }
      }; }
    });
  };

  Views.items = {
    title: 'Daftar Item',
    setFilter(o) { Object.assign(F, { q: '', status: '', kategori: '', bulan: '', limit: 50 }, o || {}); },
    render(ctx) {
      if (ctx && ctx.q && ctx.q.status !== undefined && !ctx._f) { ctx._f = true; this.setFilter({ status: ctx.q.status }); }
      const kats = Store.s.kategori.map(k => '<option>' + esc(k.nama) + '</option>').join('');
      const stOpt = [['Draft', 'Draft'], ['Submitted', 'Submitted (menunggu finalisasi)'], ['Revision', 'Revision'], ['Final', 'Final (belum dicetak)'], ['Tercetak', 'Final · Tercetak']];
      return '<div class="toolbar"><div class="grow" style="position:relative"><input class="in" id="q" placeholder="Cari deskripsi / vendor / ID…" value="' + esc(F.q) + '" style="padding-left:36px"><span style="position:absolute;left:11px;top:10px;color:var(--text2)">' + icon('search', 'sm') + '</span></div>' +
        '<select class="in" id="fs"><option value="">Semua status</option>' + stOpt.map(o => '<option value="' + o[0] + '" ' + (F.status === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
        '<select class="in" id="fk"><option value="">Semua kategori</option>' + kats + '</select>' +
        '<input class="in" type="month" id="fb" value="' + esc(F.bulan) + '">' +
        '<a class="btn pri" href="#/expense-input">' + icon('plusS', 'sm') + ' Item baru</a></div>' +
        '<div id="bulk"></div><div class="card"><div class="tbl-wrap" id="tbl"></div></div>';
    },
    mount(root) {
      const self = this;
      $('#fk', root).value = F.kategori;
      const draw = () => self.draw(root);
      $('#q', root).oninput = debounce(e => { F.q = e.target.value; F.limit = 50; draw(); }, 120);
      $('#fs', root).onchange = e => { F.status = e.target.value; F.limit = 50; draw(); };
      $('#fk', root).onchange = e => { F.kategori = e.target.value; F.limit = 50; draw(); };
      $('#fb', root).onchange = e => { F.bulan = e.target.value; F.limit = 50; draw(); };
      root.addEventListener('click', e => self.click(e, root));
      root.addEventListener('change', e => {
        if (e.target.matches('[data-sel]')) { e.target.checked ? SEL.add(e.target.dataset.sel) : SEL.delete(e.target.dataset.sel); self.drawBulk(root); }
        if (e.target.matches('#all')) { self.filtered().slice(0, F.limit).forEach(i => e.target.checked ? SEL.add(i.id) : SEL.delete(i.id)); draw(); }
      });
      draw();
    },
    onStore(root) { this.draw(root); },
    filtered() {
      const q = F.q.toLowerCase();
      return Store.s.items.filter(i => (!F.status || displayStatus(i) === F.status) && (!F.kategori || i.kategori === F.kategori) && (!F.bulan || String(i.tanggal).startsWith(F.bulan)) &&
        (!q || (i.deskripsi + ' ' + i.vendor + ' ' + i.id).toLowerCase().includes(q)))
        .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.dibuatPada).localeCompare(String(a.dibuatPada)));
    },
    draw(root) {
      const all = this.filtered(), list = all.slice(0, F.limit);
      [...SEL].forEach(id => { if (!Store.item(id)) SEL.delete(id); });
      const tbl = $('#tbl', root); if (!tbl) return;
      if (!all.length) { tbl.innerHTML = emptyState(Store.s.items.length ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada item pengeluaran.'); this.drawBulk(root); return; }
      const rows = list.map(i => {
        const ds = displayStatus(i), tmp = String(i.id).startsWith('TMP-'), final = i.status === 'Final', nf = (i.foto || []).length;
        let aksi;
        if (tmp) aksi = '<span class="muted small">menyimpan…</span>';
        else {
          aksi = '<div class="acts">' +
            (i.status === 'Submitted' ? '<button class="btn sm teal" data-fin="' + esc(i.id) + '">' + icon('check', 'sm') + ' Finalkan</button>' : '') +
            '<button class="btn sm ' + (final ? 'locked' : '') + '" data-edit="' + esc(i.id) + '" title="' + (final ? 'Item Final terkunci' : 'Ubah item') + '">' + icon(final ? 'lock' : 'edit', 'sm') + ' Edit</button>' +
            '<button class="btn sm dng ' + (final ? 'locked' : '') + '" data-del="' + esc(i.id) + '" title="' + (final ? 'Item Final terkunci' : 'Hapus item') + '">' + icon('trash', 'sm') + ' Hapus</button>' +
            '<button class="btn sm" data-more="' + esc(i.id) + '" aria-label="Menu lainnya">⋯</button></div>';
        }
        return '<tr style="' + (i._pending ? 'opacity:.6' : '') + '"><td class="nol" style="width:36px"><input class="chk" type="checkbox" data-sel="' + esc(i.id) + '" ' + (SEL.has(i.id) ? 'checked' : '') + '></td>' +
          '<td data-l="Tanggal" style="white-space:nowrap">' + fmtTgl(i.tanggal) + '</td>' +
          '<td data-l="Deskripsi" class="desc"><div class="bold">' + esc(i.deskripsi) + '</div><div class="muted small">' + esc(i.id) + ' · ' + esc(i.kategori) + (i.vendor ? ' · ' + esc(i.vendor) : '') + '</div></td>' +
          '<td data-l="Foto" class="r">' + (nf ? '<button class="btn sm photo-badge" data-photo="' + esc(i.id) + '" title="Lihat foto bukti">' + icon('camera', 'sm') + ' ' + nf + '</button>' : '<span class="muted">–</span>') + '</td>' +
          '<td data-l="Total" class="r bold">' + rp(i.total) + '</td>' +
          '<td data-l="Status">' + pill(ds) + (ds === 'Tercetak' ? '<div class="muted small">' + esc(lapNomor(i.laporanId)) + '</div>' : '') + '</td>' +
          '<td class="nol r">' + aksi + '</td></tr>';
      }).join('');
      const allOn = list.length && list.every(i => SEL.has(i.id));
      tbl.innerHTML = '<table class="tbl-cards"><thead><tr><th style="width:36px"><input class="chk" id="all" type="checkbox" ' + (allOn ? 'checked' : '') + '></th><th>Tanggal</th><th>Deskripsi</th><th class="r">Foto</th><th class="r">Total</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="more-row muted small">Menampilkan ' + list.length + ' dari ' + all.length + ' item' + (all.length > list.length ? ' · <button class="btn sm" data-more-rows>Tampilkan ' + Math.min(50, all.length - list.length) + ' lagi</button>' : '') + '</div>';
      this.drawBulk(root);
    },
    drawBulk(root) {
      const ids = [...SEL], its = ids.map(Store.item).filter(Boolean);
      const b = $('#bulk', root); if (!b) return;
      if (!its.length) { b.innerHTML = ''; return; }
      const n = st => its.filter(i => i.status === st).length;
      const tot = its.reduce((s, i) => s + i.total, 0);
      b.innerHTML = '<div class="card bulkbar"><b>' + its.length + ' dipilih</b><span class="muted tn">' + rp(tot) + '</span><span style="flex:1"></span>' +
        '<button class="btn sm" data-bulk="submit" ' + (n('Draft') ? '' : 'disabled') + '>' + icon('send', 'sm') + ' Ajukan (' + n('Draft') + ')</button>' +
        '<button class="btn sm teal" data-bulk="final" ' + (n('Submitted') ? '' : 'disabled') + '>' + icon('check', 'sm') + ' Finalkan (' + n('Submitted') + ')</button>' +
        '<button class="btn sm teal" data-bulk="report" ' + (n('Final') ? '' : 'disabled') + '>' + icon('file', 'sm') + ' Buat laporan (' + n('Final') + ')</button>' +
        '<button class="btn sm dng" data-bulk="del">' + icon('trash', 'sm') + ' Hapus</button><button class="btn sm ghost" data-bulk="clear">Batal</button></div>';
    },
    async finalkan(ids) {
      const ok = await confirmBox('Finalkan ' + ids.length + ' item? Setelah Final, item terkunci dan hanya Administrator CMS yang dapat membukanya kembali.', 'Finalkan');
      if (ok) await changeStatus(ids, 'Final', ids.length + ' item difinalkan ✓');
    },
    async click(e, root) {
      const q = s => e.target.closest(s);
      const del = q('[data-del]'), ed = q('[data-edit]'), fin = q('[data-fin]'), ph = q('[data-photo]'), more = q('[data-more]'), bk = q('[data-bulk]');
      if (q('[data-more-rows]')) { F.limit += 50; return this.draw(root); }
      if (ph) return openLightbox(ph.dataset.photo, 0);
      if (fin) return this.finalkan([fin.dataset.fin]);
      if (ed) { const it = Store.item(ed.dataset.edit); if (it && it.status === 'Final') return toast('Item Final terkunci' + (isCMS() ? ' — gunakan menu ⋯ → Buka kembali.' : '. Minta Administrator CMS membukanya kembali.'), 'err'); location.hash = '#/expense-input?id=' + ed.dataset.edit; return; }
      if (del) return this.hapus([del.dataset.del], root);
      if (more) return this.menu(more, more.dataset.more, root);
      if (!bk) return;
      const ids = [...SEL], its = ids.map(Store.item).filter(Boolean), act = bk.dataset.bulk;
      if (act === 'clear') { SEL.clear(); return this.draw(root); }
      if (act === 'del') return this.hapus(ids, root);
      if (act === 'submit') { const d = its.filter(i => i.status === 'Draft').map(i => i.id); if (d.length) { SEL.clear(); await changeStatus(d, 'Submitted', d.length + ' item diajukan ✓'); } }
      if (act === 'final') { const d = its.filter(i => i.status === 'Submitted').map(i => i.id); if (d.length) { await this.finalkan(d); SEL.clear(); this.draw(root); } }
      if (act === 'report') { Views.reports.pre = its.filter(i => i.status === 'Final').map(i => i.id); SEL.clear(); location.hash = '#/reports'; }
    },
    menu(anchor, id) {
      const it = Store.item(id); if (!it) return;
      const final = it.status === 'Final', nf = (it.foto || []).length;
      openMenu(anchor, [
        { label: 'Lihat foto bukti (' + nf + ')', icon: 'camera', disabled: !nf, run: () => openLightbox(id, 0) },
        { label: 'Finalkan', icon: 'check', disabled: it.status !== 'Submitted', run: () => this.finalkan([id]) },
        { label: 'Tandai perlu revisi', icon: 'alert', disabled: final, run: () => markRevisi(id) },
        { label: 'Buka kembali (CMS)', icon: 'unlock', disabled: !(final && isCMS()), run: () => this.reopen(id) }
      ]);
    },
    async hapus(ids, root) {
      const its = ids.map(Store.item).filter(Boolean);
      if (its.some(i => i.status === 'Final')) return toast('Item Final terkunci dan tidak dapat dihapus.', 'err');
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
})();
