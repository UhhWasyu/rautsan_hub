/**
 * export.js — Generate file statis untuk GitHub Pages
 * Jalankan perintah: node export.js
 * ─────────────────────────────────────────────────
 * Script ini akan:
 *   1. Copy semua file halaman (public/) ke folder docs/
 *   2. Copy semua foto (uploads/) ke docs/uploads/
 *   3. Buat 1 file data.json berisi semua data produk & profil
 *
 * Folder docs/ yang dihasilkan inilah yang di-push ke GitHub.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR  = path.join(__dirname, 'public');
const DOCS_DIR    = path.join(__dirname, 'docs');

// ── Utilitas ─────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(item => {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  });
}

function listProducts(type) {
  const dir = path.join(UPLOADS_DIR, 'products', type);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(id => {
      const p = path.join(dir, id);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'info.json'));
    })
    .map(id => {
      const productDir = path.join(dir, id);
      const info  = JSON.parse(fs.readFileSync(path.join(productDir, 'info.json'), 'utf8'));
      const files = fs.readdirSync(productDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      const images = files.map(f => `/uploads/products/${type}/${id}/${f}`);
      const coverFile = files.find(f => /^cover\./i.test(f)) || files[0];
      const coverUrl  = coverFile ? `/uploads/products/${type}/${id}/${coverFile}` : '';
      return { id, ...info, coverUrl, images };
    });
}

// ── Mulai Export ──────────────────────────────────────────────────────────────

console.log('\n🚀 Mulai export ke GitHub Pages...\n');

// 1. Bersihkan & buat ulang folder docs/
console.log('🗑️  Bersihkan folder docs/ lama...');
if (fs.existsSync(DOCS_DIR)) fs.rmSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR);

// 2. Copy public/ → docs/
console.log('📋 Copy file halaman (HTML, CSS, JS, gambar)...');
copyDir(PUBLIC_DIR, DOCS_DIR);

// 3. Copy uploads/ → docs/uploads/
console.log('🖼️  Copy semua foto produk & profil...');
copyDir(UPLOADS_DIR, path.join(DOCS_DIR, 'uploads'));

// 4. Build data.json
console.log('📦 Generate data.json dari semua data...');

const profileRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'profile.json'), 'utf8'));
const linksRaw   = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'links.json'),   'utf8'));

// Validasi file foto profil benar-benar ada
const profile = { ...profileRaw };
profile.profileImageUrl = (profile.profileImage && fs.existsSync(path.join(UPLOADS_DIR, profile.profileImage)))
  ? '/uploads/' + profile.profileImage : '';
profile.coverImageUrl   = (profile.coverImage && fs.existsSync(path.join(UPLOADS_DIR, profile.coverImage)))
  ? '/uploads/' + profile.coverImage : '';

// Links dengan icon URL
const links = linksRaw.map(l => ({ ...l, iconUrl: l.icon ? '/uploads/' + l.icon : '' }));

const snacks    = listProducts('snacks');
const affiliate = listProducts('affiliate');

const data = {
  profile,
  links,
  snacks,
  affiliate,
  generatedAt: new Date().toISOString()
};

fs.writeFileSync(path.join(DOCS_DIR, 'data.json'), JSON.stringify(data, null, 2));

// 5. .nojekyll — wajib ada agar GitHub Pages tidak skip folder yang berawalan titik
fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');

// ── Laporan ───────────────────────────────────────────────────────────────────

console.log('\n✅ Export selesai! Folder "docs/" siap di-push ke GitHub.\n');
console.log('📊 Ringkasan konten:');
console.log('   👤 Profil       :', profile.name);
console.log('   🍪 Snacks       :', snacks.length,    'produk');
console.log('   🛒 Affiliate    :', affiliate.length,  'produk');
console.log('   🔗 Links        :', links.length,      'link');
console.log('   📅 Dibuat pada  :', new Date().toLocaleString('id-ID'));
console.log('\nLangkah selanjutnya (jalankan 1 per 1 di terminal):');
console.log('   git add docs/');
console.log('   git commit -m "Update website"');
console.log('   git push');
console.log('\nAtau jalankan semuanya sekaligus dengan:');
console.log('   node deploy.js\n');
