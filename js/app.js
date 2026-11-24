/** app.js — Router hash, shell (sidebar / bottom-nav), boot, PWA, sesi. */
(function () {
  const ROUTES = {
    'dashboard': { v: 'dashboard', t: 'Dashboard', i: 'dashboard' },
    'expense-input': { v: 'input', t: 'Input Pengeluaran', i: 'plus' },
    'item-list': { v: 'items', t: 'Daftar Item', i: 'list' },
    'revision-center': { v: 'revisions', t: 'Pusat Revisi', i: 'revisi' },
    'reports': { v: 'reports', t: 'Laporan', i: 'file' },
    'report-templates': { v: 'templates', t: 'Template Laporan', i: 'template', cms: true },
    'categories-and-settings': { v: 'settings', t: 'Kategori & Pengaturan', i: 'settings', cms: true },
    'users-and-audit-log': { v: 'users', t: 'Pengguna & Audit', i: 'users', cms: true }
  };
  const MAIN_NAV = ['dashboard', 'expense-input', 'item-list', 'revision-center', 'reports'];
  const CMS_NAV = ['report-templates', 'categories-and-settings', 'users-and-audit-log'];
  const BOTTOM = [['dashboard', 'Home', 'home'], ['expense-input', 'Input', 'plus'], ['item-list', 'Item', 'list'], ['revision-center', 'Revisi', 'revisi'], ['reports', 'Laporan', 'file']];

  const App = window.App = {
    key: null, view: null, root: null, loginMsg: '', failed: null, installEvt: null, raf: 0,

    boot() {
      Api.onAuthLost = () => { if (Api.token) { App.loginMsg = 'Sesi berakhir atau akses dicabut. Silakan masuk kembali.'; App.logout(true); } };
      window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.installEvt = e; const b = $('#install'); if (b) b.classList.remove('hidden'); });
      window.addEventListener('hrga:fatal', e => { const c = $('#content'); if (c) c.insertAdjacentHTML('afterbegin', '<div class="banner">' + icon('alert') + '<div><b>Server belum siap.</b> ' + esc(e.detail) + '</div></div>'); });
      window.addEventListener('hashchange', () => App.renderRoute());
      if ('serviceWorker' in navigator) {
        const had = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('sw.js').catch(() => {});
        // versi baru aktif → muat ulang sekali agar tampilan/skrip selalu sinkron
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !window.__rl) { window.__rl = 1; location.reload(); } });
      }
      if (!Api.token || !Api.user) return App.showLogin();
      App.startSession();
    },

    showLogin() {
      Sync.stop(); document.body.classList.remove('drawer');
      const app = $('#app'); app.className = 'is-login'; app.innerHTML = '';
      const root = document.createElement('div'); root.style.width = '100%'; root.innerHTML = Views.login.render(); app.appendChild(root);
      Views.login.mount(root);
    },

    onLogin(session) {
      Api.setSession(session.token, session.user);
      location.hash = '#/dashboard';
      App.startSession();
    },

    startSession() {
      Store.hydrate();
      App.buildShell();
      App.renderRoute();
      Sync.run(); Sync.start();
      App.loadLogo();
      Store.on(App.onStore);
    },

    async logout(silent) {
      if (!silent) { try { await Api.call('auth.logout', {}); } catch (e) { /* abaikan */ } }
      Store.subs.clear(); Store.reset(); Api.clearSession(); Photos.mem.clear();
      LS.del('hrga.logo'); location.hash = '';
      App.showLogin();
    },

    buildShell() {
      const u = Api.user, cms = u.peran === 'Administrator CMS';
      const link = k => { const r = ROUTES[k]; return '<a data-nav="' + k + '" href="#/' + k + '">' + icon(r.i) + '<span>' + r.t + '</span><span class="badge hidden" data-b="' + k + '"></span></a>'; };
      const app = $('#app'); app.className = '';
      app.innerHTML =
        '<aside class="sidebar" id="side"><div class="brand"><div class="logo" id="blogo">' + icon('wallet') + '</div><div>' + esc(APP_CONFIG.APP_NAME) + '<small>Admin HRGA</small></div></div>' +
        '<nav class="nav"><div class="grp">Menu</div>' + MAIN_NAV.map(link).join('') + (cms ? '<div class="grp">CMS</div>' + CMS_NAV.map(link).join('') : '') + '</nav>' +
        '<div class="side-foot"><div class="who">' + esc(u.nama) + '</div><div style="color:#94a3b8">' + esc(u.peran) + '</div><button class="btn sm hidden" id="install">' + icon('download', 'sm') + ' Pasang aplikasi</button><button class="btn sm" id="out">' + icon('logout', 'sm') + ' Keluar</button></div></aside>' +
        '<div class="scrim" id="scrim"></div>' +
        '<div class="main"><header class="topbar"><button class="btn ghost menu-btn" id="menu" aria-label="Menu">' + icon('menu') + '</button><h1 id="ttl"></h1><div class="tb-right"><span class="chip" id="period" title="Periode aktif">' + icon('home', 'sm') + ' <span></span></span>' +
        '<a class="btn pri sm" id="qa" href="#/expense-input" title="Input pengeluaran baru">' + icon('plusS', 'sm') + '<span class="qa-t">Input Pengeluaran</span></a>' +
        '<button class="btn bell" id="bell" aria-label="Notifikasi">' + icon('bell') + '<span class="nb hidden" id="nb"></span></button>' +
        '<span class="sync-lbl" id="synl"></span><span id="syn" class="sync-dot" title="Status sinkronisasi"></span></div></header>' +
        '<main class="content" id="content"></main></div>' +
        '<nav class="bottom-nav">' + BOTTOM.map(b => '<a data-nav="' + b[0] + '" href="#/' + b[0] + '">' + icon(b[2]) + '<span>' + b[1] + '</span><span class="badge hidden" data-b="' + b[0] + '"></span></a>').join('') + '</nav>';
      $('#out').onclick = () => App.logout();
      $('#menu').onclick = () => document.body.classList.add('drawer');
      $('#scrim').onclick = () => document.body.classList.remove('drawer');
      $('#install').onclick = async () => { if (App.installEvt) { App.installEvt.prompt(); await App.installEvt.userChoice; App.installEvt = null; $('#install').classList.add('hidden'); } };
      if (App.installEvt) $('#install').classList.remove('hidden');
      { const n = new Date(); $('#period span').textContent = BLN[n.getMonth()] + ' ' + n.getFullYear(); }
      $('#bell').onclick = () => {
        const S = Store.s, sub = S.items.filter(i => i.status === 'Submitted').length, rev = S.revisi.filter(r => r.status === 'Open').length, fin = S.items.filter(i => i.status === 'Final' && !i.laporanId).length;
        const go = h => () => { location.hash = h; };
        const list = [];
        if (sub) list.push({ label: sub + ' item menunggu difinalkan', icon: 'check', run: go('#/item-list?status=Submitted') });
        if (rev) list.push({ label: rev + ' catatan revisi perlu tindakan', icon: 'alert', run: go('#/revision-center') });
        if (fin) list.push({ label: fin + ' item Final belum dicetak', icon: 'file', run: go('#/reports') });
        if (!list.length) list.push({ label: 'Tidak ada notifikasi baru', icon: 'check', disabled: true, run: () => {} });
        openMenu($('#bell'), list);
      };
      Sync.listeners.clear();
      Sync.listeners.add(s => { const l = $('#synl'); if (l) l.textContent = { busy: 'Menyinkronkan…', ok: '', off: 'Offline', err: 'Gagal sinkron' }[s] || ''; });
      Sync.listeners.add(s => { const d = $('#syn'); if (d) { d.className = 'sync-dot' + (s === 'busy' ? ' busy' : (s === 'off' || s === 'err' ? ' off' : '')); d.title = { busy: 'Menyinkronkan…', ok: 'Tersinkron', off: 'Offline — memakai data tersimpan', err: 'Gagal sinkron' }[s] || ''; } });
      const logo = LS.get('hrga.logo'); if (logo) App.setLogo(logo);
      App.updateNav();
    },

    setLogo(src) { const l = $('#blogo'); if (l) l.innerHTML = '<img src="' + src + '" alt="Logo">'; },
    async loadLogo() {
      try { const r = await Api.call('logo.get', {}); if (r.ada) { const src = 'data:' + r.mime + ';base64,' + r.base64; App.setLogo(src); if (src.length < 300000) LS.set('hrga.logo', src); } } catch (e) { /* abaikan */ }
    },

    updateNav() {
      const S = Store.s;
      const cnt = {
        'item-list': S.items.filter(i => i.status === 'Submitted').length,
        'revision-center': S.revisi.filter(r => r.status === 'Open').length
      };
      { const nb = $('#nb'); if (nb) { const n = cnt['item-list'] + cnt['revision-center']; nb.textContent = n > 99 ? '99+' : n; nb.classList.toggle('hidden', !n); } }
      $$('[data-b]').forEach(b => { const n = cnt[b.dataset.b] || 0; b.textContent = n; b.classList.toggle('hidden', !n); if (b.dataset.b === 'item-list') b.classList.add('amber'); });
    },

    parse() {
      const h = location.hash.replace(/^#\/?/, ''); const [name, qs] = h.split('?');
      const q = {}; (qs || '').split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
      return { name: name || 'dashboard', q };
    },

    renderRoute() {
      if (!Api.token || !$('#content')) return;
      document.body.classList.remove('drawer');
      const ctx = App.parse(); let r = ROUTES[ctx.name];
      if (!r) { location.replace('#/dashboard'); return; }
      if (r.cms && Api.user.peran !== 'Administrator CMS') { toast('Menu ini khusus Administrator CMS.', 'err'); location.replace('#/dashboard'); return; }
      App.key = ctx.name; App.ctx = ctx; App.view = Views[r.v];
      $('#ttl').textContent = r.t; document.title = r.t + ' · ' + APP_CONFIG.APP_NAME;
      $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === ctx.name));
      { const qa = $('#qa'); if (qa) qa.classList.toggle('hidden', ctx.name === 'expense-input'); }
      App.draw(true);
    },

    draw(scrollTop) {
      const c = $('#content'); if (!c || !App.view) return;
      const root = document.createElement('div'); root.className = 'view';
      if (!Store.hydrated) {
        root.innerHTML = '<div class="grid g4"><div class="card kpi"><div class="skel"></div></div><div class="card kpi"><div class="skel"></div></div><div class="card kpi"><div class="skel"></div></div><div class="card kpi"><div class="skel"></div></div></div>';
        c.replaceChildren(root); App.root = root;
        const wait = Store.on(() => { wait(); if (App.root === root) App.draw(); });
        return;
      }
      // pertahankan posisi scroll & fokus ketika segarkan karena sinkron
      const y = scrollTop ? 0 : window.scrollY;
      root.innerHTML = App.view.render(App.ctx);
      c.replaceChildren(root); App.root = root;
      if (App.view.mount) App.view.mount(root, App.ctx);
      window.scrollTo(0, y);
    },

    rerender() { App.draw(false); },

    onStore() {
      App.updateNav();
      const v = App.view; if (!v || !App.root) return;
      if (v.onStore) return v.onStore(App.root);
      if (v.live === false) return;
      cancelAnimationFrame(App.raf);
      App.raf = requestAnimationFrame(() => { if (!$('#modal')) App.draw(false); });
    }
  };

  document.addEventListener('DOMContentLoaded', () => App.boot());
})();
