/**
 * api.js — Lapisan API + Store lokal + Sinkronisasi (SWR, dedup, epoch tulis, polling adaptif).
 * Prinsip "tanpa delay": UI selalu dirender dari Store lokal (instan); jaringan hanya menyegarkan.
 */
(function () {
  const CFG = window.APP_CONFIG;
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* penuh/diblokir */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };

  // ---------------- Api ----------------
  const Api = {
    token: LS.get('hrga.token') || '',
    user: (function () { try { return JSON.parse(LS.get('hrga.user') || 'null'); } catch (e) { return null; } })(),
    online: navigator.onLine !== false,
    onAuthLost: null,
    onSlow: null,

    setSession(token, user) {
      this.token = token; this.user = user;
      LS.set('hrga.token', token); LS.set('hrga.user', JSON.stringify(user));
    },
    clearSession() {
      this.token = ''; this.user = null;
      LS.del('hrga.token'); LS.del('hrga.user');
    },

    /** Panggil 1 aksi. opts: {retry:n, timeout:ms} */
    async call(action, data, opts) {
      opts = opts || {};
      const tries = (opts.retry || 0) + 1;
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          return await this._once(action, data, opts.timeout);
        } catch (e) {
          lastErr = e;
          if (!e.network || i === tries - 1) break;
          await new Promise(r => setTimeout(r, 600 * (i + 1)));
        }
      }
      throw lastErr;
    },

    async _once(action, data, timeout) {
      if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) {
        const e = new Error('GAS_URL belum diatur di js/config.js'); e.code = 'CONFIG'; throw e;
      }
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout || 60000);
      let resp;
      try {
        resp = await fetch(CFG.GAS_URL, {
          method: 'POST',
          // text/plain → "simple request": tanpa preflight CORS (GAS tidak mendukung OPTIONS)
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, token: this.token, data: data || {} }),
          signal: ctl.signal, redirect: 'follow'
        });
      } catch (err) {
        const e = new Error(ctl.signal.aborted ? 'Server lambat merespons. Coba lagi.' : 'Tidak ada koneksi ke server.');
        e.network = true; e.code = 'NETWORK'; throw e;
      } finally { clearTimeout(timer); }
      let json;
      try { json = await resp.json(); } catch (err) {
        const e = new Error('Respons server tidak valid.'); e.code = 'BADRESP'; e.network = true; throw e;
      }
      if (!json.success) {
        const e = new Error(json.message || 'Terjadi kesalahan.'); e.code = json.code || 'ERROR';
        if (e.code === 'AUTH' && this.onAuthLost) this.onAuthLost();
        throw e;
      }
      if (json.ms > 5000 && this.onSlow) this.onSlow(json.ms);
      return json.data;
    },

    /** Gabungkan beberapa pembacaan dalam 1 request. calls: [{action,data}] */
    async batch(calls) {
      const res = await this._once('batch', { calls }, 60000);
      return res.map(r => {
        if (r.success) return r.data;
        const e = new Error(r.message); e.code = r.code; throw e;
      });
    },

    async publicGet(action) {
      const r = await fetch(CFG.GAS_URL + '?action=' + encodeURIComponent(action), { redirect: 'follow' });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'Gagal');
      return j.data;
    }
  };

  // ---------------- Store ----------------
  const EMPTY = () => ({ items: [], revisi: [], laporan: [], kategori: [], pengaturan: {}, pengguna: [], templates: [], ver: { data: '', cms: '' } });
  const Store = {
    s: EMPTY(), subs: new Set(), epoch: 0, _t: null, hydrated: false,

    key() { return 'hrga.store.v1.' + (Api.user ? Api.user.email : '_'); },
    hydrate() {
      try { const j = JSON.parse(LS.get(this.key()) || 'null'); if (j) { this.s = Object.assign(EMPTY(), j); this.hydrated = true; } }
      catch (e) { this.s = EMPTY(); }
    },
    persist() {
      clearTimeout(this._t);
      this._t = setTimeout(() => LS.set(this.key(), JSON.stringify(this.s)), 400);
    },
    reset() { this.s = EMPTY(); this.hydrated = false; LS.del(this.key()); },
    on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
    emit() { this.subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); this.persist(); },

    merge(res) {
      if (res.data) { this.s.items = res.data.items || []; this.s.revisi = res.data.revisi || []; this.s.laporan = res.data.laporan || []; }
      if (res.cms) {
        this.s.kategori = res.cms.kategori || [];
        this.s.pengaturan = res.cms.pengaturan || {};
        if (res.cms.templates) this.s.templates = res.cms.templates;
        if (res.cms.pengguna) this.s.pengguna = res.cms.pengguna;
      }
      this.s.ver = res.ver;
      this.hydrated = true;
      this.emit();
    },

    // pembaruan optimis lokal
    touch() { this.epoch++; this.emit(); },
    item(id) { return this.s.items.find(i => i.id === id); },
    upsertItem(it) {
      const i = this.s.items.findIndex(x => x.id === it.id);
      if (i >= 0) this.s.items[i] = it; else this.s.items.unshift(it);
      this.touch();
    },
    removeItem(id) { this.s.items = this.s.items.filter(i => i.id !== id); this.touch(); },
    ppnRate() { const r = Number(this.s.pengaturan.PPN_PERSEN); return (isFinite(r) && r >= 0 ? r : 11) / 100; }
  };

  // ---------------- Sync ----------------
  const Sync = {
    inflight: null, again: false, status: 'idle', lastRun: 0, lastActive: Date.now(), timer: null,
    listeners: new Set(),
    setStatus(s) { this.status = s; this.listeners.forEach(f => f(s)); },

    run(force) {
      if (!Api.token) return Promise.resolve();
      if (this.inflight) { this.again = true; return this.inflight; }
      const startEpoch = Store.epoch;
      this.setStatus('busy');
      this.inflight = Api.call('sync', { ver: force ? {} : Store.s.ver }, { retry: 1 })
        .then(res => {
          if (Store.epoch !== startEpoch && (res.data || res.cms)) { this.again = true; return; } // ada tulis optimis di tengah jalan
          Store.merge(res);
          this.lastRun = Date.now();
          this.setStatus('ok');
        })
        .catch(e => {
          this.setStatus(e.network ? 'off' : 'err');
          if (e.code === 'SETUP' || e.code === 'CONFIG') window.dispatchEvent(new CustomEvent('hrga:fatal', { detail: e.message }));
        })
        .finally(() => {
          this.inflight = null;
          if (this.again) { this.again = false; setTimeout(() => this.run(), 50); }
        });
      return this.inflight;
    },

    // polling adaptif: aktif 20 dtk, idle 60 dtk, berhenti saat tab tersembunyi
    start() {
      this.stop();
      const tick = () => {
        if (!document.hidden && navigator.onLine !== false) this.run();
        const idle = Date.now() - this.lastActive > 120000;
        this.timer = setTimeout(tick, idle ? 60000 : 20000);
      };
      this.timer = setTimeout(tick, 20000);
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { this.lastActive = Date.now(); }, { passive: true }));
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - this.lastRun > 5000) this.run(); });
      window.addEventListener('online', () => { Api.online = true; this.run(); });
      window.addEventListener('offline', () => { Api.online = false; this.setStatus('off'); });
    },
    stop() { clearTimeout(this.timer); }
  };

  // ---------------- Foto (cache memori + dedup) ----------------
  const Photos = {
    mem: new Map(), inflight: new Map(),
    get(fileId) {
      if (this.mem.has(fileId)) return Promise.resolve(this.mem.get(fileId));
      if (this.inflight.has(fileId)) return this.inflight.get(fileId);
      const p = Api.call('foto.get', { fileId }, { retry: 1 }).then(r => {
        const url = 'data:' + r.mime + ';base64,' + r.base64;
        this.mem.set(fileId, url); this.inflight.delete(fileId); return url;
      }).catch(e => { this.inflight.delete(fileId); throw e; });
      this.inflight.set(fileId, p);
      return p;
    },
    prefetch(ids) { (ids || []).forEach(id => this.get(id).catch(() => {})); }
  };

  /** Kompres gambar sisi-klien: maks 1280px, JPEG 0.75 → hemat kuota & cepat. */
  async function compressImage(file, maxSide, q) {
    maxSide = maxSide || 1280; q = q || 0.75;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const sc = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg', q);
      return { mime: 'image/jpeg', base64: dataUrl.split(',')[1], preview: dataUrl, name: file.name };
    } finally { URL.revokeObjectURL(url); }
  }

  window.Api = Api; window.Store = Store; window.Sync = Sync; window.Photos = Photos; window.compressImage = compressImage; window.LS = LS;
})();
