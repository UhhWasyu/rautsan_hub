(function () {
  const API = '';

  // Auto-detect mode:
  // - GitHub Pages (*.github.io) → load dari data.json (statis, tanpa server)
  // - Localhost / VPS             → load dari API seperti biasa
  const IS_STATIC_MODE = window.location.hostname.endsWith('.github.io') ||
                          window.location.hostname.endsWith('.pages.dev') ||
                          window.location.search.includes('static=1'); // testing: tambahkan ?static=1 di URL

  let profile = {};
  let links = [];
  let snacks = [];
  let affiliate = [];
  let currentTab = 'snacks';
  
  // State for Detail View
  let currentPostIndex = 0;
  let currentList = [];
  let activeCarouselIndex = 0;
  let scrollTimeout = null;

  // ----- Theme Logic -----
  const themeKey = 'rautsan-theme';
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  const saved = localStorage.getItem(themeKey) || 'dark';
  root.className = saved;
  updateThemeIcon(saved);

  function updateThemeIcon(t) {
    if (t === 'dark') {
      themeIcon.className = 'fas fa-moon opacity-70';
    } else {
      themeIcon.className = 'fas fa-sun opacity-70';
    }
  }

  themeToggle.addEventListener('click', function () {
    const next = root.classList.contains('light') ? 'dark' : 'light';
    root.className = next;
    updateThemeIcon(next);
    localStorage.setItem(themeKey, next);
  });

  // Telemetry kunjungan (hanya aktif saat ada server / mode API)
  if (!IS_STATIC_MODE) {
    fetch(API + '/api/telemetry/visit', { method: 'POST' }).catch(function () {});
  }

  // ----- Utils -----
  function daysUntilSaturday() {
    var d = new Date();
    var day = d.getDay();
    var saturday = 6;
    var diff = saturday - day;
    if (diff <= 0) diff += 7;
    return diff;
  }

  function formatWaNumber(num) {
    if (!num) return '';
    var digits = ('' + num).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    else if (!digits.startsWith('62')) digits = '62' + digits;
    return 'https://wa.me/' + digits;
  }

  function getProductWa(p) {
    var wa = (p && p.whatsapp) ? p.whatsapp : (profile && profile.whatsapp) ? profile.whatsapp : '';
    return formatWaNumber(wa);
  }

  var MARKETPLACE_ICON_EXT = '.svg';
  var marketplaceIconSlug = { 'Shopee': 'shopee', 'Tokopedia': 'tokopedia', 'TikTok Shop': 'tiktokshop' };
  function getMarketplaceIcon(name) {
    if (!name) return '/images/marketplace/generic.svg';
    if (marketplaceIconSlug[name]) return '/images/marketplace/' + marketplaceIconSlug[name] + MARKETPLACE_ICON_EXT;
    return '/images/marketplace/generic.svg';
  }
  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // ----- Render Components -----
  function renderProfile() {
    document.getElementById('profile-name').textContent = profile.name || 'Rautsan';
    document.getElementById('profile-bio').textContent = profile.bio || '';
    
    var donateBtn = document.getElementById('btn-donate');
    donateBtn.href = profile.donateLink || '#';
    
    // Prevent browser cache when image is updated
    var cacheBuster = '?t=' + Date.now();
    
    var photo = document.getElementById('profile-photo');
    if (profile.profileImageUrl) {
        photo.style.backgroundImage = 'url(' + profile.profileImageUrl + cacheBuster + ')';
    } else {
        photo.style.backgroundImage = 'url(https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(profile.name || 'Rautsan') + ')';
    }
    
    var cover = document.getElementById('cover-photo');
    if (cover) {
        if (profile.coverImageUrl) {
            cover.style.backgroundImage = 'url(' + profile.coverImageUrl + cacheBuster + ')';
        } else {
            cover.style.backgroundImage = ''; // fallback on css bg-current/5
        }
    }
  }

  function renderLinks() {
    var el = document.getElementById('link-cluster');
    el.innerHTML = links.map(function (l) {
      if (l.iconUrl) {
          return '<a href="' + (l.url || '#') + '" target="_blank" rel="noopener" class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1 glass-box p-2" title="' + (l.name || '') + '"><img src="' + l.iconUrl + '" class="w-full h-full object-contain" alt="' + (l.name || '') + '"></a>';
      } else {
          var n = (l.name || '').toLowerCase();
          var iconClass = 'fas fa-link';
          if(n.includes('youtube')) iconClass = 'fab fa-youtube text-red-500';
          else if(n.includes('tiktok')) iconClass = 'fab fa-tiktok';
          else if(n.includes('instagram')) iconClass = 'fab fa-instagram text-pink-500';
          else if(n.includes('twitch')) iconClass = 'fab fa-twitch text-purple-500';
          else if(n.includes('discord')) iconClass = 'fab fa-discord text-indigo-500';
          else if(n.includes('x.com') || n.includes('twitter')) iconClass = 'fab fa-twitter text-blue-400';
          
          return '<a href="' + (l.url || '#') + '" target="_blank" rel="noopener" class="glass-box w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1" title="' + (l.name || '') + '"><i class="' + iconClass + ' text-xl sm:text-2xl opacity-80"></i></a>';
      }
    }).join('');
  }

  function renderFeed(list, containerId) {
    var el = document.getElementById(containerId);
    if (!list.length) {
      el.innerHTML = '<div class="col-span-3 py-24 flex flex-col items-center opacity-20"><i class="fas fa-camera text-4xl mb-4"></i><p class="text-[10px] uppercase tracking-widest font-black">Empty Space</p></div>';
      return;
    }
    el.innerHTML = list.map(function (p, index) {
      var img = p.coverUrl ? '<img src="' + p.coverUrl + '" alt="' + p.name + '" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition duration-500">' : '<div class="w-full h-full bg-current opacity-10"></div>';
      return '<div class="feed-item aspect-square glass-box rounded-lg overflow-hidden hover:scale-[1.02] transition-all duration-500 relative cursor-pointer" data-id="' + p.id + '" data-index="' + index + '" data-type="' + (containerId === 'feed-snacks' ? 'snacks' : 'affiliate') + '">' + img + '<div class="sneak"><span>' + (p.name || 'Produk') + '</span></div></div>';
    }).join('');
    
    el.querySelectorAll('.feed-item').forEach(function (item) {
      item.addEventListener('click', function(e) {
          openDetailView(e.currentTarget.dataset.type, parseInt(e.currentTarget.dataset.index));
      });
    });
  }

  // ----- SINGLE POST RENDERER (TRUE MODAL) -----
  window.navigatePost = function(direction) {
      var newListIndex = currentPostIndex + direction;
      if (newListIndex >= 0 && newListIndex < currentList.length) {
          currentPostIndex = newListIndex;
          var p = document.getElementById('feed-posts');
          p.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
          p.style.opacity = '0';
          p.style.transform = 'scale(0.97)';
          setTimeout(function() {
              renderSinglePost();
              p.style.opacity = '1';
              p.style.transform = 'scale(1)';
          }, 160);
      }
  };

  window.changeCarousel = function(index) {
      var track = document.getElementById('carousel-track');
      if (track) {
          track.style.transform = 'translateX(-' + (index * 100) + '%)';
          document.querySelectorAll('.carousel-dot').forEach(function(dot, i) {
              dot.classList.toggle('active', i === index);
          });
          activeCarouselIndex = index;
      }
  };

  function bindCarouselSwipe() {
      var wrap = document.querySelector('.carousel-wrap');
      if (!wrap) return;
      var startX = 0;
      var isDragging = false;
      wrap.addEventListener('touchstart', function(e) {
          startX = e.touches[0].clientX;
          isDragging = true;
      }, { passive: true });
      wrap.addEventListener('touchend', function(e) {
          if (!isDragging) return;
          isDragging = false;
          var dx = e.changedTouches[0].clientX - startX;
          var total = document.querySelectorAll('.carousel-dot').length;
          if (Math.abs(dx) > 40) {
              var next = dx < 0 ? Math.min(activeCarouselIndex + 1, total - 1)
                                : Math.max(activeCarouselIndex - 1, 0);
              changeCarousel(next);
          }
      }, { passive: true });
  }

  // Update arrow buttons di overlay (bukan di dalam modal) agar pointer-events bekerja
  function updateModalArrows() {
      var leftBtn = document.getElementById('modal-arrow-left');
      var rightBtn = document.getElementById('modal-arrow-right');
      if (leftBtn) leftBtn.style.display = currentPostIndex > 0 ? 'flex' : 'none';
      if (rightBtn) rightBtn.style.display = currentPostIndex < currentList.length - 1 ? 'flex' : 'none';
  }

  function renderSinglePost() {
    var p = currentList[currentPostIndex];
    if (!p) return;

    var postsEl = document.getElementById('feed-posts');
    var isSnack = currentTab === 'snacks';

    var allPhotos = [];
    if (p.images && p.images.length > 0) {
        allPhotos = p.images;
    } else if (p.coverUrl) {
        allPhotos = [p.coverUrl];
    }
    if (allPhotos.length === 0) allPhotos = [''];
    else if (allPhotos.length > 4) allPhotos = allPhotos.slice(0, 4);
    activeCarouselIndex = 0;

    var imgHtml = '';
    var dotsHtml = '';
    if (allPhotos.length <= 1) {
        var src = allPhotos[0] || '';
        imgHtml = src
            ? '<img src="' + src + '" alt="' + p.name + '" class="w-full h-full object-cover block">'
            : '<div style="width:100%;height:100%;" class="bg-current opacity-5"></div>';
    } else {
        imgHtml = '<div id="carousel-track" class="carousel-track">' +
            allPhotos.map(function(src) {
                return '<div class="carousel-slide"><img src="' + src + '" alt="' + p.name + '" class="w-full h-full object-cover block"></div>';
            }).join('') + '</div>';
        dotsHtml = '<div class="carousel-dots">' +
            allPhotos.map(function(_, i) {
                return '<div class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="changeCarousel(' + i + ')"></div>';
            }).join('') + '</div>';
    }

    var isDark = document.documentElement.classList.contains('dark');
    var bgClass = isDark ? 'bg-[#000a1a]' : 'bg-[#faf8f3]';
    var textClass = isDark ? 'text-[#e8e6e3]' : 'text-[#2c2c2c]';

    // ---- Harga ----
    var priceHtml = '';
    if (p.price) {
        var hasDiscount = p.priceNormal && parseInt(p.priceNormal, 10) > parseInt(p.price, 10);
        priceHtml = '<div class="flex items-baseline gap-3 flex-wrap mt-1">' +
            '<span class="text-2xl md:text-3xl font-black">Rp ' + formatNumber(p.price) + '</span>' +
            (hasDiscount ? '<span class="text-sm line-through opacity-40">Rp ' + formatNumber(p.priceNormal) + '</span>' : '') +
            '</div>';
    }

    // ---- Countdown (khusus snack) ----
    var shippingHtml = '';
    if (isSnack) {
        var days = daysUntilSaturday();
        shippingHtml = '<div class="mb-3 px-3 py-2 rounded-lg bg-current/5 text-xs opacity-60 flex items-center gap-2">' +
            '<i class="fas fa-truck"></i>' +
            '<span>Order sebelum Sabtu — pengiriman ' + days + ' hari lagi</span>' +
            '</div>';
    }

    // ---- Tombol Beli (marketplace popover, muncul ke ATAS dengan animasi) ----
    var beliHtml = '';
    var validMp = (p.marketplaces || []).filter(function(m) { return m.url && m.url.trim() !== '' && m.url !== '#'; });
    if (validMp.length > 0) {
        var popoverItems = validMp.map(function(m) {
            return '<a href="' + m.url + '" target="_blank" rel="noopener" class="mp-link" title="' + (m.name || '') + '">' +
                '<img src="' + getMarketplaceIcon(m.name) + '" alt="' + (m.name || '') + '" onerror="this.parentNode.innerHTML=\'<span class=mp-link-text>' + (m.name || '?') + '</span>\'">' +
                '</a>';
        }).join('');
        beliHtml = '<div class="btn-beli-wrap relative flex-1">' +
            '<div class="marketplace-popover">' + popoverItems + '</div>' +
            '<button type="button" class="beli-btn w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white transition-all flex items-center justify-center gap-2">' +
                '<i class="fas fa-shopping-cart"></i> Beli Sekarang' +
            '</button>' +
        '</div>';
    }

    // ---- Tombol WhatsApp ----
    var waHtml = '';
    var waUrl = getProductWa(p);
    if (waUrl) {
        waHtml = '<a href="' + waUrl + '" target="_blank" rel="noopener" ' +
            'class="py-2.5 px-4 rounded-xl font-bold text-sm border border-current/20 hover:bg-green-500/10 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0">' +
            '<i class="fab fa-whatsapp text-green-400 text-base"></i> Chat' +
            '</a>';
    }

    // Render modal — arrows TIDAK di dalam modal (pointer-events-none di parent)
    postsEl.innerHTML =
        '<div class="relative w-full h-full md:max-h-[85vh] lg:h-[700px] md:max-w-6xl md:w-[95vw] flex items-center justify-center pointer-events-none mx-auto">' +
            '<article class="flex flex-col md:flex-row ' + bgClass + ' ' + textClass + ' sm:rounded-2xl border border-current/10 shadow-2xl w-full h-full overflow-hidden pointer-events-auto transition-all">' +
                // Foto kiri
                '<div class="w-full h-[45%] md:h-full md:w-auto md:aspect-[4/5] bg-black/10 overflow-hidden flex-shrink-0 border-b md:border-b-0 md:border-r border-current/10 relative carousel-wrap group">' +
                    imgHtml + dotsHtml +
                '</div>' +
                // Info kanan
                '<div class="w-full h-[55%] md:h-full md:flex-1 px-5 sm:px-8 py-5 md:py-8 lg:p-10 flex flex-col overflow-hidden relative bg-transparent">' +
                    '<h2 class="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">' + (p.name || 'Produk') + '</h2>' +
                    priceHtml +
                    '<div class="my-3 md:my-4 w-full h-[1px] bg-current/10 hidden md:block"></div>' +
                    '<div class="mb-4 md:mb-6 flex-grow overflow-y-auto pr-2 custom-scrollbar">' +
                        '<p class="text-[0.9rem] md:text-base opacity-80 leading-relaxed whitespace-pre-line">' + (p.description || '') + '</p>' +
                    '</div>' +
                    shippingHtml +
                    '<div class="mt-auto flex gap-2 md:gap-3 w-full">' + beliHtml + waHtml + '</div>' +
                '</div>' +
            '</article>' +
        '</div>';

    // Bind marketplace popover (hover + click toggle)
    postsEl.querySelectorAll('.btn-beli-wrap').forEach(function(wrap) {
        var popover = wrap.querySelector('.marketplace-popover');
        if (!popover) return;
        var timer;
        function show() { clearTimeout(timer); wrap.classList.add('open'); }
        function hide() { timer = setTimeout(function() { wrap.classList.remove('open'); }, 250); }
        wrap.addEventListener('mouseenter', show);
        wrap.addEventListener('mouseleave', hide);
        wrap.querySelector('.beli-btn').addEventListener('click', function(e) {
            e.preventDefault();
            wrap.classList.toggle('open');
        });
        // Close on outside click
        document.addEventListener('click', function onOutside(e) {
            if (!wrap.contains(e.target)) {
                wrap.classList.remove('open');
                document.removeEventListener('click', onOutside);
            }
        });
    });

    // Bind swipe gesture for mobile carousel
    bindCarouselSwipe();

    // Update arrow visibility di overlay level
    updateModalArrows();

    fetch(API + '/api/telemetry/product-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, type: currentTab })
    }).catch(function() {});
  }



  function openDetailView(type, idx) {
    currentTab = type;
    currentList = type === 'snacks' ? snacks : affiliate;
    currentPostIndex = idx;
    
    // Show Modal Overlay
    const modalWrap = document.getElementById('feed-posts-wrap');
    const postsEl = document.getElementById('feed-posts');
    
    modalWrap.classList.remove('hidden');
    modalWrap.classList.add('flex');
    document.getElementById('btn-back-grid').classList.remove('hidden');
    
    // Animate In (Scale & Opacity)
    requestAnimationFrame(() => {
        modalWrap.classList.remove('opacity-0');
        modalWrap.classList.add('opacity-100');
        postsEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        postsEl.classList.remove('scale-95');
        postsEl.classList.add('scale-100');
    });

    renderSinglePost();
    
    // Disable body scroll
    document.body.style.overflow = 'hidden';

    // Event Listener Wheel Hover (hanya saat mouse ada di dalam / atas modal wrapper)
    window.addEventListener('wheel', handleWheelScroll, {passive: false});
  }

  function closeModal() {
      const modalWrap = document.getElementById('feed-posts-wrap');
      const postsEl = document.getElementById('feed-posts');
      
      modalWrap.classList.remove('opacity-100');
      modalWrap.classList.add('opacity-0');
      postsEl.classList.remove('scale-100');
      postsEl.classList.add('scale-95');
      
      setTimeout(() => {
          modalWrap.classList.add('hidden');
          modalWrap.classList.remove('flex');
          document.body.style.overflow = '';
          document.getElementById('btn-back-grid').classList.add('hidden');
      }, 300);
      window.removeEventListener('wheel', handleWheelScroll);
  }

  function handleWheelScroll(e) {
      if(document.getElementById('feed-posts-wrap').classList.contains('hidden')) return;
      if(e.target.closest('.custom-scrollbar')) return; // let text inside scroll
      e.preventDefault(); // Hijack Wheel
      
      if(scrollTimeout) return; 
      if(e.deltaY > 0) navigatePost(1);
      else if(e.deltaY < 0) navigatePost(-1);

      scrollTimeout = setTimeout(() => { scrollTimeout = null; }, 500); 
  }

  // Bind Close Modal
  document.getElementById('btn-back-grid').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  // ----- Tab Indicator Logic -----
  const ind = document.getElementById('tab-indicator');
  
  function moveIndicator(el) {
      if(!ind || !el) return;
      ind.style.width = el.offsetWidth + 'px';
      ind.style.left = el.offsetLeft + 'px';
  }

  document.querySelectorAll('.toko-tabs .tab').forEach(function (tab) {
    if(tab.classList.contains('active')) setTimeout(function(){ moveIndicator(tab); }, 100);
    tab.addEventListener('mouseenter', function() { moveIndicator(tab); });
    tab.addEventListener('mouseleave', function() {
        const activeTab = document.querySelector('.toko-tabs .tab.active');
        if(activeTab) moveIndicator(activeTab);
    });

    tab.addEventListener('click', function () {
      var newTab = tab.dataset.tab;
      document.querySelectorAll('.toko-tabs .tab').forEach(function (t) { 
        t.classList.remove('active'); t.style.opacity = "0.3"; 
      });
      tab.classList.add('active'); tab.style.opacity = "1";
      currentTab = newTab;
      moveIndicator(tab);

      // Change Feed Content
      document.getElementById('feed-snacks').classList.add('hidden');
      document.getElementById('feed-affiliate').classList.add('hidden');
      document.getElementById('feed-' + currentTab).classList.remove('hidden');
    });
  });
  
  window.addEventListener('resize', function() {
      const activeTab = document.querySelector('.toko-tabs .tab.active');
      if(activeTab) moveIndicator(activeTab);
  });

  // ----- Initial Loading (Auto-detect: GitHub Pages vs Lokal/VPS) -----
  function loadAllData() {
    if (IS_STATIC_MODE) {
      // Mode GitHub Pages: 1 file data.json berisi semua data
      return fetch('/data.json')
        .then(function(r) { return r.json(); })
        .then(function(d) { return [d.profile, d.links, d.snacks || [], d.affiliate || []]; });
    } else {
      // Mode Lokal / VPS: pakai API seperti biasa
      return Promise.all([
        fetch(API + '/api/profile').then(function(r) { return r.json(); }),
        fetch(API + '/api/links').then(function(r) { return r.json(); }),
        fetch(API + '/api/products/snacks').then(function(r) { return r.json(); }),
        fetch(API + '/api/products/affiliate').then(function(r) { return r.json(); })
      ]);
    }
  }

  loadAllData().then(function (arr) {
    profile = arr[0]; links = arr[1]; snacks = arr[2]; affiliate = arr[3];
    renderProfile(); renderLinks();
    renderFeed(snacks, 'feed-snacks'); renderFeed(affiliate, 'feed-affiliate');
  }).catch(function () {
    console.warn('Gagal memuat data. Pastikan server berjalan (mode lokal) atau file data.json ada (mode GitHub Pages).');
  });
})();
