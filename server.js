const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure dirs exist
[DATA_DIR,
 UPLOADS_DIR, path.join(UPLOADS_DIR, 'profile'), path.join(UPLOADS_DIR, 'cover'),
 path.join(UPLOADS_DIR, 'icons'),
 path.join(UPLOADS_DIR, 'products'), path.join(UPLOADS_DIR, 'products', 'snacks'), path.join(UPLOADS_DIR, 'products', 'affiliate')
].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// === MIGRATION: pindahkan produk lama dari data/products/ ke uploads/products/ ===
// Struktur baru: 1 produk = 1 folder (info.json + foto semuanya di uploads/products/{type}/{id}/)
;['snacks', 'affiliate'].forEach(type => {
  const oldDir = path.join(DATA_DIR, 'products', type);
  const newDir = path.join(UPLOADS_DIR, 'products', type);
  if (!fs.existsSync(oldDir)) return;
  fs.readdirSync(oldDir).forEach(id => {
    const oldProductDir = path.join(oldDir, id);
    if (!fs.statSync(oldProductDir).isDirectory()) return;
    const oldInfo = path.join(oldProductDir, 'info.json');
    const newProductDir = path.join(newDir, id);
    if (fs.existsSync(oldInfo) && !fs.existsSync(path.join(newProductDir, 'info.json'))) {
      fs.mkdirSync(newProductDir, { recursive: true });
      fs.copyFileSync(oldInfo, path.join(newProductDir, 'info.json'));
      console.log('[Migration] Pindah produk:', type, id);
    }
    // Hapus folder lama setelah migrasi
    try { fs.rmSync(oldProductDir, { recursive: true }); } catch(e) {}
  });
});
// === END MIGRATION ===

// Auth file - default admin123! / admin123!
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
if (!fs.existsSync(AUTH_FILE)) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ username: 'admin', password: 'admin123!' }, null, 2));
}

function getAuth() {
  return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
}
function setAuth(obj) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(obj, null, 2));
}

// Default profile
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
if (!fs.existsSync(PROFILE_FILE)) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify({
    name: 'Rautsan',
    bio: 'Selamat datang di halaman saya. Donasi untuk dukung konten!',
    donateLink: 'https://saweria.co/placeholder',
    whatsapp: '6281234567890',
    profileImage: '',
    coverImage: ''
  }, null, 2));
}

// Default links (3 sosmed)
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
if (!fs.existsSync(LINKS_FILE)) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify([
    { id: '1', name: 'YouTube', url: 'https://youtube.com', icon: '' },
    { id: '2', name: 'TikTok', url: 'https://tiktok.com', icon: '' },
    { id: '3', name: 'Instagram', url: 'https://instagram.com', icon: '' }
  ], null, 2));
}

// Telemetry
const TELEMETRY_FILE = path.join(DATA_DIR, 'telemetry.json');
if (!fs.existsSync(TELEMETRY_FILE)) {
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify({ visits: 0, productViews: {} }, null, 2));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'rautsan-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer: profile (1 file, replace)
// Gunakan timestamp agar nama file selalu unik & browser cache tidak stale
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'profile');
    // Hapus semua file lama di folder profile sebelum menyimpan yang baru
    // (solusi Windows-safe: multer tidak bisa overwrite file yang locked)
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch(e) {}
      });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Nama file dengan timestamp agar URL berubah setiap upload (bust cache)
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'profile_' + Date.now() + ext);
  }
});
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'cover');
    // Hapus file cover lama sebelum simpan baru
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch(e) {}
      });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'cover_' + Date.now() + ext);
  }
});
const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, 'icons')),
  filename: (req, file, cb) => cb(null, (req.body.id || Date.now()) + (path.extname(file.originalname) || '.png'))
});
const iconLinkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, 'icons')),
  filename: (req, file, cb) => cb(null, req.params.id + (path.extname(file.originalname) || '.png'))
});
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req.params.id || req.body.productId;
    const type = req.params.type || 'snacks';
    const dir = path.join(UPLOADS_DIR, 'products', type, id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = file.fieldname === 'cover' ? 'cover' : 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    cb(null, base + ext);
  }
});

