/** ui.js — helper tampilan: ikon SVG inline, format, toast, modal, kalkulasi pajak (identik dengan server). */
(function () {
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    plus: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    check: '<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/>',
    revisi: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    template: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    left: '<polyline points="15 18 9 12 15 6"/>', right: '<polyline points="9 18 15 12 9 6"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    plusS: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    key: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'
  };
  window.icon = (n, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

  window.esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.$ = (s, r) => (r || document).querySelector(s);
  window.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  window.rp = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  window.BLN = BLN;
  window.fmtTgl = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + BLN[+m[2] - 1] + ' ' + m[1] : (iso || '-'); };
  window.fmtTglEn = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); const E = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m ? (+m[3]) + '-' + E[+m[2] - 1] + '-' + m[1].slice(2) : (iso || ''); };
  window.fmtWaktu = iso => { const d = new Date(iso); return isNaN(d) ? (iso || '') : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  window.today = () => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  window.pill = s => '<span class="pill ' + esc(s) + '">' + esc(s) + '</span>';
  window.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 150); }; };

  /** Kalkulasi pajak — IDENTIK dengan calcTax_ di backend. */
  window.calcTax = function (qty, harga, mode, rate) {
    const gross = Math.round((Number(qty) || 0) * (Number(harga) || 0));
    let subtotal, ppn, total;
    if (mode === 'Include') { total = gross; subtotal = Math.round(total / (1 + rate)); ppn = total - subtotal; }
    else if (mode === 'Exclude') { subtotal = gross; ppn = Math.round(subtotal * rate); total = subtotal + ppn; }
    else { subtotal = gross; ppn = 0; total = gross; }
    return { subtotal, ppn, total };
  };

  // Toast
  window.toast = function (msg, type, ms) {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<div style="flex:1">' + esc(msg) + '</div>';
    box.appendChild(el);
    setTimeout(() => el.remove(), ms || (type === 'err' ? 6000 : 3200));
    return el;
  };

  // Modal
  let modalCleanup = null;
  window.openModal = function (opt) {
    closeModal();
    const back = document.createElement('div');
    back.className = 'modal-back'; back.id = 'modal';
    back.innerHTML = '<div class="modal ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><span>' + esc(opt.title || '') + '</span><button class="btn ghost sm" data-close aria-label="Tutup">' + icon('x') + '</button></div>' +
      '<div class="modal-b">' + (opt.body || '') + '</div>' +
      (opt.footer ? '<div class="modal-f">' + opt.footer + '</div>' : '') + '</div>';
    document.body.appendChild(back);
    back.addEventListener('mousedown', e => { if (e.target === back) closeModal(); });
    back.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
    const onKey = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    modalCleanup = () => document.removeEventListener('keydown', onKey);
    if (opt.onMount) opt.onMount(back);
    const first = back.querySelector('input,select,textarea'); if (first && !opt.noFocus) first.focus();
    return back;
  };
  window.closeModal = function () {
    const m = $('#modal'); if (m) m.remove();
    if (modalCleanup) { modalCleanup(); modalCleanup = null; }
  };
  window.confirmBox = function (msg, okLabel, danger) {
    return new Promise(res => {
      openModal({
        title: 'Konfirmasi', body: '<p style="margin:0">' + esc(msg) + '</p>',
        footer: '<button class="btn" data-close>Batal</button><button class="btn ' + (danger ? 'dng' : 'pri') + '" id="cf-ok">' + esc(okLabel || 'Ya, lanjutkan') + '</button>',
        noFocus: true,
        onMount: m => {
          m.querySelector('#cf-ok').onclick = () => { closeModal(); res(true); };
          m.querySelector('[data-close]').addEventListener('click', () => res(false));
          m.addEventListener('mousedown', e => { if (e.target === m) res(false); });
        }
      });
    });
  };

  window.download = function (name, mime, base64) {
    const bin = atob(base64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  window.btnBusy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Memproses…'; }
    else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; }
  };

  // Menu popover kecil (aksi tambahan per baris)
  window.openMenu = function (anchor, items) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'popmenu'; m.id = 'popmenu';
    m.innerHTML = items.map((it, i) => '<button class="pm-i" data-i="' + i + '" ' + (it.disabled ? 'disabled' : '') + '>' + (it.icon ? icon(it.icon, 'sm') : '') + '<span>' + esc(it.label) + '</span></button>').join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    m.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
    m.addEventListener('click', e => { const b = e.target.closest('.pm-i'); if (!b || b.disabled) return; closeMenu(); items[+b.dataset.i].run(); });
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', esc2); window.addEventListener('scroll', closeMenu, true); }, 0);
    function outside(e) { if (!m.contains(e.target)) closeMenu(); }
    function esc2(e) { if (e.key === 'Escape') closeMenu(); }
    m._off = () => { document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc2); window.removeEventListener('scroll', closeMenu, true); };
  };
  window.closeMenu = function () { const m = document.getElementById('popmenu'); if (m) { if (m._off) m._off(); m.remove(); } };
})();
