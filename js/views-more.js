/** views-more.js — Pusat Revisi, Laporan, Template, Kategori & Pengaturan, Pengguna & Audit. */
(function () {
  const T = v => String(v).toLowerCase() === 'true';
  const emptyState = window.emptyState;

  // =========================================================
  // PUSAT REVISI
  // =========================================================
  const RV = { tab: 'open' };
  Views.revisions = {
    title: 'Pusat Revisi',
    render() {
      const all = Store.s.revisi.filter(r => !/^\[BUKA KEMBALI\]/.test(r.catatan || ''));
      const open = all.filter(r => r.status === 'Open'), done = all.filter(r => r.status !== 'Open');
      const list = (RV.tab === 'open' ? open : done).sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada)));
      const cards = list.map(r => {
        const it = Store.item(r.itemId);
        return '<div class="card" style="padding:16px 18px;margin-bottom:12px"><div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:220px">' +
          '<div class="bold">' + esc(it ? it.deskripsi : r.itemId) + ' ' + (it ? pill(it.status) : '') + '</div>' +
          '<div class="muted small">' + esc(r.itemId) + (it ? ' · ' + rp(it.total) + ' · ' + fmtTgl(it.tanggal) : '') + '</div>' +
          '<div style="margin-top:8px;background:#fff7ed;border-left:3px solid var(--sub);padding:8px 10px;border-radius:0 8px 8px 0">' + esc(r.catatan) + '</div>' +
          '<div class="muted small" style="margin-top:6px">Oleh ' + esc(r.dibuatOleh) + ' · ' + fmtWaktu(r.dibuatPada) + (r.status !== 'Open' ? ' · selesai ' + fmtWaktu(r.selesaiPada) : '') + '</div></div>' +
          (r.status === 'Open' && it ? '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn pri sm" href="#/expense-input?id=' + esc(r.itemId) + '">' + icon('edit', 'sm') + ' Perbaiki &amp; ajukan ulang</a><button class="btn sm" data-res="' + esc(r.id) + '">' + icon('check', 'sm') + ' Tandai selesai</button></div>' : '') +
          '</div></div>';
      }).join('');
      return '<div class="toolbar"><div class="seg" id="rt"><button data-t="open" class="' + (RV.tab === 'open' ? 'on' : '') + '">Perlu tindakan (' + open.length + ')</button><button data-t="done" class="' + (RV.tab === 'done' ? 'on' : '') + '">Riwayat (' + done.length + ')</button></div></div>' +
        (cards || '<div class="card">' + emptyState(RV.tab === 'open' ? 'Tidak ada revisi yang menunggu. 🎉' : 'Belum ada riwayat revisi.') + '</div>');
    },
    mount(root) {
      root.addEventListener('click', async e => {
        const t = e.target.closest('[data-t]'); if (t) { RV.tab = t.dataset.t; return App.rerender(); }
        const b = e.target.closest('[data-res]'); if (!b) return;
        const r = Store.s.revisi.find(x => x.id === b.dataset.res); if (!r || r._p) return;
        const prevR = Object.assign({}, r), it = Store.item(r.itemId), prevS = it && it.status;
        r.status = 'Resolved'; r.selesaiPada = new Date().toISOString();
        const masih = Store.s.revisi.some(x => x.itemId === r.itemId && x.status === 'Open');
        if (it && !masih && it.status === 'Revision') it.status = 'Submitted';
        Store.touch();
        try { await Api.call('revisi.resolve', { id: r.id }); toast('Revisi ditandai selesai ✓', 'ok'); Sync.run(); }
        catch (err) { Object.assign(r, prevR); if (it) it.status = prevS; Store.touch(); toast(err.message, 'err'); }
      });
    }
  };

  // =========================================================
  // LAPORAN
  // =========================================================
  const R = { jenis: 'REIMB_SBA', tambahPpn: false, judul: '', periode: '', sel: new Set(), hideDone: true, busy: false };
  Views.reports = {
    title: 'Laporan', pre: null, live: false,
    cands() {
      return Store.s.items.filter(i => i.status === 'Final' && (!R.hideDone || !i.laporanId || R.sel.has(i.id))).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
    },
    line(it) {
      let sub = it.subtotal, ppn = it.ppn, tot = it.total;
      if (R.tambahPpn && it.modePajak === 'Non-PPN') { ppn = Math.round(sub * Store.ppnRate()); tot = sub + ppn; }
      return { sub, ppn, tot };
    },
    render() {
      if (this.pre) { R.sel = new Set(this.pre); R.hideDone = false; this.pre = null; }
      [...R.sel].forEach(id => { const i = Store.item(id); if (!i || i.status !== 'Final') R.sel.delete(id); });
      const tpl = Store.s.templates || [];
      return '<div class="grid g-main"><div class="card"><div class="card-h"><h3>1. Pilih item Final</h3><label class="small muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="chk" id="hd" ' + (R.hideDone ? 'checked' : '') + '> sembunyikan yang sudah dicetak</label></div><div class="tbl-wrap" id="cl" style="max-height:380px"></div></div>' +
        '<div class="card"><div class="card-h"><h3>2. Opsi laporan</h3></div><div class="card-b"><div class="row">' +
        '<div class="field"><label>Jenis laporan</label><div class="seg" id="sj"><button data-j="REIMB_SBA" class="' + (R.jenis === 'REIMB_SBA' ? 'on' : '') + '">REIMB / SBA</button><button data-j="PR" class="' + (R.jenis === 'PR' ? 'on' : '') + '">Purchase Request</button></div></div>' +
        '<div class="field"><label>Judul (opsional)</label><input class="in" id="rj" maxlength="120" value="' + esc(R.judul) + '" placeholder="Bawaan sesuai jenis"></div>' +
        '<div class="field"><label>Periode (opsional)</label><input class="in" id="rpd" maxlength="80" value="' + esc(R.periode) + '" placeholder="Otomatis dari tanggal item"></div>' +
        '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" class="chk" id="rp" style="margin-top:3px" ' + (R.tambahPpn ? 'checked' : '') + '><span><b>Tambah PPN ' + (Store.s.pengaturan.PPN_PERSEN || 11) + '%</b><br><span class="muted small">Hanya untuk item berstatus Non-PPN saat dicetak. Item Include/Exclude tidak berubah.</span></span></label>' +
        '<div class="sum tn" id="rs"></div>' +
        (tpl.length || Api.user.peran !== 'Administrator CMS' ? '' : '') +
        '<button class="btn teal" id="gen">' + icon('download', 'sm') + ' Buat PDF &amp; Excel</button></div></div></div></div>' +
        '<div class="card" style="margin-top:24px"><div class="card-h"><h3>Pratinjau laporan</h3><span class="muted small" id="pcnt"></span></div><div class="tbl-wrap" id="pv"></div></div>' +
        '<div class="card" style="margin-top:24px"><div class="card-h"><h3>Riwayat laporan</h3></div><div class="tbl-wrap" id="hist"></div></div>';
    },
    mount(root) {
      const self = this;
      const drawList = () => {
        const c = self.cands();
        $('#cl', root).innerHTML = c.length ? '<table class="tbl-cards"><thead><tr><th style="width:36px"><input class="chk" id="all" type="checkbox" ' + (c.every(i => R.sel.has(i.id)) ? 'checked' : '') + '></th><th>Tanggal</th><th>Deskripsi</th><th class="r">Total</th></tr></thead><tbody>' +
          c.map(i => '<tr><td class="nol"><input class="chk" type="checkbox" data-s="' + esc(i.id) + '" ' + (R.sel.has(i.id) ? 'checked' : '') + '></td><td data-l="Tanggal">' + fmtTgl(i.tanggal) + '</td><td data-l="Deskripsi">' + esc(i.deskripsi) + '<div class="muted small">' + esc(i.id) + (i.laporanId ? ' · sudah di ' + esc(i.laporanId) : '') + '</div></td><td data-l="Total" class="r">' + rp(i.total) + '</td></tr>').join('') + '</tbody></table>' :
          emptyState('Belum ada item Final. Finalkan item lewat menu Verifikasi.');
      };
      const drawPrev = () => {
        const its = Store.s.items.filter(i => R.sel.has(i.id)).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
        let S = 0, P = 0, Tt = 0;
        const rows = its.map((it, k) => { const l = self.line(it); S += l.sub; P += l.ppn; Tt += l.tot;
          return '<tr><td>' + (k + 1) + '</td><td>' + fmtTgl(it.tanggal) + '</td><td>' + esc(it.deskripsi) + '</td><td>' + esc(it.kategori) + '</td><td class="r">' + esc(it.qty) + ' ' + esc(it.satuan) + '</td><td class="r">' + rp(it.harga) + '</td><td class="r">' + rp(l.sub) + '</td><td class="r">' + rp(l.ppn) + '</td><td class="r bold">' + rp(l.tot) + '</td><td class="r">' + ((it.foto || []).length || '<span class="muted small">tanpa lampiran</span>') + '</td></tr>'; }).join('');
        $('#pv', root).innerHTML = its.length ? '<table><thead><tr><th>No</th><th>Tanggal</th><th>Deskripsi</th><th>Kategori</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Subtotal</th><th class="r">PPN</th><th class="r">Total</th><th class="r">Foto</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="6" class="r bold">TOTAL</td><td class="r bold">' + rp(S) + '</td><td class="r bold">' + rp(P) + '</td><td class="r bold">' + rp(Tt) + '</td><td></td></tr></tfoot></table>' : emptyState('Pilih item untuk melihat pratinjau.');
        $('#pcnt', root).textContent = its.length + ' item';
        $('#rs', root).innerHTML = '<div><span>Item dipilih</span><b>' + its.length + '</b></div><div><span>Subtotal</span><b>' + rp(S) + '</b></div><div><span>PPN</span><b>' + rp(P) + '</b></div><div class="tot"><span>Total</span><span>' + rp(Tt) + '</span></div>';
        $('#gen', root).disabled = !its.length || R.busy;
      };
      const drawHist = () => {
        const h = Store.s.laporan.slice().sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada)));
        $('#hist', root).innerHTML = h.length ? '<table class="tbl-cards"><thead><tr><th>No. Laporan</th><th>Jenis</th><th>Periode</th><th class="r">Item</th><th class="r">Total</th><th>Dibuat</th><th></th></tr></thead><tbody>' +
          h.map(l => '<tr><td data-l="No." class="bold">' + esc(l.id) + '</td><td data-l="Jenis">' + (l.jenis === 'PR' ? 'Purchase Request' : 'REIMB / SBA') + '</td><td data-l="Periode">' + esc(l.periode) + '</td><td data-l="Item" class="r">' + esc(l.jumlahItem) + '</td><td data-l="Total" class="r">' + rp(l.total) + '</td><td data-l="Dibuat">' + fmtWaktu(l.dibuatPada) + '<div class="muted small">' + esc(l.dibuatOleh) + '</div></td>' +
            '<td class="nol r" style="white-space:nowrap"><button class="btn sm" data-dl="pdf:' + esc(l.id) + '">' + icon('download', 'sm') + ' PDF</button> <button class="btn sm" data-dl="xlsx:' + esc(l.id) + '">' + icon('download', 'sm') + ' Excel</button></td></tr>').join('') + '</tbody></table>' : emptyState('Belum ada laporan yang dibuat.');
      };
      drawList(); drawPrev(); drawHist();
      root.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-s]')) { t.checked ? R.sel.add(t.dataset.s) : R.sel.delete(t.dataset.s); drawPrev(); }
        if (t.id === 'all') { self.cands().forEach(i => t.checked ? R.sel.add(i.id) : R.sel.delete(i.id)); drawList(); drawPrev(); }
        if (t.id === 'hd') { R.hideDone = t.checked; drawList(); }
        if (t.id === 'rp') { R.tambahPpn = t.checked; drawPrev(); }
      });
      root.addEventListener('input', e => { if (e.target.id === 'rj') R.judul = e.target.value; if (e.target.id === 'rpd') R.periode = e.target.value; });
      $('#sj', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; R.jenis = b.dataset.j; $$('#sj button', root).forEach(x => x.classList.toggle('on', x === b)); };
      root.addEventListener('click', async e => {
        const dl = e.target.closest('[data-dl]');
        if (dl) {
          const [fmt, id] = dl.dataset.dl.split(':'); btnBusy(dl, true, '…');
          try { const f = await Api.call('laporan.file', { id, format: fmt }, { timeout: 120000, retry: 1 }); download(f.name, f.mime, f.base64); }
          catch (err) { toast(err.message, 'err'); } finally { btnBusy(dl, false); }
          return;
        }
        if (e.target.closest('#gen')) self.generate(root, drawPrev, drawHist, drawList);
      });
    },
    async generate(root, drawPrev, drawHist, drawList) {
      const ids = [...R.sel]; if (!ids.length || R.busy) return;
      const btn = $('#gen', root); R.busy = true; btnBusy(btn, true, 'Membuat laporan… (10–40 dtk)');
      try {
        const lap = await Api.call('laporan.generate', { jenis: R.jenis, itemIds: ids, tambahPpn: R.tambahPpn, judul: R.judul, periode: R.periode }, { timeout: 200000 });
        Store.s.laporan.unshift(lap);
        ids.forEach(id => { const i = Store.item(id); if (i) i.laporanId = lap.id; });
        R.sel.clear(); Store.touch(); Sync.run();
        toast('Laporan ' + lap.id + ' siap ✓', 'ok');
        drawList(); drawPrev(); drawHist();
        openModal({
          title: 'Laporan siap diunduh', body: '<p style="margin-top:0"><b>' + esc(lap.id) + '</b> · ' + lap.jumlahItem + ' item · ' + rp(lap.total) + '</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn pri" data-d="pdf">' + icon('download', 'sm') + ' Unduh PDF</button><button class="btn" data-d="xlsx">' + icon('download', 'sm') + ' Unduh Excel</button></div>',
          onMount: m => { m.addEventListener('click', async ev => { const b = ev.target.closest('[data-d]'); if (!b) return; btnBusy(b, true, '…'); try { const f = await Api.call('laporan.file', { id: lap.id, format: b.dataset.d }, { timeout: 120000, retry: 1 }); download(f.name, f.mime, f.base64); } catch (er) { toast(er.message, 'err'); } btnBusy(b, false); }); }
        });
      } catch (e) { toast(e.message, 'err', 8000); }
      finally { R.busy = false; btnBusy(btn, false); drawPrev(); }
    }
  };

  // =========================================================
  // TEMPLATE LAPORAN (CMS)
  // =========================================================
  Views.templates = {
    title: 'Template Laporan', live: false,
    render() { return '<div class="grid g2" id="tp"><div class="card"><div class="card-b"><div class="skel"></div></div></div></div>' +
      '<div class="card" style="margin-top:24px"><div class="card-h"><h3>Placeholder yang tersedia</h3></div><div class="card-b small"><p style="margin-top:0">Gunakan penanda berikut di Google Sheets. Baris item ditandai dengan <code>{{no}}</code> dan akan digandakan otomatis.</p>' +
      '<p><b>Umum:</b> <code>{{perusahaan}} {{alamat}} {{judul}} {{no_laporan}} {{tanggal_cetak}} {{periode}} {{subtotal}} {{ppn}} {{total}} {{terbilang}} {{pembuat}} {{jabatan_pembuat}} {{penyetuju}} {{jabatan_penyetuju}}</code></p>' +
      '<p><b>Baris item:</b> <code>{{no}} {{tanggal}} {{deskripsi}} {{kategori}} {{vendor}} {{qty}} {{satuan}} {{harga}} {{subtotal_item}} {{ppn_item}} {{total_item}}</code></p>' +
      '<p class="muted" style="margin-bottom:0">Halaman “Lampiran” (foto bukti, atau tulisan “tanpa lampiran”) ditambahkan otomatis di akhir laporan.</p></div></div>'; },
    async mount(root) {
      const draw = list => {
        $('#tp', root).innerHTML = list.map(t => '<div class="card"><div class="card-h"><h3>' + (t.jenis === 'PR' ? 'Purchase Request' : 'REIMB / SBA') + '</h3></div><div class="card-b"><div class="row">' +
          '<div class="muted small">' + (t.fileId ? esc(t.nama) + ' · diubah ' + fmtWaktu(t.diubahPada) : 'Belum ada template.') + '</div>' +
          (t.url ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(t.url) + '">' + icon('file', 'sm') + ' Buka di Google Sheets</a>' : '') +
          '<div class="field"><label>Ganti dengan template sendiri (tautan Google Sheets)</label><input class="in" data-u="' + t.jenis + '" placeholder="https://docs.google.com/spreadsheets/d/…"></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-sv="' + t.jenis + '">Simpan tautan</button><button class="btn" data-rs="' + t.jenis + '">Kembalikan ke bawaan</button></div></div></div></div>').join('');
      };
      try { const list = await Api.call('template.list', {}); Store.s.templates = list; draw(list); } catch (e) { toast(e.message, 'err'); }
      root.addEventListener('click', async e => {
        const sv = e.target.closest('[data-sv]'), rs = e.target.closest('[data-rs]');
        try {
          if (sv) { const u = $('[data-u="' + sv.dataset.sv + '"]', root).value.trim(); if (!u) return toast('Isi tautan template.', 'err'); btnBusy(sv, true); draw(await Api.call('template.save', { jenis: sv.dataset.sv, url: u })); toast('Template disimpan ✓', 'ok'); }
          if (rs) { if (!(await confirmBox('Kembalikan template ' + rs.dataset.rs + ' ke bawaan? Template lama tidak dihapus dari Drive.'))) return; btnBusy(rs, true); draw(await Api.call('template.reset', { jenis: rs.dataset.rs })); toast('Template dikembalikan ✓', 'ok'); }
        } catch (er) { toast(er.message, 'err'); if (sv) btnBusy(sv, false); if (rs) btnBusy(rs, false); }
      });
    }
  };

  // =========================================================
  // KATEGORI & PENGATURAN (CMS)
  // =========================================================
  Views.settings = {
    title: 'Kategori & Pengaturan', live: false,
    render() {
      const P = Store.s.pengaturan, ck = (k, l, sub) => '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" class="chk" data-ev="' + k + '" ' + (T(P[k]) ? 'checked' : '') + ' style="margin-top:3px"><span>' + l + (sub ? '<br><span class="muted small">' + sub + '</span>' : '') + '</span></label>';
      const inp = (k, l, ph) => '<div class="field"><label>' + l + '</label><input class="in" data-p="' + k + '" value="' + esc(P[k] || '') + '" placeholder="' + (ph || '') + '"></div>';
      return '<div class="grid g2" style="align-items:start"><div style="display:grid;gap:24px">' +
        '<div class="card"><div class="card-h"><h3>Kategori</h3><button class="btn pri sm" id="kadd">' + icon('plusS', 'sm') + ' Tambah</button></div><div class="tbl-wrap" id="kt"></div></div>' +
        '<div class="card"><div class="card-h"><h3>Identitas & tanda tangan laporan</h3></div><div class="card-b"><div class="row">' +
        inp('NAMA_PERUSAHAAN', 'Nama perusahaan') + inp('ALAMAT', 'Alamat') + '<div class="row r2">' + inp('NAMA_PEMBUAT', 'Nama pembuat') + inp('JABATAN_PEMBUAT', 'Jabatan pembuat') + inp('NAMA_PENYETUJU', 'Nama penyetuju') + inp('JABATAN_PENYETUJU', 'Jabatan penyetuju') + '</div>' +
        inp('PPN_PERSEN', 'Tarif PPN (%)', '11') +
        '<div class="field"><label>Logo (maks. 1 MB)</label><div style="display:flex;gap:12px;align-items:center"><div class="thumb" id="logo" style="cursor:default"><span>' + icon('image') + '</span></div><button class="btn" id="logoBtn">Unggah logo</button><input type="file" id="logoF" accept="image/*" hidden></div></div>' +
        '<button class="btn pri" id="saveP">Simpan identitas</button></div></div></div></div>' +
        '<div style="display:grid;gap:24px">' +
        '<div class="card"><div class="card-h"><h3>Notifikasi WhatsApp</h3><span class="muted small" id="wst"></span></div><div class="card-b"><div class="row">' +
        ck('NOTIF_WA_AKTIF', '<b>Aktifkan notifikasi WhatsApp</b>', 'Saklar utama. Pesan dikirim lewat antrean (tidak menunda aplikasi).') +
        inp('NOTIF_WA_TUJUAN', 'Nomor tujuan (pisahkan koma)', '081234567890, 0812…') +
        '<div style="display:grid;gap:8px">' + ck('EV_SUBMITTED', 'Item diajukan') + ck('EV_REVISI', 'Perlu revisi') + ck('EV_FINAL', 'Item difinalkan') + ck('EV_LAPORAN', 'Laporan dibuat') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="saveW">Simpan notifikasi</button><button class="btn" id="testW">' + icon('phone', 'sm') + ' Kirim tes</button></div></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Rahasia & keamanan</h3></div><div class="card-b"><div class="row" id="sec"><div class="skel"></div></div><p class="muted small" style="margin-bottom:0">Nilai rahasia disimpan di Script Properties server dan tidak pernah ditampilkan utuh.</p></div></div>' +
        '<div class="card"><div class="card-h"><h3>Migrasi dari spreadsheet lama</h3></div><div class="card-b"><div class="row"><div class="field"><label>Tautan / ID spreadsheet sumber</label><input class="in" id="msrc" placeholder="https://docs.google.com/spreadsheets/d/…"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="mscan">1. Pindai (simulasi)</button><button class="btn pri" id="mrun">2. Jalankan sinkronisasi</button></div><div id="mres" class="small"></div></div></div></div>' +
        '</div></div>';
    },
    async mount(root) {
      const self = this;
      const drawK = () => {
        $('#kt', root).innerHTML = '<table><thead><tr><th>Kode</th><th>Nama</th><th>Status</th><th></th></tr></thead><tbody>' + Store.s.kategori.map(k => '<tr><td>' + esc(k.kode) + '</td><td>' + esc(k.nama) + '</td><td>' + (T(k.aktif) ? '<span class="pill Final">Aktif</span>' : '<span class="pill Draft">Nonaktif</span>') + '</td><td class="r"><button class="btn sm" data-ke="' + esc(k.id) + '">' + icon('edit', 'sm') + '</button></td></tr>').join('') + '</tbody></table>';
      };
      drawK();
      const logoLoad = () => Api.call('logo.get', {}).then(r => { if (r.ada) $('#logo', root).innerHTML = '<img src="data:' + r.mime + ';base64,' + r.base64 + '" alt="Logo">'; }).catch(() => {});
      logoLoad();
      const secDraw = async () => {
        try {
          const s = await Api.call('rahasia.status', {});
          $('#sec', root).innerHTML = Object.keys(s).map(k => '<div class="field"><label>' + esc(s[k].label) + ' ' + (s[k].set ? '<span class="pill Final">terisi</span>' : '<span class="pill Draft">kosong</span>') + '</label><div style="display:flex;gap:8px"><input class="in" type="password" data-sk="' + k + '" placeholder="' + (s[k].set ? esc(s[k].masked) + ' (kosongkan = tidak diubah)' : 'Belum diisi') + '" autocomplete="new-password"><button class="btn" data-ss="' + k + '">Simpan</button></div></div>').join('');
        } catch (e) { $('#sec', root).innerHTML = '<div class="muted">' + esc(e.message) + '</div>'; }
      };
      secDraw();
      Api.call('notif.status', {}).then(r => { $('#wst', root).textContent = 'Antrean: ' + r.hitung.menunggu + ' · terkirim ' + r.hitung.terkirim + ' · gagal ' + r.hitung.gagal; }).catch(() => {});

      const savePeng = async (btn, values) => {
        btnBusy(btn, true);
        try { const r = await Api.call('pengaturan.save', { values }); Store.s.pengaturan = r.pengaturan; Store.touch(); Sync.run(); toast('Tersimpan ✓', 'ok'); }
        catch (e) { toast(e.message, 'err'); } finally { btnBusy(btn, false); }
      };
      root.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.id === 'kadd') return self.kModal();
        if (t.dataset.ke) return self.kModal(Store.s.kategori.find(k => k.id === t.dataset.ke));
        if (t.id === 'saveP') { const v = {}; $$('[data-p]', root).forEach(i => { v[i.dataset.p] = i.value; }); return savePeng(t, v); }
        if (t.id === 'saveW') { const v = {}; $$('[data-ev]', root).forEach(i => { v[i.dataset.ev] = i.checked ? 'TRUE' : 'FALSE'; }); v.NOTIF_WA_TUJUAN = $('[data-p="NOTIF_WA_TUJUAN"]', root).value; return savePeng(t, v); }
        if (t.id === 'testW') {
          const n = ($('[data-p="NOTIF_WA_TUJUAN"]', root).value.split(/[,;\s]+/)[0] || '').trim(); if (!n) return toast('Isi nomor tujuan terlebih dahulu.', 'err');
          btnBusy(t, true); try { await Api.call('notif.test', { tujuan: n }); toast('Pesan tes terkirim ✓', 'ok'); } catch (er) { toast(er.message, 'err'); } btnBusy(t, false); return;
        }
        if (t.id === 'logoBtn') return $('#logoF', root).click();
        if (t.dataset.ss) {
          const k = t.dataset.ss, v = $('[data-sk="' + k + '"]', root).value.trim(); if (!v) return toast('Isi nilainya terlebih dahulu.', 'err');
          btnBusy(t, true); try { await Api.call('rahasia.simpan', { key: k, value: v }); toast('Disimpan aman di server ✓', 'ok'); await secDraw(); } catch (er) { toast(er.message, 'err'); btnBusy(t, false); } return;
        }
        if (t.id === 'mscan' || t.id === 'mrun') {
          const src = $('#msrc', root).value.trim(); if (!src) return toast('Isi tautan spreadsheet sumber.', 'err');
          if (t.id === 'mrun' && !(await confirmBox('Jalankan sinkronisasi? Data sumber tidak diubah; baris yang sama diperbarui (idempoten), baris baru ditambahkan.'))) return;
          btnBusy(t, true, 'Memproses…');
          try {
            const r = await Api.call(t.id === 'mscan' ? 'migrasi.pindai' : 'migrasi.jalankan', { sumber: src }, { timeout: 180000 });
            $('#mres', root).innerHTML = '<div class="bold" style="margin:8px 0">' + (t.id === 'mscan' ? 'Hasil pindai' : 'Selesai') + ': ' + esc(r.sumber) + '</div><table><thead><tr><th>Sheet</th><th class="r">Baru</th><th class="r">Diubah</th><th class="r">Sama</th></tr></thead><tbody>' + Object.keys(r.hasil).map(k => '<tr><td>' + esc(k) + '</td><td class="r">' + r.hasil[k].baru + '</td><td class="r">' + r.hasil[k].ubah + '</td><td class="r">' + r.hasil[k].sama + '</td></tr>').join('') + '</tbody></table>';
            if (t.id === 'mrun') { toast('Migrasi selesai ✓', 'ok'); Sync.run(true); }
          } catch (er) { toast(er.message, 'err'); } btnBusy(t, false);
        }
      });
      $('#logoF', root).onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const c = await compressImage(f, 400, 0.9); await Api.call('logo.upload', { mime: c.mime, base64: c.base64 }); $('#logo', root).innerHTML = '<img src="' + c.preview + '" alt="Logo">'; App.loadLogo(); toast('Logo diperbarui ✓', 'ok'); }
        catch (er) { toast(er.message, 'err'); }
      };
      self.drawK = drawK;
    },
    kModal(k) {
      const self = this;
      openModal({
        title: k ? 'Ubah kategori' : 'Kategori baru',
        body: '<div class="row"><div class="field"><label>Nama</label><input class="in" id="kn" maxlength="80" value="' + esc(k ? k.nama : '') + '"></div><div class="field"><label>Kode (singkat)</label><input class="in" id="kc" maxlength="10" value="' + esc(k ? k.kode : '') + '"></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="chk" id="ka" ' + (!k || T(k.aktif) ? 'checked' : '') + '> Aktif</label></div>',
        footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="ok">Simpan</button>',
        onMount: m => { m.querySelector('#ok').onclick = async ev => {
          btnBusy(ev.target, true);
          try { const r = await Api.call('kategori.save', { id: k && k.id, nama: m.querySelector('#kn').value, kode: m.querySelector('#kc').value, aktif: m.querySelector('#ka').checked }); Store.s.kategori = r.kategori; Store.touch(); closeModal(); if (self.drawK) self.drawK(); Sync.run(); toast('Kategori tersimpan ✓', 'ok'); }
          catch (e) { toast(e.message, 'err'); btnBusy(ev.target, false); }
        }; }
      });
    }
  };

  // =========================================================
  // PENGGUNA & AUDIT (CMS)
  // =========================================================
  const AU = { q: '' };
  Views.users = {
    title: 'Pengguna & Audit Log', live: false, audit: [],
    render() {
      return '<div class="card"><div class="card-h"><h3>Pengguna</h3><button class="btn pri sm" id="uadd">' + icon('plusS', 'sm') + ' Tambah pengguna</button></div><div class="tbl-wrap" id="ut"></div></div>' +
        '<div class="card" style="margin-top:24px"><div class="card-h"><h3>Audit log</h3><input class="in" id="aq" placeholder="Cari aksi / email…" style="width:220px" value="' + esc(AU.q) + '"><button class="btn sm" id="ar">Muat ulang</button></div><div class="tbl-wrap" id="at" style="max-height:480px"><div class="card-b"><div class="skel"></div></div></div></div>';
    },
    async mount(root) {
      const self = this;
      const drawU = () => { $('#ut', root).innerHTML = '<table class="tbl-cards"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>WhatsApp</th><th>Sandi</th><th>Status</th><th></th></tr></thead><tbody>' + Store.s.pengguna.map(u => '<tr><td data-l="Nama" class="bold">' + esc(u.nama) + '</td><td data-l="Email">' + esc(u.email) + '</td><td data-l="Peran">' + esc(u.peran) + '</td><td data-l="WA" class="tn">' + esc(u.noWa || '-') + '</td><td data-l="Sandi">' + (u.adaSandi ? '✓' : '<span class="muted">–</span>') + '</td><td data-l="Status">' + (u.aktif ? '<span class="pill Final">Aktif</span>' : '<span class="pill Draft">Nonaktif</span>') + '</td><td class="nol r"><button class="btn sm" data-ue="' + esc(u.email) + '">' + icon('edit', 'sm') + '</button></td></tr>').join('') + '</tbody></table>'; };
      const drawA = () => {
        const q = AU.q.toLowerCase();
        const rows = self.audit.filter(a => !q || (a.aksi + ' ' + a.email + ' ' + a.detail).toLowerCase().includes(q));
        $('#at', root).innerHTML = rows.length ? '<table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>' + rows.map(a => '<tr><td class="small tn" style="white-space:nowrap">' + fmtWaktu(a.waktu) + '</td><td class="small">' + esc(a.email) + '</td><td><span class="pill Draft">' + esc(a.aksi) + '</span></td><td class="small">' + esc(a.detail) + '</td></tr>').join('') + '</tbody></table>' : emptyState('Tidak ada catatan.');
      };
      const loadA = async () => { try { self.audit = (await Api.call('audit.list', { limit: 300 })).log; drawA(); } catch (e) { toast(e.message, 'err'); } };
      self.drawU = drawU;
      drawU(); loadA();
      Api.call('pengguna.list', {}).then(r => { Store.s.pengguna = r.pengguna; Store.emit(); drawU(); }).catch(() => {});
      $('#aq', root).oninput = debounce(e => { AU.q = e.target.value; drawA(); }, 120);
      root.addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.id === 'uadd') self.uModal();
        if (t.dataset.ue) self.uModal(Store.s.pengguna.find(u => u.email === t.dataset.ue));
        if (t.id === 'ar') loadA();
      });
    },
    uModal(u) {
      const self = this;
      openModal({
        title: u ? 'Ubah pengguna' : 'Pengguna baru',
        body: '<div class="row"><div class="field"><label>Email Google</label><input class="in" id="ue" type="email" value="' + esc(u ? u.email : '') + '" ' + (u ? 'readonly' : '') + '></div><div class="field"><label>Nama</label><input class="in" id="un" maxlength="80" value="' + esc(u ? u.nama : '') + '"></div>' +
          '<div class="row r2"><div class="field"><label>Peran</label><select class="in" id="up"><option ' + (u && u.peran === 'Admin HRGA' || !u ? 'selected' : '') + '>Admin HRGA</option><option ' + (u && u.peran === 'Administrator CMS' ? 'selected' : '') + '>Administrator CMS</option></select></div>' +
          '<div class="field"><label>WhatsApp</label><input class="in" id="uw" inputmode="tel" placeholder="0812…" value="' + esc(u ? u.noWa : '') + '"></div></div>' +
          '<div class="field"><label>Sandi login manual ' + (u && u.adaSandi ? '<span class="pill Final">sudah diatur</span>' : '<span class="pill Draft">belum diatur</span>') + '</label><input class="in" id="us" type="password" autocomplete="new-password" placeholder="' + (u ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter (opsional bila hanya pakai Google)') + '"></div>' +
          '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="chk" id="ua" ' + (!u || u.aktif ? 'checked' : '') + '> Akun aktif</label></div>',
        footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="ok">Simpan</button>',
        onMount: m => { m.querySelector('#ok').onclick = async ev => {
          btnBusy(ev.target, true);
          try { const r = await Api.call('pengguna.save', { email: m.querySelector('#ue').value, nama: m.querySelector('#un').value, peran: m.querySelector('#up').value, noWa: m.querySelector('#uw').value, sandi: m.querySelector('#us').value, aktif: m.querySelector('#ua').checked }); Store.s.pengguna = r.pengguna; Store.emit(); closeModal(); self.drawU(); toast('Pengguna tersimpan ✓', 'ok'); }
          catch (e) { toast(e.message, 'err'); btnBusy(ev.target, false); }
        }; }
      });
    }
  };
})();