const uploadProfile = multer({ storage: profileStorage }).single('profile');
const uploadCover = multer({ storage: coverStorage }).single('cover');
const uploadIcon = multer({ storage: iconStorage }).single('icon');
const uploadLinkIcon = multer({ storage: iconLinkStorage }).single('icon');
const uploadProduct = multer({ storage: productStorage }).fields([
  { name: 'cover', maxCount: 1 },
  { name: 'photos', maxCount: 4 }
]);

// Clear old profile/cover on new upload
function clearDir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
  }
}

// ----- Static
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ----- Telemetry (public)
app.post('/api/telemetry/visit', (req, res) => {
  const t = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
  t.visits = (t.visits || 0) + 1;
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(t, null, 2));
  res.json({ ok: true });
});

app.post('/api/telemetry/product-view', (req, res) => {
  const { productId, type } = req.body;
  const t = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
  if (!t.productViews) t.productViews = {};
  const key = (type || 'snacks') + '_' + productId;
  t.productViews[key] = (t.productViews[key] || 0) + 1;
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(t, null, 2));
  res.json({ ok: true });
});

// ----- Public API (landing)
app.get('/api/profile', (req, res) => {
  const p = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  // Verifikasi file fisik benar-benar ada sebelum return URL-nya
  if (p.profileImage) {
    const profilePath = path.join(UPLOADS_DIR, p.profileImage);
    p.profileImageUrl = fs.existsSync(profilePath) ? '/uploads/' + p.profileImage : '';
    if (!fs.existsSync(profilePath)) p.profileImage = ''; // reset jika file hilang
  } else {
    p.profileImageUrl = '';
  }
  if (p.coverImage) {
    const coverPath = path.join(UPLOADS_DIR, p.coverImage);
    p.coverImageUrl = fs.existsSync(coverPath) ? '/uploads/' + p.coverImage : '';
    if (!fs.existsSync(coverPath)) p.coverImage = '';
  } else {
    p.coverImageUrl = '';
  }
  res.json(p);
});

app.get('/api/links', (req, res) => {
  const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  res.json(links.map(l => ({
    ...l,
    iconUrl: l.icon ? '/uploads/icons/' + path.basename(l.icon) : ''
  })));
});

// ----- Helpers: baca produk dari unified folder (uploads/products/{type}/{id}/)
function listProducts(type) {
  const dir = path.join(UPLOADS_DIR, 'products', type);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => {
    const fullPath = path.join(dir, f);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'info.json'));
  }).map(id => {
    const productDir = path.join(UPLOADS_DIR, 'products', type, id);
    const info = JSON.parse(fs.readFileSync(path.join(productDir, 'info.json'), 'utf8'));
    const files = fs.readdirSync(productDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    const images = files.map(f => `/uploads/products/${type}/${id}/${f}`);
    let coverPath = '';
    if (files.find(f => /^cover\./i.test(f))) {
      const cf = files.find(f => /^cover\./i.test(f));
      coverPath = `/uploads/products/${type}/${id}/${cf}`;
    } else if (files.length > 0) {
      coverPath = `/uploads/products/${type}/${id}/${files[0]}`;
    }
    return { id, ...info, coverUrl: coverPath, images };
  });
}

app.get('/api/products/snacks', (req, res) => res.json(listProducts('snacks')));
app.get('/api/products/affiliate', (req, res) => res.json(listProducts('affiliate')));

// ----- Admin auth
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const auth = getAuth();
  if (auth.username === username && auth.password === password) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.post('/api/auth/change', requireAuth, (req, res) => {
  const { oldUsername, oldPassword, newUsername, newPassword } = req.body;
  const auth = getAuth();
  if (auth.username !== oldUsername || auth.password !== oldPassword) {
    return res.status(400).json({ error: 'Username atau password lama salah' });
  }
  setAuth({
    username: newUsername || auth.username,
    password: newPassword || auth.password
  });
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/admin/telemetry', requireAuth, (req, res) => {
  const t = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
  res.json(t);
});

