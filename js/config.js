/**
 * Konfigurasi frontend — satu-satunya berkas yang perlu Anda ubah setelah deploy backend.
 * JANGAN menaruh token/API key/sandi di sini (berkas ini publik). Semua rahasia ada di
 * Script Properties pada backend.
 */
window.APP_CONFIG = {
  // Tempel URL Web App Google Apps Script (berakhiran /exec)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbw_uAMqJdKZT449TmAmQnP4kqD4A6IYOZnnA0kf2Z4D1GNg_5Gd7XEF21xKjB-Sg4dm/exec',
  // Opsional: Google OAuth Client ID (publik). Jika kosong, diambil dari server (Script Properties).
  GOOGLE_CLIENT_ID: '',
  APP_NAME: 'HRGA Smart Expense'
};
