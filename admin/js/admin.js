(function () {
  const API = '';
  let profile = {};
  let links = [];
  let editingProductId = null;
  let editingProductType = null;

  function showImageLightbox(src) {
    if (!src) return;
    document.getElementById('img-lightbox-img').src = src;
    document.getElementById('img-lightbox').style.display = 'flex';
  }
  function closeImageLightbox() {
    document.getElementById('img-lightbox').style.display = 'none';
  }
  document.getElementById('img-lightbox-close').addEventListener('click', closeImageLightbox);
  document.getElementById('img-lightbox').querySelector('.img-lightbox-bg').addEventListener('click', closeImageLightbox);
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('preview-img-click') || (e.target.closest('.preview-wrap') && e.target.tagName === 'IMG')) {
      e.preventDefault();
      var src = e.target.src || (e.target.querySelector('img') && e.target.querySelector('img').src);
      if (src) showImageLightbox(src);
    }
    if (e.target.classList.contains('photo-preview-img') || e.target.classList.contains('link-icon-preview-img')) {
      e.preventDefault();
      if (e.target.src) showImageLightbox(e.target.src);
    }
  });

  function req(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    return fetch(API + url, opts);
  }

  function showPage(id) {
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.remove('active');
      if (n.dataset.page === id) n.classList.add('active');
    });
    const el = document.getElementById('page-' + id);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-dropdown').forEach(function (d) { d.classList.remove('open'); });
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(this.dataset.page);
    });
  });
  document.querySelector('.nav-dropdown .nav-item').addEventListener('click', function () {
    document.querySelector('.nav-dropdown').classList.toggle('open');
  });

  // ----- Login -----
  const loginPage = document.getElementById('login-page');
  const adminApp = document.getElementById('admin-app');
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      if (r.ok) {
        loginPage.style.display = 'none';
        adminApp.style.display = 'flex';
        document.getElementById('login-error').textContent = '';
        loadDashboard();
        loadProfile();
        loadLinks();
        loadProducts('snacks');
        loadProducts('affiliate');
      } else {
        document.getElementById('login-error').textContent = 'Username atau password salah.';
      }
    }).catch(function () {
      document.getElementById('login-error').textContent = 'Gagal koneksi.';
    });
  });

  document.getElementById('btn-change-creds').addEventListener('click', function () {
    document.getElementById('change-creds-form').style.display = document.getElementById('change-creds-form').style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btn-save-creds').addEventListener('click', function () {
    const oldU = document.getElementById('old-username').value;
    const oldP = document.getElementById('old-password').value;
    const newU = document.getElementById('new-username').value;
    const newP = document.getElementById('new-password').value;
    req('/api/auth/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldUsername: oldU, oldPassword: oldP, newUsername: newU || undefined, newPassword: newP || undefined })
    }).then(function (r) {
      return r.json().then(function (data) {
        if (r.ok) {
          document.getElementById('creds-msg').textContent = 'Berhasil. Silakan login lagi.';
          document.getElementById('login-username').value = newU || oldU;
          document.getElementById('login-password').value = newP || oldP;
        } else {
          document.getElementById('creds-msg').textContent = data.error || 'Gagal';
        }
      });
    }).catch(function () {
      document.getElementById('creds-msg').textContent = 'Gagal koneksi.';
    });
  });

  document.getElementById('btn-logout').addEventListener('click', function () {
    req('/api/auth/logout', { method: 'POST' }).then(function () {
      adminApp.style.display = 'none';
      loginPage.style.display = 'flex';
    });
  });

  // ----- Dashboard -----
  function loadDashboard() {
    req('/api/admin/profile').then(function (r) { return r.json(); }).then(function (p) {
      profile = p;
      document.getElementById('welcome-name').textContent = p.name || 'Rautsan';
    }).catch(function () {});
    req('/api/admin/telemetry').then(function (r) { return r.json(); }).then(function (t) {
      document.getElementById('stat-visits').textContent = t.visits || 0;
      const pv = t.productViews || {};
      const entries = Object.entries(pv).sort(function (a, b) { return b[1] - a[1]; });
      document.getElementById('stat-views').textContent = entries.length ? entries[0][0].replace('snacks_', '').replace('affiliate_', '') + ' (' + entries[0][1] + 'x)' : '-';
    }).catch(function () {
      document.getElementById('stat-visits').textContent = '0';
      document.getElementById('stat-views').textContent = '-';
    });
  }

  // ----- Profile -----
  function loadProfile() {
    req('/api/admin/profile').then(function (r) { return r.json(); }).then(function (p) {
      profile = p;
      document.getElementById('profile-name').value = p.name || '';
      document.getElementById('profile-bio').value = p.bio || '';
      document.getElementById('profile-donate').value = p.donateLink || '';
      document.getElementById('profile-whatsapp').value = p.whatsapp || '';
      var profilePreview = document.getElementById('preview-profile');
      var coverPreview = document.getElementById('preview-cover');
      var cb = '?t=' + Date.now();
      profilePreview.innerHTML = p.profileImage
        ? '<span class="preview-wrap"><img class="preview-img-click" src="/uploads/' + p.profileImage + cb + '" alt="" title="Klik untuk perbesar"></span>'
        : '';
      coverPreview.innerHTML = p.coverImage
        ? '<span class="preview-wrap"><img class="preview-img-click" src="/uploads/' + p.coverImage + cb + '" alt="" title="Klik untuk perbesar"></span>'
        : '';
    }).catch(function () {});
  }

  document.getElementById('form-profile').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value;
    const bio = document.getElementById('profile-bio').value;
    const donateLink = document.getElementById('profile-donate').value;
    const whatsapp = document.getElementById('profile-whatsapp').value;
    const profileFile = document.getElementById('profile-photo-file').files[0];
    const coverFile = document.getElementById('cover-photo-file').files[0];

    function saveText() {
      return req('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, bio: bio, donateLink: donateLink, whatsapp: whatsapp })
      });
    }

    let chain = Promise.resolve();
    if (profileFile) {
      const fd = new FormData();
      fd.append('profile', profileFile);
      chain = chain.then(function () {
        return req('/api/admin/profile', { method: 'POST', body: fd });
      });
    }
    if (coverFile) {
      const fd = new FormData();
      fd.append('cover', coverFile);
      chain = chain.then(function () {
        return req('/api/admin/cover', { method: 'POST', body: fd });
      });
    }
    chain.then(function () {
      return saveText();
    }).then(function () {
      alert('Profile tersimpan.');
      loadProfile();
      loadDashboard();
    }).catch(function () {
      alert('Gagal menyimpan.');
    });
  });

  // ----- Links (icon: preview + klik perbesar; tiap link bisa ganti icon, max 1) -----
  function loadLinks() {
    req('/api/admin/links').then(function (r) { return r.json(); }).then(function (list) {
      links = list;
      var el = document.getElementById('links-list');
      el.innerHTML = list.map(function (l) {
        var iconHtml = l.icon
          ? '<img class="link-icon-preview-img" src="/uploads/' + l.icon + '" alt="" title="Klik untuk perbesar">'
          : '<span class="no-icon">+ Icon</span>';
        return '<div class="link-item" data-id="' + l.id + '">' +
          '<label class="link-icon-cell" title="Klik untuk ganti icon (max 1)">' + iconHtml +
          '<input type="file" accept=".png,image/png" class="link-icon-file"></label>' +
          '<input type="text" value="' + (l.name || '') + '" placeholder="Nama">' +
          '<input type="url" value="' + (l.url || '') + '" placeholder="URL">' +
          '<button type="button" class="btn-save-link">Simpan</button><button type="button" class="btn-delete-link">Hapus</button></div>';
      }).join('');
      el.querySelectorAll('.btn-save-link').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest('.link-item');
          var id = item.dataset.id;
          var name = item.querySelector('input[type="text"]').value;
          var url = item.querySelector('input[type="url"]').value;
          req('/api/admin/links/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, url: url })
          }).then(function () { loadLinks(); });
        });
      });
      el.querySelectorAll('.btn-delete-link').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Hapus link ini?')) return;
          var id = btn.closest('.link-item').dataset.id;
          req('/api/admin/links/' + id, { method: 'DELETE' }).then(function () { loadLinks(); });
        });
      });
      el.querySelectorAll('.link-icon-cell').forEach(function (cell) {
        var linkId = cell.closest('.link-item').dataset.id;
        var input = cell.querySelector('.link-icon-file');
        cell.addEventListener('click', function (e) {
          if (e.target === input) return;
          e.preventDefault();
          var img = cell.querySelector('img');
          if (img && e.target === img) showImageLightbox(img.src);
          else input.click();
        });
        input.addEventListener('change', function () {
          if (!input.files || !input.files[0]) return;
          var fd = new FormData();
          fd.append('icon', input.files[0]);
          req('/api/admin/links/' + linkId + '/icon', { method: 'POST', body: fd }).then(function (r) {
            if (r.ok) { loadLinks(); }
          });
          input.value = '';
        });
      });
    }).catch(function () {});
  }

  document.getElementById('btn-add-link').addEventListener('click', function () {
    const name = document.getElementById('link-name').value || 'New';
    const url = document.getElementById('link-url').value || '#';
    const file = document.getElementById('link-icon').files[0];
    const fd = new FormData();
    fd.append('name', name);
    fd.append('url', url);
    if (file) fd.append('icon', file);
    req('/api/admin/links', { method: 'POST', body: fd }).then(function (r) {
      if (r.ok) {
        document.getElementById('link-name').value = '';
        document.getElementById('link-url').value = '';
        document.getElementById('link-icon').value = '';
        loadLinks();
      }
    });
  });

  // ----- Products -----
  function loadProducts(type) {
    req('/api/admin/products/' + type).then(function (r) { return r.json(); }).then(function (list) {
      const listId = type === 'snacks' ? 'products-snacks-list' : 'products-affiliate-list';
      const el = document.getElementById(listId);
      el.innerHTML = list.length ? list.map(function (p) {
        const img = p.coverUrl ? '<img src="' + p.coverUrl + '" alt="">' : '<div style="width:60px;height:60px;background:#eee;border-radius:6px;"></div>';
        var priceStr = p.price ? 'Rp ' + p.price : '';
        if (p.priceNormal && parseInt(p.priceNormal, 10) > parseInt(p.price || 0, 10)) priceStr += ' (normal: Rp ' + p.priceNormal + ')';
        return '<div class="product-card" data-id="' + p.id + '">' + img + '<div class="info"><strong>' + (p.name || 'Produk') + '</strong> ' + priceStr + '</div>' +
          '<div class="actions"><button type="button" class="btn-edit">Edit</button><button type="button" class="btn-delete">Hapus</button></div></div>';
      }).join('') : '<p>Belum ada produk.</p>';
      el.querySelectorAll('.btn-edit').forEach(function (b) {
        b.addEventListener('click', function () {
          editingProductId = b.closest('.product-card').dataset.id;
          editingProductType = type;
          showProductForm(type, editingProductId);
        });
      });
      el.querySelectorAll('.btn-delete').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Hapus produk ini?')) return;
          const id = b.closest('.product-card').dataset.id;
          req('/api/admin/products/' + type + '/' + id, { method: 'DELETE' }).then(function () { loadProducts(type); });
        });
      });
    }).catch(function () {});
  }

  const defaultMarketplaces = [
    { name: 'Shopee', url: '' },
    { name: 'Tokopedia', url: '' },
    { name: 'TikTok Shop', url: '' }
  ];

  function renderPhotoSlot(slotIndex, imageUrl, label) {
    var isFilled = !!imageUrl;
    var inner = isFilled
      ? '<img class="photo-preview-img" src="' + imageUrl + '" alt="" title="Klik untuk perbesar">'
      : '<span class="photo-preview-plus">+</span>';
    var name = slotIndex === 0 ? 'cover' : 'photo' + slotIndex;
    return '<div class="photo-slot ' + (isFilled ? 'filled' : '') + '" data-slot="' + slotIndex + '">' +
      inner + '<input type="file" accept="image/*" name="' + name + '" data-slot="' + slotIndex + '">' +
      (label ? '<span class="photo-slot-label">' + label + '</span>' : '') + '</div>';
  }

  function showProductForm(type, id) {
    var wrapId = type === 'snacks' ? 'product-form-snacks' : 'product-form-affiliate';
    var wrap = document.getElementById(wrapId);
    var isNew = !id;
    var isSnack = type === 'snacks';
    wrap.style.display = 'block';
    var photoRowHtml = '<div class="photo-row">' +
      renderPhotoSlot(0, null, 'Cover') +
      renderPhotoSlot(1, null, 'Foto 2') +
      renderPhotoSlot(2, null, 'Foto 3') +
      renderPhotoSlot(3, null, 'Foto 4') +
      '<div class="photo-slot-add" id="product-photo-add">+</div></div>';
    wrap.innerHTML = '<h2>' + (isNew ? 'Tambah' : 'Edit') + ' Produk</h2>' +
      '<form class="product-form">' +
      '<label>Foto (kiri = cover, max 4)</label>' +
      photoRowHtml +
      '<label>Nama</label><input type="text" name="name" placeholder="Nama produk">' +
      '<label>Harga normal (angka, sebelum diskon)</label><input type="text" name="priceNormal" placeholder="20000">' +
      '<label>Harga diskon (angka, yang tampil)</label><input type="text" name="price" placeholder="15000">' +
      '<label>' + (isSnack ? 'Deskripsi produk' : 'Pendapat saya soal produk ini') + '</label><textarea name="description" rows="3"></textarea>' +
      '<label>WhatsApp penjual (kosongkan = pakai default dari Profile)</label><input type="text" name="whatsapp" placeholder="6281234567890">' +
      '<div class="marketplaces-list"><label>Marketplace (default: Shopee, Tokopedia, TikTok Shop)</label><div class="marketplace-rows"></div><button type="button" class="btn-add-mp">+ Marketplace baru</button></div>' +
      '<button type="submit">Simpan</button><button type="button" class="btn-cancel">Batal</button>' +
      '</form>';
    var form = wrap.querySelector('.product-form');
    var mRows = wrap.querySelector('.marketplace-rows');
    var marketplaces = defaultMarketplaces.slice();

    function renderMarketplaces() {
      mRows.innerHTML = marketplaces.map(function (m) {
        return '<div class="marketplace-row"><input type="text" placeholder="Nama" value="' + (m.name || '') + '"><input type="url" placeholder="URL" value="' + (m.url || '') + '"></div>';
      }).join('');
    }
    renderMarketplaces();
    wrap.querySelector('.btn-add-mp').addEventListener('click', function () {
      marketplaces.push({ name: '', url: '' });
      renderMarketplaces();
    });
    form.querySelector('.btn-cancel').addEventListener('click', function () {
      wrap.style.display = 'none';
      editingProductId = null;
      editingProductType = null;
    });

    // Simpan File objek di sini (bukan baca dari input.files saat submit,
    // karena elemen bisa di-replace saat preview update)
    var selectedFiles = {};

    function updateSlotPreview(slot, file) {
      var previewUrl = URL.createObjectURL(file);
      var existingImg = slot.querySelector('img.photo-preview-img');
      if (existingImg) {
        existingImg.src = previewUrl;
      } else {
        var plus = slot.querySelector('.photo-preview-plus');
        if (plus) slot.removeChild(plus);
        var img = document.createElement('img');
        img.className = 'photo-preview-img';
        img.src = previewUrl;
        img.alt = '';
        img.title = 'Klik untuk perbesar';
        var inp = slot.querySelector('input[type="file"]');
        slot.insertBefore(img, inp);
      }
      slot.classList.add('filled');
    }

    function bindPhotoSlots() {
      wrap.querySelectorAll('.photo-slot').forEach(function (slot) {
        var slotIdx = parseInt(slot.dataset.slot, 10);
        var input = slot.querySelector('input[type="file"]');
        slot.addEventListener('click', function (e) {
          if (e.target === input) return;
          if (e.target.classList.contains('photo-preview-img')) {
            showImageLightbox(e.target.src);
            return;
          }
          e.preventDefault();
          input.click();
        });
        input.addEventListener('change', function () {
          if (!input.files || !input.files[0]) return;
          // Simpan referensi File di memori — JANGAN replace elemen!
          selectedFiles[slotIdx] = input.files[0];
          updateSlotPreview(slot, input.files[0]);
        });
      });
      var addBtn = wrap.querySelector('#product-photo-add');
      if (addBtn) {
        addBtn.onclick = function () {
          var firstEmpty = wrap.querySelector('.photo-slot:not(.filled)');
          if (firstEmpty) firstEmpty.querySelector('input[type="file"]').click();
        };
      }
    }
    bindPhotoSlots();

    if (!isNew) {
      req('/api/admin/products/' + type + '/' + id).then(function (r) { return r.json(); }).then(function (p) {
        form.querySelector('[name="name"]').value = p.name || '';
        form.querySelector('[name="priceNormal"]').value = p.priceNormal || '';
        form.querySelector('[name="price"]').value = p.price || '';
        form.querySelector('[name="description"]').value = p.description || '';
        form.querySelector('[name="whatsapp"]').value = p.whatsapp || '';
        if (p.marketplaces && p.marketplaces.length) marketplaces = p.marketplaces;
        renderMarketplaces();
        var images = p.images || [];
        if (images.length) {
          var row = wrap.querySelector('.photo-row');
          var slots = row.querySelectorAll('.photo-slot');
          var labels = ['Cover', 'Foto 2', 'Foto 3', 'Foto 4'];
          for (var i = 3; i >= 0; i--) {
            var url = images[i];
            if (url && slots[i]) {
              var div = document.createElement('div');
              div.innerHTML = renderPhotoSlot(i, url, labels[i]);
              slots[i].parentNode.replaceChild(div.firstChild, slots[i]);
            }
          }
          bindPhotoSlots();
        }
      }).catch(function () {});
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]').value;
      var priceNormal = form.querySelector('[name="priceNormal"]').value;
      var price = form.querySelector('[name="price"]').value;
      var description = form.querySelector('[name="description"]').value;
      var whatsapp = form.querySelector('[name="whatsapp"]').value;
      var rows = mRows.querySelectorAll('.marketplace-row');
      var mkt = Array.from(rows).map(function (row) {
        var inputs = row.querySelectorAll('input');
        return { name: inputs[0].value, url: inputs[1].value };
      });
      // Ambil dari selectedFiles (bukan input.files — sudah ter-replace saat preview)
      var coverFile = selectedFiles[0] || null;
      var photoFiles = [selectedFiles[1], selectedFiles[2], selectedFiles[3]].filter(Boolean);

      if (isNew) {
        req('/api/admin/products/' + type, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, price: price, priceNormal: priceNormal, description: description, whatsapp: whatsapp, marketplaces: mkt })
        }).then(function (r) { return r.json(); }).then(function (data) {
          var newId = data.id;
          if (coverFile || photoFiles.length) {
            var fd = new FormData();
            if (coverFile) fd.append('cover', coverFile);
            photoFiles.forEach(function (f) { fd.append('photos', f); });
            return req('/api/admin/products/' + type + '/' + newId + '/upload', { method: 'POST', body: fd }).then(function () { return newId; });
          }
          return newId;
        }).then(function () {
          wrap.style.display = 'none';
          loadProducts(type);
        }).catch(function () { alert('Gagal menyimpan.'); });
      } else {
        req('/api/admin/products/' + type + '/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, price: price, priceNormal: priceNormal, description: description, whatsapp: whatsapp, marketplaces: mkt })
        }).then(function () {
          if (coverFile || photoFiles.length) {
            var fd = new FormData();
            if (coverFile) fd.append('cover', coverFile);
            photoFiles.forEach(function (f) { fd.append('photos', f); });
            return req('/api/admin/products/' + type + '/' + id + '/upload', { method: 'POST', body: fd });
          }
        }).then(function () {
          wrap.style.display = 'none';
          editingProductId = null;
          loadProducts(type);
        }).catch(function () { alert('Gagal menyimpan.'); });
      }
    });
  }

  document.getElementById('btn-add-snack').addEventListener('click', function () {
    editingProductId = null;
    editingProductType = 'snacks';
    showProductForm('snacks', null);
  });
  document.getElementById('btn-add-affiliate').addEventListener('click', function () {
    editingProductId = null;
    editingProductType = 'affiliate';
    showProductForm('affiliate', null);
  });
})();