// ----- Admin: Profile
app.get('/api/admin/profile', requireAuth, (req, res) => {
  res.json(JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8')));
});

app.post('/api/admin/profile', requireAuth, (req, res) => {
  uploadProfile(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    let data = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.bio !== undefined) data.bio = req.body.bio;
    if (req.body.donateLink !== undefined) data.donateLink = req.body.donateLink;
    if (req.body.whatsapp !== undefined) data.whatsapp = req.body.whatsapp;
    if (req.file) {
      // Pastikan file benar-benar tersimpan di disk sebelum update JSON
      const savedPath = path.join(UPLOADS_DIR, 'profile', req.file.filename);
      if (fs.existsSync(savedPath)) {
        data.profileImage = 'profile/' + req.file.filename;
      } else {
        return res.status(500).json({ error: 'File gagal tersimpan di disk. Coba lagi.' });
      }
    }
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2));
    res.json(data);
  });
});

app.post('/api/admin/cover', requireAuth, (req, res) => {
  uploadCover(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    let data = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
    if (req.file) {
      const savedPath = path.join(UPLOADS_DIR, 'cover', req.file.filename);
      if (fs.existsSync(savedPath)) {
        data.coverImage = 'cover/' + req.file.filename;
      } else {
        return res.status(500).json({ error: 'File cover gagal tersimpan. Coba lagi.' });
      }
    }
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2));
    res.json(data);
  });
});

app.put('/api/admin/profile', requireAuth, (req, res) => {
  let data = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.bio !== undefined) data.bio = req.body.bio;
  if (req.body.donateLink !== undefined) data.donateLink = req.body.donateLink;
  if (req.body.whatsapp !== undefined) data.whatsapp = req.body.whatsapp;
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

// ----- Admin: Links
app.get('/api/admin/links', requireAuth, (req, res) => {
  res.json(JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')));
});

app.post('/api/admin/links', requireAuth, (req, res) => {
  uploadIcon(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
    const newLink = {
      id: uuidv4(),
      name: req.body.name || 'New',
      url: req.body.url || '#',
      icon: req.file ? 'icons/' + req.file.filename : ''
    };
    links.push(newLink);
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
    res.json(newLink);
  });
});

app.put('/api/admin/links/:id', requireAuth, (req, res) => {
  const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  const i = links.findIndex(l => l.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  if (req.body.name !== undefined) links[i].name = req.body.name;
  if (req.body.url !== undefined) links[i].url = req.body.url;
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
  res.json(links[i]);
});

app.post('/api/admin/links/:id/icon', requireAuth, (req, res) => {
  const linkId = req.params.id;
  const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  const i = links.findIndex(l => l.id === linkId);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  uploadLinkIcon(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    const iconsDir = path.join(UPLOADS_DIR, 'icons');
    const oldIcon = links[i].icon;
    if (oldIcon) {
      const oldPath = path.join(UPLOADS_DIR, oldIcon);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const base = path.basename(req.file.filename);
    links[i].icon = 'icons/' + base;
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
    res.json(links[i]);
  });
});

app.delete('/api/admin/links/:id', requireAuth, (req, res) => {
  let links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  const one = links.find(l => l.id === req.params.id);
  if (one && one.icon) {
    const iconPath = path.join(UPLOADS_DIR, one.icon);
    if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
  }
  links = links.filter(l => l.id !== req.params.id);
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
  res.json({ ok: true });
});

// ----- Admin: Products (snacks / affiliate)
// Semua data produk (info.json + foto) disimpan di satu folder: uploads/products/{type}/{id}/
function getProductPath(type, id) {
  return path.join(UPLOADS_DIR, 'products', type, id, 'info.json');
}

app.get('/api/admin/products/:type', requireAuth, (req, res) => {
  res.json(listProducts(req.params.type));
});

app.post('/api/admin/products/:type', requireAuth, (req, res) => {
  const type = req.params.type;
  const id = uuidv4();
  // Folder tunggal untuk produk: uploads/products/{type}/{id}/
  const dir = path.join(UPLOADS_DIR, 'products', type, id);
  fs.mkdirSync(dir, { recursive: true });
  const isSnack = type === 'snacks';
  const info = {
    name: req.body.name || 'Produk Baru',
    price: req.body.price || '0',
    priceNormal: req.body.priceNormal || '',
    description: req.body.description || (isSnack ? 'Deskripsi produk.' : 'Pendapat saya soal produk ini.'),
    whatsapp: req.body.whatsapp || '',
    marketplaces: req.body.marketplaces
      ? (Array.isArray(req.body.marketplaces) ? req.body.marketplaces : JSON.parse(req.body.marketplaces))
      : [
          { name: 'Shopee', url: '' },
          { name: 'Tokopedia', url: '' },
          { name: 'TikTok Shop', url: '' }
        ]
  };
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
  res.json({ id, ...info });
});

app.get('/api/admin/products/:type/:id', requireAuth, (req, res) => {
  const fp = getProductPath(req.params.type, req.params.id);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  const info = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const productDir = path.join(UPLOADS_DIR, 'products', req.params.type, req.params.id);
  let images = [];
  if (fs.existsSync(productDir)) {
    images = fs.readdirSync(productDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => `/uploads/products/${req.params.type}/${req.params.id}/${f}`);
  }
  res.json({ id: req.params.id, ...info, images });
});

app.put('/api/admin/products/:type/:id', requireAuth, (req, res) => {
  const fp = getProductPath(req.params.type, req.params.id);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  let info = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (req.body.name !== undefined) info.name = req.body.name;
  if (req.body.price !== undefined) info.price = req.body.price;
  if (req.body.priceNormal !== undefined) info.priceNormal = req.body.priceNormal;
  if (req.body.description !== undefined) info.description = req.body.description;
  if (req.body.whatsapp !== undefined) info.whatsapp = req.body.whatsapp;
  if (req.body.marketplaces !== undefined) info.marketplaces = typeof req.body.marketplaces === 'string' ? JSON.parse(req.body.marketplaces) : req.body.marketplaces;
  fs.writeFileSync(fp, JSON.stringify(info, null, 2));
  res.json(info);
});

app.delete('/api/admin/products/:type/:id', requireAuth, (req, res) => {
  // Hapus seluruh folder produk (info.json + semua foto)
  const productDir = path.join(UPLOADS_DIR, 'products', req.params.type, req.params.id);
  if (fs.existsSync(productDir)) fs.rmSync(productDir, { recursive: true });
  res.json({ ok: true });
});

// Upload product images (cover + up to 4 photos) — disimpan di folder produk yang sama
app.post('/api/admin/products/:type/:id/upload', requireAuth, (req, res) => {
  const { type, id } = req.params;
  // Validasi: cek folder produk di unified location
  const productDir = path.join(UPLOADS_DIR, 'products', type, id);
  if (!fs.existsSync(productDir)) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  
  uploadProduct(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    const uploadDir = path.join(UPLOADS_DIR, 'products', type, id);
    
    // Sinkronisasi cover: hapus versi lama jika beda nama/ekstensi dgn yg baru
    if (req.files && req.files.cover && req.files.cover[0]) {
      const newFilename = req.files.cover[0].filename; // cth: cover.png
      if (fs.existsSync(uploadDir)) {
          fs.readdirSync(uploadDir).forEach(f => {
            if (f.startsWith('cover.') && f !== newFilename) {
              fs.unlinkSync(path.join(uploadDir, f));
            }
          });
      }
    }
    
    // Sinkronisasi photos opsional: Batasi total max 4 gambar img_* untuk cegah overload storage
    if (fs.existsSync(uploadDir)) {
      const existing = fs.readdirSync(uploadDir).filter(f => /^img_/.test(f) && /\.(jpg|jpeg|png|webp)$/i.test(f));
      // Urutkan dari yg terbaru ke terlama berdasarkan timestamp di nama file (img_17..._xyz.jpg)
      existing.sort((a, b) => {
        const tA = parseInt(a.split('_')[1] || '0', 10);
        const tB = parseInt(b.split('_')[1] || '0', 10);
        return tB - tA; // descending (terbaru di atas)
      });
      if (existing.length > 4) {
        existing.slice(4).forEach(f => fs.unlinkSync(path.join(uploadDir, f)));
      }
    }
    
    res.json({ ok: true });
  });
});

// SPA fallback for admin
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
  console.log('Landing: http://localhost:' + PORT);
  console.log('Admin:   http://localhost:' + PORT + '/admin');
});
