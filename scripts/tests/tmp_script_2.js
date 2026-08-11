
    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // ─── DATA ───────────────────────────────────
    const state = {
      page: 'home',
      coupon: null,
      couponDiscount: 0,
      cart: [],
      wishlist: [],
      user: null,
      currentProduct: null,
      detailQty: 1,
      shopFilter: 'All',
      checkoutStep: 1,
      authMode: 'login',
      checkoutData: {},
      accTab: 'orders',
      token: localStorage.getItem('facelook_token') || null
    };

    if (state.token) {
      try {
        const payload = JSON.parse(atob(state.token.split('.')[1]));
        state.user = { name: payload.name, email: payload.email, id: payload.id };
      } catch (e) {
        state.token = null;
        localStorage.removeItem('facelook_token');
      }
    }

    let PRODUCTS = [];

    // Connect to localhost backend when developing locally, otherwise use Render production URL
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';
    const API_BASE = isLocal ? 'http://localhost:3000' : 'https://facelook-backend.onrender.com';

    async function api(url, method = 'GET', body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
      const res = await fetch(API_BASE + url, { method, headers, body: body ? JSON.stringify(body) : null });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API Error');
      return data;
    }

    // ─── NAVIGATION ─────────────────────────────
    function renderPage(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
      const bnMap = { home: 'bn-home', shop: 'bn-shop', wishlist: 'bn-wishlist', cart: 'bn-cart', auth: 'bn-auth', product: 'bn-shop' };
      const navEl = document.getElementById(bnMap[page]);
      if (navEl) navEl.classList.add('active');
      state.page = page;
      window.scrollTo(0, 0);
      if (page === 'home') renderHome();
      if (page === 'shop') renderShop();
      if (page === 'cart') renderCart();
      if (page === 'wishlist') renderWishlist();
      if (page === 'checkout') { state.checkoutStep = 1; renderCheckout(); }
      if (page === 'auth') {
         if(state.token) { goTo('account'); return; }
      }
      if (page === 'account') {
         if(!state.token) { goTo('auth'); return; }
         renderAccount();
      }
    }

    // --- ROUTING & SEO ---
    function slugify(text) {
      return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
    }

    function updateSEO(title, desc, image) {
      const fullTitle = title ? `${title} | Facelook Cosmetics` : 'Facelook Cosmetics';
      document.title = fullTitle;
      
      const updateMeta = (nameAttr, nameVal, content) => {
        let el = document.querySelector(`meta[${nameAttr}="${nameVal}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(nameAttr, nameVal);
          document.head.appendChild(el);
        }
        el.content = content;
      };

      if (desc) {
        updateMeta('name', 'description', desc);
        updateMeta('property', 'og:description', desc);
      }
      
      updateMeta('property', 'og:title', fullTitle);
      if (image) {
        updateMeta('property', 'og:image', image);
      }
    }

    function injectJSONLD(product) {
      let script = document.getElementById('product-ld');
      if (script) script.remove();
      
      script = document.createElement('script');
      script.id = 'product-ld';
      script.type = 'application/ld+json';
      const ld = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "image": "https://www.facelookcosmetics.in/assets/" + (product.image || 'default.webp'),
        "description": product.desc,
        "sku": product.id.toString(),
        "brand": {
          "@type": "Brand",
          "name": "Facelook Cosmetics"
        },
        "offers": {
          "@type": "Offer",
          "url": "https://www.facelookcosmetics.in/product/" + product.slug,
          "priceCurrency": "INR",
          "price": product.price,
          "availability": "https://schema.org/InStock"
        }
      };
      script.textContent = JSON.stringify(ld);
      document.head.appendChild(script);
    }

    function clearJSONLD() {
      const script = document.getElementById('product-ld');
      if (script) script.remove();
    }

    function navigate(path, push = true) {
      if (push) {
        window.history.pushState(null, '', path);
      }
      handleRoute();
    }

    function handleRoute() {
      const path = window.location.pathname;
      
      if (path.startsWith('/product/')) {
        const slug = path.split('/product/')[1];
        if (slug) {
          const p = PRODUCTS.find(x => x.slug === slug);
          if (p) {
            openProduct(p.id, false); // false means don't push state again
            return;
          }
        }
        navigate('/'); // fallback
      } else if (path.startsWith('/category/')) {
        const cat = path.split('/category/')[1];
        state.shopFilter = cat.charAt(0).toUpperCase() + cat.slice(1); // naive capitalize
        renderPage('shop');
        updateSEO(`Shop ${state.shopFilter}`, `Browse our ${state.shopFilter} category.`);
        clearJSONLD();
      } else {
        let page = path.replace('/', '') || 'home';
        if (page === 'order-details' && !state.orders) {
          navigate('/account');
          return;
        }
        // Handle old hash paths if they exist
        if (page === 'shop') state.shopFilter = 'All';
        renderPage(page);
        
        let seoTitles = {
          'home': 'Home',
          'shop': 'Shop All',
          'cart': 'Shopping Cart',
          'account': 'My Account',
          'contact': 'Contact Us',
          'privacy': 'Privacy Policy',
          'terms': 'Terms & Conditions',
          'shipping': 'Shipping Policy',
          'refund': 'Refund Policy'
        };
        updateSEO(seoTitles[page] || 'Home', '');
        clearJSONLD();
      }
    }

    window.addEventListener('popstate', () => {
      handleRoute();
    });

    function goTo(page) {
      if (page === 'home') navigate('/');
      else navigate('/' + page);
    }

    function shopByFilter(filter) {
      navigate('/category/' + filter.toLowerCase());
    }

    

    function handleGlobalSearch(el) {
      const q = el.value;
      if (state.page !== 'shop') {
        state.shopFilter = 'All';
        goTo('shop');
      }
      const shopInput = document.getElementById('shop-search');
      if (shopInput) {
        shopInput.value = q;
        renderShop();
        // Keep focus on the shop input if we just navigated
        if (el.id !== 'nav-search') {
          shopInput.focus();
        }
      }
      
      // Sync other search boxes
      const navSearch = document.getElementById('nav-search');
      const homeSearch = document.getElementById('home-search');
      if (navSearch && navSearch !== el) navSearch.value = q;
      if (homeSearch && homeSearch !== el) homeSearch.value = q;
    }

    function shopByFilter(filter) {
      if (filter.toLowerCase() === 'all') {
        navigate('/shop');
      } else {
        navigate('/category/' + filter.toLowerCase());
      }
    }

    // ─── TOAST ──────────────────────────────────
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = '✓ ' + msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2400);
    }



    // ─── TRACKING ────────────────────────────────
    async function submitTracking() {
      const oid = document.getElementById('track-order-id').value;
      if(!oid) {
        showToast('Please enter an Order ID');
        return;
      }
      
      const resContainer = document.getElementById('track-result');
      resContainer.style.display = 'block';
      resContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Fetching status...</div>';
      
      try {
        const res = await fetch('/api/track/' + encodeURIComponent(oid));
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        
        let timelineHTML = '';
        data.tracking.forEach(t => {
            timelineHTML += `
            <div class="timeline-step ${t.status}">
              <div class="timeline-title">${t.title}</div>
              <div class="timeline-date">${t.date}</div>
            </div>`;
        });
        
        resContainer.innerHTML = `
          <h4 style="margin-bottom: 12px;">Order Status: <span style="color:var(--rose);">${data.tracking.find(t => t.status === 'active')?.title || 'Completed'}</span></h4>
          <div class="timeline">
            ${timelineHTML}
          </div>
        `;
      } catch (err) {
        resContainer.innerHTML = '<div style="color:red; text-align:center;">Order not found. Please check your Order ID.</div>';
      }
    }

    // ─── REVIEWS ──────────────────────────────────
    async function renderReviews() {
      const list = document.getElementById('reviews-list');
      if (!list) return;
      if (!state.currentProduct) return;
      
      try {
        list.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--tm);">Loading reviews...</div>';
        const res = await api('/api/reviews/' + state.currentProduct.id);
        const reviews = res.reviews || [];
        
        let avgRating = 0;
        if (reviews.length > 0) {
            avgRating = (reviews.reduce((a,b) => a+b.rating, 0) / reviews.length).toFixed(1);
        }
        
        const summaryHTML = `
          <div class="reviews-summary">
            <div>
              <div class="reviews-rating-big">${avgRating > 0 ? avgRating : '0.0'}</div>
              <div class="reviews-rating-stars">${stars(avgRating > 0 ? avgRating : 0)}</div>
              <div class="reviews-rating-count">Based on ${reviews.length} reviews</div>
            </div>
            <div style="flex:1;">
               <div style="font-size:13px; color:var(--tm); line-height:1.6;">
                 ${reviews.length > 0 ? 'Verified customer feedback.' : 'Be the first to review this product!'}
               </div>
            </div>
          </div>
        `;
        
        const writeBtn = `<div style="text-align:center; margin-top: 10px;"><button class="btn btn-primary" style="padding: 10px 24px; font-size: 14px;" onclick="openReviewModal()">Write a Review</button></div>`;

        if (reviews.length === 0) {
           list.innerHTML = summaryHTML + '<div style="padding: 20px; text-align: center; color: var(--tm); padding-bottom: 5px;">No reviews yet. Write one!</div>' + writeBtn;
           return;
        }

        const reviewsHTML = reviews.map(r => {
          const initials = r.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
          const dateStr = new Date(r.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
          return `
          <div class="review-card" style="padding: 24px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <div class="review-card-header">
              <div class="review-avatar">${initials}</div>
              <div>
                <div class="review-meta" style="font-weight:600; color:var(--td); font-size:14px;">${r.name} <span class="review-verified">✓ Verified Buyer</span></div>
                <div class="review-stars">${stars(r.rating)} <span style="color:var(--tl); font-size:12px; margin-left:6px;">${dateStr}</span></div>
              </div>
            </div>
            <div class="review-title" style="font-size:15px; margin-bottom:8px;">${r.title}</div>
            <div class="review-body" style="font-size:14px; line-height:1.6; color:#444;">${r.body}</div>
          </div>
        `}).join('');
        
        list.innerHTML = summaryHTML + reviewsHTML + writeBtn;
      } catch(e) {
        list.innerHTML = '<div style="padding: 20px; color: red;">Error loading reviews</div>';
      }
    }

    function openReviewModal() {
      document.getElementById('review-modal-overlay').classList.add('active');
    }

    function closeReviewModal() {
      document.getElementById('review-modal-overlay').classList.remove('active');
    }

    async function submitReview() {
      const name = document.getElementById('review-name').value;
      const title = document.getElementById('review-title').value;
      const body = document.getElementById('review-body').value;
      const rating = document.getElementById('review-rating').value;
      
      if(!name || !title || !body) return showToast("All fields required");
      
      try {
          const res = await api('/api/reviews', 'POST', {
             productId: state.currentProduct.id,
             name, title, body, rating
          });
          closeReviewModal();
          showToast('Review submitted successfully!');
          document.getElementById('review-name').value = '';
          document.getElementById('review-title').value = '';
          document.getElementById('review-body').value = '';
          renderReviews();
      } catch(e) {
          showToast(e.message || "Error submitting review");
      }
    }

    // ─── STARS ──────────────────────────────────
    function stars(n) {
      return '★'.repeat(Math.floor(n)) + '☆'.repeat(5 - Math.floor(n));
    }

    // ─── PRODUCT CARD HTML ───────────────────────
    function productCardHTML(p, extraStyle = '') {
      const inWish = state.wishlist.find(w => w.id === p.id);
      const disc = Math.round((1 - p.price / p.orig) * 100);
      
      let swatchesHTML = '';
      if (p.palette && p.palette.length > 0 && !p.name.toLowerCase().includes('compact') && !p.name.toLowerCase().includes('cover me')) {
        const displayPalettes = p.palette.slice(0, 4);
        const extraCount = p.palette.length - 4;
        swatchesHTML = `<div class="grid-swatches-container">` + 
          displayPalettes.map(c => `<div class="grid-swatch" style="background:${c.hex};" title="${c.name}"></div>`).join('') +
          (extraCount > 0 ? `<div class="grid-swatch-more">+${extraCount}</div>` : '') +
          `</div>`;
      }

      return `
    <a href="/product/${p.slug}" onclick="event.preventDefault(); openProduct(${p.id})" target="_blank" class="product-card" data-id="${p.id}" style="${extraStyle}; text-decoration:none; color:inherit; display:block;">
      <div class="product-img">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;">` : `<span style="font-size:50px;">${p.emoji || '💄'}</span>`}
        ${p.tag ? `<span class="product-tag">${p.tag}</span>` : ''}
        <button class="product-wish ${inWish ? 'active' : ''}" onclick="event.preventDefault();event.stopPropagation();toggleWish(${p.id})">${inWish ? '♥' : '♡'}</button>
        <span class="product-discount">${disc}% OFF</span>
        ${p.stock === 0 ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none;"><span style="background:var(--danger, #ea5455);color:#fff;padding:6px 12px;border-radius:4px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;box-shadow:var(--shadow-sm);">Out of Stock</span></div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-stars">${stars(p.rating)}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-shade">${p.shade}</div>
        ${p.stock > 0 && p.stock <= 10 ? `<div style="color:var(--danger, #ea5455);font-size:11px;font-weight:700;margin-top:2px;letter-spacing:0.5px;">Only ${p.stock} left in stock!</div>` : ''}
        ${swatchesHTML}
        <div class="product-row" style="margin-top: 8px;">
          <div><span class="product-price">₹${p.price}</span><span class="product-orig">₹${p.orig}</span></div>
          ${p.stock === 0 ? 
            `<button class="add-cart-btn" style="background:#e0e0e0;color:#999;cursor:not-allowed;" onclick="event.preventDefault();event.stopPropagation();">Sold</button>` :
            `<button class="add-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToCart(${p.id})">+</button>`
          }
        </div>
      </div>
    </a>`;
    }

    // ─── HOME ────────────────────────────────────
    function renderHome() {
      const feat = document.getElementById('home-featured');
      feat.innerHTML = PRODUCTS.slice(0, 5).map(p => productCardHTML(p, 'flex-shrink:0;')).join('');
      const best = document.getElementById('home-bestsellers');
      best.innerHTML = PRODUCTS.slice(0, 4).map(p => productCardHTML(p)).join('');
    }

    // ─── SHOP ────────────────────────────────────
    const CATS = ['All', 'Lips', 'Eyes', 'Face', 'Nails'];

    function renderFilterTabs() {
      const el = document.getElementById('filter-tabs');
      el.innerHTML = CATS.map(c => `<button class="filter-tab ${state.shopFilter === c || state.shopFilter === c ? '' : ''}${c === state.shopFilter ? 'active' : ''}" onclick="setFilter('${c}')">${c}</button>`).join('');
    }

    function setFilter(cat) {
      if (cat.toLowerCase() === 'all') {
        navigate('/shop');
      } else {
        navigate('/category/' + cat.toLowerCase());
      }
    }

    function clearSearch() {
      document.getElementById('shop-search').value = '';
      const navSearch = document.getElementById('nav-search');
      const homeSearch = document.getElementById('home-search');
      if (navSearch) navSearch.value = '';
      if (homeSearch) homeSearch.value = '';
      document.getElementById('clear-search').style.display = 'none';
      renderShop();
    }

    function renderShop() {
      renderFilterTabs();
      const q = (document.getElementById('shop-search') || {}).value || '';
      const sort = (document.getElementById('sort-select') || {}).value || 'popular';
      const clearBtn = document.getElementById('clear-search');
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

      let list = PRODUCTS
        .filter(p => state.shopFilter === 'All' || (p.cat || '').toLowerCase() === state.shopFilter.toLowerCase() || (p.tag || '').toLowerCase() === state.shopFilter.toLowerCase())
        .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.shade || '').toLowerCase().includes(q.toLowerCase()));

      if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
      else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
      else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
      else list.sort((a, b) => b.reviews - a.reviews);

      document.getElementById('sort-count').textContent = list.length + ' products';
      const grid = document.getElementById('shop-grid');
      const empty = document.getElementById('shop-empty');
      if (list.length === 0) {
        grid.innerHTML = ''; grid.style.display = 'none'; empty.style.display = 'flex';
      } else {
        empty.style.display = 'none'; grid.style.display = 'grid';
        grid.innerHTML = list.map(p => productCardHTML(p)).join('');
      }
    }

    // ─── PRODUCT DETAIL ──────────────────────────
    function selectPaletteShade(index, pid) {
      const p = PRODUCTS.find(x => x.id === pid);
      if (!p || !p.palette || !p.palette[index]) return;
      const shadeData = p.palette[index];

      const mainImg = document.getElementById('main-detail-img');
      const isCompact = p.name && (p.name.toLowerCase().includes('cover me') || p.name.toLowerCase().includes('compact'));
      let fallbackImg = (p.images && p.images.length > 0) ? p.images[0] : p.image;
      if (mainImg) {
        if (!isCompact) {
          mainImg.src = shadeData.image || fallbackImg;
          mainImg.style.objectFit = 'contain';
        }
      } else {
        document.getElementById('detail-emoji').innerHTML = `<img src="${isCompact ? fallbackImg : (shadeData.image || fallbackImg)}" id="main-detail-img" style="width:100%;object-fit:contain;">`;
      }

      document.getElementById('detail-shade').innerHTML = 'Shade: <span style="font-weight:600;color:var(--td);">' + shadeData.name + '</span>';

      document.querySelectorAll('#detail-palette-dots .shade-dot').forEach((el, i) => {
        el.classList.toggle('active', i === index);
      });
      
      // Sync thumbnail active state
      document.querySelectorAll('.thumb-img').forEach((el, i) => {
        el.classList.toggle('active', i === index);
      });
    }
    function swapDetailImage(src, el, pid, idx) {
      const mainImg = document.getElementById('main-detail-img');
      if (mainImg) {
        mainImg.src = src;
        mainImg.style.objectFit = 'contain';
      }
      document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
      if (el) el.classList.add('active');
      
      // Sync palette shade active state and text
      if (typeof idx !== 'undefined') {
        const p = PRODUCTS.find(x => x.id === pid);
        if (p && p.palette && p.palette[idx]) {
          document.getElementById('detail-shade').innerHTML = 'Shade: <span style="font-weight:600;color:var(--td);">' + p.palette[idx].name + '</span>';
          document.querySelectorAll('#detail-palette-dots .shade-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
          });
        }
      }
    }

    function navDetailImage(dir) {
      // First check for active thumbnail
      let activeThumb = document.querySelector('.thumb-img.active');
      if (activeThumb) {
        let allThumbs = Array.from(document.querySelectorAll('.thumb-img'));
        let idx = allThumbs.indexOf(activeThumb);
        let nextIdx = (idx + dir + allThumbs.length) % allThumbs.length;
        allThumbs[nextIdx].click();
        allThumbs[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        return;
      }
      // If no thumbnail, check for active palette dot
      let activeDot = document.querySelector('.shade-dot.active');
      if (activeDot) {
        let allDots = Array.from(document.querySelectorAll('#detail-palette-dots .shade-dot'));
        let idx = allDots.indexOf(activeDot);
        let nextIdx = (idx + dir + allDots.length) % allDots.length;
        allDots[nextIdx].click();
        return;
      }
    }

    function openProduct(id, push = true) {
      const p = PRODUCTS.find(x => x.id === id);
      if (!p) return;
      if (push) window.history.pushState(null, '', '/product/' + p.slug);
      updateSEO(p.name, p.desc);
      injectJSONLD(p);
      state.currentProduct = p;
      state.detailQty = 1;
      const disc = Math.round((1 - p.price / p.orig) * 100);
      const inW = state.wishlist.find(w => w.id === p.id);

      let mainSrc = p.image;
      if (p.images && p.images.length > 0) mainSrc = p.images[0];

      document.getElementById('detail-emoji').innerHTML = mainSrc ? `<img src="${mainSrc}" id="main-detail-img" style="width:100%;object-fit:contain;">` : (p.emoji || '💄');

      const isCompactProduct = p.name && (p.name.toLowerCase().includes('cover me') || p.name.toLowerCase().includes('compact'));

      const thumbGallery = document.getElementById('thumbnail-gallery');
      let galleryImages = [];
      if (p.images && p.images.length > 0) {
        galleryImages = [...p.images];
      }
      if (isCompactProduct && p.palette && p.palette.length > 0) {
        p.palette.forEach(sh => {
          if (sh.image && !galleryImages.includes(sh.image)) {
            galleryImages.push(sh.image);
          }
        });
      }

      if (galleryImages.length > 1) {
        thumbGallery.style.display = 'flex';
        thumbGallery.innerHTML = galleryImages.map((src, idx) =>
          `<img src="${src}" class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="swapDetailImage('${src}', this, ${p.id}, ${idx})">`
        ).join('');
      } else {
        thumbGallery.style.display = 'none';
        thumbGallery.innerHTML = '';
      }

      document.getElementById('detail-cat').textContent = p.cat;
      document.getElementById('detail-breadcrumb').textContent = p.name;
      document.getElementById('detail-name').textContent = p.name;
      const shadeEl = document.getElementById('detail-shade');
      if (isCompactProduct) {
        shadeEl.style.display = 'none';
      } else {
        shadeEl.style.display = 'block';
        shadeEl.innerHTML = 'Shade: <span style="font-weight:600;color:var(--td);">' + p.shade + '</span>';
      }

      const palContainer = document.getElementById('detail-palette-container');
      const palDots = document.getElementById('detail-palette-dots');
      if (p.palette && p.palette.length > 0 && !isCompactProduct) {
        palContainer.style.display = 'block';
        palDots.innerHTML = p.palette.map((item, idx) =>
          `<div class="shade-dot ${idx === 0 ? 'active' : ''}" style="background:${item.hex};" title="${item.name}" onclick="selectPaletteShade(${idx}, ${p.id})"></div>`
        ).join('');

        selectPaletteShade(0, p.id);
      } else {
        palContainer.style.display = 'none';
        palDots.innerHTML = '';
      }
      
      const hasThumbnails = galleryImages.length > 1;
      const hasPalette = p.palette && p.palette.length > 1 && !isCompactProduct;
      const prevBtn = document.getElementById('detail-prev-btn');
      const nextBtn = document.getElementById('detail-next-btn');
      if (hasThumbnails || hasPalette) {
        if(prevBtn) prevBtn.style.display = 'flex';
        if(nextBtn) nextBtn.style.display = 'flex';
      } else {
        if(prevBtn) prevBtn.style.display = 'none';
        if(nextBtn) nextBtn.style.display = 'none';
      }

      document.getElementById('detail-price').textContent = '₹' + p.price;
      document.getElementById('detail-orig').textContent = '₹' + p.orig;
      document.getElementById('detail-discount').textContent = disc + '% OFF';
      document.getElementById('detail-stars').textContent = stars(p.rating);
      document.getElementById('detail-reviews').textContent = '(' + p.reviews + ' reviews)';
      document.getElementById('detail-desc').textContent = p.desc || 'No description available.';
      document.getElementById('detail-country-of-origin').textContent = p.countryOfOrigin || 'India';
      document.getElementById('detail-delivery-info').textContent = p.deliveryInfo || 'Free standard shipping on all orders over ₹500. Cash on delivery is available for most locations.';
      document.getElementById('detail-how-to-use').textContent = p.howToUse || 'Apply directly from the bullet or use a brush for precision. Build coverage as desired.';
      document.getElementById('detail-ingredients').textContent = p.ingredients || 'Enriched with essential oils and natural extracts to nourish your skin.';
      document.getElementById('detail-other-info').textContent = p.otherInfo || 'Store in a cool, dry place away from direct sunlight.';
      document.getElementById('detail-qty').textContent = state.detailQty;
      
      const stockWarning = document.getElementById('detail-stock-warning');
      if (p.stock > 0 && p.stock <= 10) {
        stockWarning.textContent = `Only ${p.stock} left in stock!`;
        stockWarning.style.display = 'block';
      } else {
        stockWarning.style.display = 'none';
      }
      document.getElementById('detail-tag-badge').innerHTML = p.tag ? `<span style="background:var(--rose);color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">${p.tag}</span>` : '';
      document.getElementById('detail-tag-label').innerHTML = p.tag ? `<span style="background:var(--pale);color:var(--rose);font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">${p.tag}</span>` : '';
      const stickyBtn = document.getElementById('sticky-add-btn');
      const mainAddBtn = document.getElementById('main-add-btn');
      const mainBuyBtn = document.getElementById('main-buy-btn');

      if (p.stock === 0) {
        if (stickyBtn) {
          stickyBtn.textContent = 'Out of Stock';
          stickyBtn.style.background = '#e0e0e0';
          stickyBtn.style.color = '#999';
          stickyBtn.style.cursor = 'not-allowed';
          stickyBtn.onclick = (e) => { e.preventDefault(); };
        }
        if (mainAddBtn) {
          mainAddBtn.textContent = 'Out of Stock';
          mainAddBtn.style.background = '#e0e0e0';
          mainAddBtn.style.color = '#999';
          mainAddBtn.style.cursor = 'not-allowed';
          mainAddBtn.onclick = (e) => { e.preventDefault(); };
        }
        if (mainBuyBtn) {
          mainBuyBtn.style.display = 'none';
        }
      } else {
        if (stickyBtn) {
          stickyBtn.textContent = '🛒 Add to Cart — ₹' + p.price;
          stickyBtn.style.background = '';
          stickyBtn.style.color = '';
          stickyBtn.style.cursor = 'pointer';
          stickyBtn.onclick = () => addDetailToCart();
        }
        if (mainAddBtn) {
          mainAddBtn.textContent = 'Add to Cart';
          mainAddBtn.style.background = '';
          mainAddBtn.style.color = '';
          mainAddBtn.style.cursor = 'pointer';
          mainAddBtn.onclick = () => addDetailToCart();
        }
        if (mainBuyBtn) {
          mainBuyBtn.style.display = 'block';
        }
      }

      const wishBtn = document.getElementById('detail-wish-btn');
      wishBtn.textContent = inW ? '♥' : '♡';
      wishBtn.classList.toggle('active', !!inW);

      // Related
      const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
      document.getElementById('related-products').innerHTML = related.map(r => productCardHTML(r, 'width:140px;flex-shrink:0;')).join('');

      renderReviews();
      renderPage('product');
    }

    function changeQty(delta) {
      if (!state.currentProduct) return;
      let newQty = state.detailQty + delta;
      if (newQty < 1) newQty = 1;
      if (newQty > state.currentProduct.stock) {
        showToast(`Only ${state.currentProduct.stock} units available.`);
        newQty = state.currentProduct.stock;
      }
      state.detailQty = newQty;
      document.getElementById('detail-qty').textContent = state.detailQty;
    }

    async function addDetailToCart() {
      if (!state.currentProduct) return;
      if (!state.token) { showToast("Please log in first"); return goTo('auth'); }
      try {
        await api('/api/cart', 'POST', { product_id: state.currentProduct.id, qty: state.detailQty });
        state.cart = await api('/api/cart');
        updateBadges();
        showToast(state.detailQty + '× ' + state.currentProduct.name + ' added!');
      } catch (err) { showToast(err.message); }
    }

    function buyNow() {
      if (!state.token) { showToast("Please log in first"); return goTo('auth'); }
      addDetailToCart().then(() => goTo('cart'));
    }

    function toggleAccordion(btn) {
      const item = btn.parentElement;
      if (item.classList.contains('active')) {
        item.classList.remove('active');
      } else {
        item.classList.add('active');
      }
    }

    async function toggleDetailWish() {
      if (!state.currentProduct) return;
      await toggleWish(state.currentProduct.id);
      const inW = state.wishlist.find(w => w.id === state.currentProduct.id);
      const btn = document.getElementById('detail-wish-btn');
      if (btn) {
        btn.textContent = inW ? '♥' : '♡';
        btn.classList.toggle('active', !!inW);
      }
    }

    // ─── CART ────────────────────────────────────
    async function addToCart(id) {
      if (!state.token) { showToast("Please log in first"); return goTo('auth'); }
      try {
        await api('/api/cart', 'POST', { product_id: id, qty: 1 });
        state.cart = await api('/api/cart');
        updateBadges();
        const p = PRODUCTS.find(x => x.id === id);
        showToast(p.name + ' added to cart');
      } catch (err) { showToast(err.message); }
    }

    async function removeFromCart(id) {
      try {
        await api(`/api/cart/${id}`, 'DELETE');
        state.cart = await api('/api/cart');
        updateBadges();
        renderCart();
      } catch (err) { showToast(err.message); }
    }

    async function updateCartQty(id, delta) {
      const item = state.cart.find(i => (i.product_id === id || i.id === id));
      if (!item) return;
      const newQty = Math.max(0, item.qty + delta);
      if (newQty === 0) removeFromCart(id);
      else {
        try {
          await api(`/api/cart/${id}`, 'PUT', { qty: newQty });
          state.cart = await api('/api/cart');
          updateBadges();
          renderCart();
        } catch (err) { showToast(err.message); }
      }
    }

    function renderCart() {
      const el = document.getElementById('cart-content');
      if (state.cart.length === 0) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <div class="empty-title">Your cart is empty</div>
        <p class="empty-sub">Looks like you haven't added anything yet.</p>
        <button class="btn btn-primary" onclick="goTo('shop')">Start Shopping</button>
      </div>`;
        return;
      }
      const sub = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
      const ship = sub >= 599 ? 0 : 49;
      el.innerHTML = `
    <div class="cart-header">Cart (${state.cart.reduce((a, i) => a + i.qty, 0)} items)</div>
    <div class="cart-items">
      ${state.cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-img">${item.image ? `<img src="${item.image}">` : (item.emoji || '💄')}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-shade">${item.shade}</div>
            <div class="cart-item-row">
              <div class="cart-qty">
                <button class="cart-qty-btn" onclick="updateCartQty(${item.id},-1)">−</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button class="cart-qty-btn" onclick="updateCartQty(${item.id},1)">+</button>
              </div>
              <span class="cart-item-price">₹${item.price * item.qty}</span>
            </div>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${item.id})">🗑️</button>
        </div>`).join('')}
    </div>
    <div class="order-summary">
      <div class="summary-title">Order Summary</div>
      <div class="summary-row"><span>Subtotal</span><span>₹${sub}</span></div>
      <div class="summary-row"><span>Shipping</span><span style="color:${ship === 0 ? 'var(--rose-d)' : 'var(--tm)'}">${ship === 0 ? '🎉 FREE' : '₹' + ship}</span></div>
      ${state.coupon ? `<div class="summary-row"><span style="color:var(--rose-d)">Discount (${state.coupon.code}) <button style="background:none;border:none;cursor:pointer;font-size:10px" onclick="removeCoupon()">✕</button></span><span style="color:var(--rose-d)">-₹${state.couponDiscount}</span></div>` : ''}
      <div class="summary-total"><span>Total</span><span style="color:var(--rose-d)">₹${Math.max(0, sub + ship - state.couponDiscount)}</span></div>
    </div>
    <div style="padding:0 16px;">
      ${!state.coupon ? `
      <div style="display:flex; gap:8px; margin-bottom: 16px;">
        <input type="text" id="cart-coupon-input" placeholder="Promo code" style="flex:1; border:1px solid var(--border); background:var(--card); color:var(--td); padding:8px 12px; border-radius:4px; text-transform:uppercase;">
        <button class="btn btn-secondary" onclick="applyCartCoupon()">Apply</button>
      </div>` : ''}
    </div>
    <div style="padding:0 16px 16px;">
      <button class="btn btn-primary btn-full" onclick="goTo('checkout')">Proceed to Checkout — ₹${Math.max(0, sub + ship - state.couponDiscount)}</button>
    </div>`;
    }

    async function applyCartCoupon() {
      const code = document.getElementById('cart-coupon-input').value;
      if (!code) return showToast('Please enter a coupon code');
      const sub = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
      try {
        const res = await api('/api/coupons/validate', 'POST', { code, cartTotal: sub });
        state.coupon = res.coupon;
        state.couponDiscount = res.discount;
        showToast('Coupon applied successfully!');
        renderCart();
        renderCheckout();
      } catch (err) {
        showToast(err.message);
        state.coupon = null;
        state.couponDiscount = 0;
        renderCart();
      }
    }
    
    function removeCoupon() {
      state.coupon = null;
      state.couponDiscount = 0;
      showToast('Coupon removed');
      renderCart();
      renderCheckout();
    }

    // ─── WISHLIST ────────────────────────────────
    async function toggleWish(id) {
      if (!state.token) { showToast("Please log in first"); return goTo('auth'); }
      try {
        const res = await api('/api/wishlist/toggle', 'POST', { product_id: id });
        if (res.status === 'removed') showToast('Removed from wishlist');
        else showToast('Saved to wishlist ♥');

        state.wishlist = await api('/api/wishlist');
        updateBadges();

        document.querySelectorAll('.product-wish').forEach(btn => {
          const card = btn.closest('.product-card');
          if (!card) return;
          const pid = parseInt(card.getAttribute('data-id'));
          if (!pid) return;
          const inW = state.wishlist.find(w => w.id === pid);
          btn.textContent = inW ? '♥' : '♡';
          btn.classList.toggle('active', !!inW);
        });
      } catch (err) { showToast(err.message); }
    }

    function renderWishlist() {
      const el = document.getElementById('wishlist-content');
      if (state.wishlist.length === 0) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♡</div>
        <div class="empty-title">Your wishlist is empty</div>
        <p class="empty-sub">Heart products you love to save them here.</p>
        <button class="btn btn-primary" onclick="goTo('shop')">Explore Products</button>
      </div>`;
        return;
      }
      el.innerHTML = `
    <div class="wish-header">Wishlist (${state.wishlist.length})</div>
    <div class="products-grid" style="padding:12px 16px;">
      ${state.wishlist.map(p => productCardHTML(p)).join('')}
    </div>`;
    }

    // ─── CHECKOUT ────────────────────────────────
    function renderCheckout() {
      const s = state.checkoutStep;
      const sub = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
      const ship = sub >= 599 ? 0 : 49;
      const total = sub + ship;

      // Steps bar
      const stepLabels = ['Delivery', 'Payment', 'Confirm'];
      document.getElementById('checkout-steps').innerHTML = stepLabels.map((lb, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <div class="step-dot" style="background:${s > i + 1 ? 'var(--rose-d)' : s === i + 1 ? 'var(--rose)' : 'var(--nude-dark)'};color:${s >= i + 1 ? '#fff' : 'var(--tm)'};">${s > i + 1 ? '✓' : i + 1}</div>
      <span class="step-label" style="color:${s === i + 1 ? 'var(--rose)' : 'var(--tl)'};font-weight:${s === i + 1 ? 700 : 400};">${lb}</span>
      ${i < 2 ? '<span class="step-sep">›</span>' : ''}
    </div>`).join('');

      if (s === 3) {
        document.getElementById('checkout-steps').style.display = 'none';
        document.getElementById('checkout-footer').innerHTML = '';
        document.getElementById('checkout-content').innerHTML = `
      <div class="success-page">
        <div style="font-size:72px;margin-bottom:16px;">🎉</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:36px;color:var(--rose-d);letter-spacing:2px;margin-bottom:8px;">ORDER PLACED!</div>
        <p style="font-family:'Playfair Display',serif;font-style:italic;font-size:16px;color:var(--tm);margin-bottom:6px;">Thank you, ${state.checkoutData.name || 'lovely'}!</p>
        <p style="font-size:13px;color:var(--tl);margin-bottom:28px;">Your order will arrive in 3–5 business days 💄</p>
        <button class="btn btn-primary" onclick="state.cart=[];updateBadges();goTo('home');">Back to Home</button>
      </div>`;
        return;
      }

      const d = state.checkoutData;
      if (s === 1) {
        document.getElementById('checkout-content').innerHTML = `
      <div class="form-section">
        <div class="form-title">Delivery Address</div>
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="co-name" value="${d.name || ''}" placeholder="Your full name"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="co-email" type="email" value="${d.email || state.user?.email || ''}" placeholder="your@email.com"></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="co-phone" type="tel" value="${d.phone || ''}" placeholder="10-digit number"></div>
        <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="co-addr" value="${d.address || ''}" placeholder="House, Street, Area"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">City</label><input class="form-input" id="co-city" value="${d.city || ''}" placeholder="City"></div>
          <div class="form-group"><label class="form-label">Pincode</label><input class="form-input" id="co-pin" value="${d.pincode || ''}" placeholder="6-digit"></div>
        </div>
      </div>`;
        document.getElementById('checkout-footer').innerHTML = `<button class="btn btn-primary btn-full" onclick="nextCheckout(1)">Continue to Payment →</button>`;
      } else if (s === 2) {
        const payOpts = [['card', '💳 Credit / Debit Card'], ['upi', '📱 UPI (GPay, PhonePe)'], ['cod', '💵 Cash on Delivery'], ['netbanking', '🏦 Net Banking']];
        document.getElementById('checkout-content').innerHTML = `
      <div class="form-section">
        <div class="form-title">Payment Method</div>
        ${payOpts.map(([val, lbl]) => `
          <div class="pay-option ${(d.pay || 'card') === val ? 'selected' : ''}" onclick="selectPay('${val}')">
            <div class="pay-radio"><div class="pay-dot"></div></div>
            <span style="font-size:14px;color:var(--td);font-weight:500;">${lbl}</span>
          </div>`).join('')}
        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">
          <div style="font-size:13px;font-weight:700;color:var(--td);margin-bottom:10px;">Apply Coupon</div>
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <input type="text" id="co-coupon" class="form-input" placeholder="Coupon Code" value="${state.coupon ? state.coupon.code : ''}" style="flex:1;text-transform:uppercase;">
            <button class="btn btn-secondary" onclick="applyCoupon()" style="padding:0 16px;">Apply</button>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--td);margin-bottom:10px;">Order Summary</div>
          ${state.cart.map(item => `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;color:var(--tm);"><span style="display:flex;align-items:center;gap:6px;">${item.image ? `<img src="${item.image}" style="width:20px;height:20px;object-fit:cover;border-radius:4px;">` : (item.emoji || '💄')} ${escapeHTML(item.name)} ×${item.qty}</span><span>₹${item.price * item.qty}</span></div>`).join('')}
          ${state.coupon ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;color:var(--rose-d);"><span>Discount (${state.coupon.code}) <button style="background:none;border:none;cursor:pointer;font-size:10px" onclick="removeCoupon()">✕</button></span><span>-₹${state.couponDiscount}</span></div>` : ''}
          <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;font-weight:800;font-size:14px;color:var(--rose-d);"><span>Total</span><span>₹${Math.max(0, total - state.couponDiscount)}</span></div>
        </div>
      </div>`;
        document.getElementById('checkout-footer').innerHTML = `<button class="btn btn-primary btn-full" onclick="nextCheckout(2)">Place Order — ₹${Math.max(0, total - state.couponDiscount)}</button>`;
      }
    }

    async function applyCoupon() {
      const code = document.getElementById('co-coupon').value;
      if (!code) return showToast('Please enter a coupon code');
      const sub = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
      try {
        const res = await api('/api/coupons/validate', 'POST', { code, cartTotal: sub });
        state.coupon = res.coupon;
        state.couponDiscount = res.discount;
        showToast('Coupon applied successfully!');
        renderCheckout();
        renderCart();
      } catch (err) {
        showToast(err.message);
        state.coupon = null;
        state.couponDiscount = 0;
        renderCheckout();
        renderCart();
      }
    }

    function selectPay(val) {
      state.checkoutData.pay = val;
      document.querySelectorAll('.pay-option').forEach(el => {
        el.classList.toggle('selected', el.onclick.toString().includes(val));
      });
      renderCheckout();
    }

    async function processRazorpayPayment(amount, order_id) {
      try {
        const { key } = await api('/api/payment/key');
        const rzpOrder = await api('/api/payment/create-order', 'POST', { amount });

        const options = {
          key: key,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: "FACELOOK",
          description: "Purchase Payment",
          order_id: rzpOrder.id,
          handler: async function (response) {
            try {
              const verifyRes = await api('/api/payment/verify', 'POST', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: order_id
              });

              if (verifyRes.success) {
                state.cart = [];
                updateBadges();
                state.checkoutStep = 3;
                renderCheckout();
                showToast("Payment Successful!");
              }
            } catch (err) {
              showToast("Verification failed: " + err.message);
            }
          },
          prefill: {
            name: state.checkoutData.name,
            email: state.checkoutData.email,
            contact: state.checkoutData.phone,
            method: state.checkoutData.pay
          },
          theme: { color: "#B76E79" }
        };

        if (state.checkoutData.pay === 'upi') {
          options.config = {
            display: {
              blocks: {
                qr: {
                  name: "Pay using QR",
                  instruments: [{ method: "upi", flows: ["qr"] }]
                }
              },
              sequence: ["block.qr"],
              preferences: { show_default_blocks: false }
            }
          };
        }

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          showToast("Payment Failed: " + response.error.description);
        });
        rzp.open();
      } catch (err) {
        showToast("Error starting payment: " + err.message);
      }
    }

    async function finishCheckout() {
      const sub = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
      const ship = sub >= 599 ? 0 : 49;
      const total = Math.max(0, sub + ship - (state.couponDiscount || 0));

      try {
        const payloadDetails = { ...state.checkoutData, coupon: state.coupon ? state.coupon.code : null, discount: state.couponDiscount || 0, cart: state.cart, subtotal: sub, shipping: ship };
        const res = await api('/api/checkout', 'POST', { total, details: payloadDetails });
        const order_id = res.order_id;

        if (state.checkoutData.pay === 'cod') {
          state.cart = [];
          updateBadges();
          state.checkoutStep = 3;
          renderCheckout();
          window.scrollTo(0, 0);
        } else {
          // Process all digital payments (Card, UPI, Netbanking) with Razorpay
          processRazorpayPayment(total, order_id);
        }
      } catch (err) {
        showToast(err.message);
      }
    }

    function nextCheckout(step) {
      if (step === 1) {
        state.checkoutData.name = document.getElementById('co-name')?.value || '';
        state.checkoutData.email = document.getElementById('co-email')?.value || '';
        state.checkoutData.phone = document.getElementById('co-phone')?.value || '';
        state.checkoutData.address = document.getElementById('co-addr')?.value || '';
        state.checkoutData.city = document.getElementById('co-city')?.value || '';
        state.checkoutData.pincode = document.getElementById('co-pin')?.value || '';
        if (!state.checkoutData.name || !state.checkoutData.email || !state.checkoutData.phone || !state.checkoutData.address || !state.checkoutData.city || !state.checkoutData.pincode) { 
          return showToast('Please fill all required fields'); 
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.checkoutData.email)) {
          return showToast('Please enter a valid email address');
        }
        if (!/^\d{10}$/.test(state.checkoutData.phone)) {
          return showToast('Please enter a valid 10-digit phone number');
        }
        if (!/^\d{6}$/.test(state.checkoutData.pincode)) {
          return showToast('Please enter a valid 6-digit pincode');
        }
      }
      if (step === 2) {
        if (!state.checkoutData.pay) state.checkoutData.pay = 'card';
        finishCheckout();
        return;
      }
      state.checkoutStep = step + 1;
      renderCheckout();
      window.scrollTo(0, 0);
    }

    // ─── AUTH ────────────────────────────────────
    let currentAuthPhone = '';

    function switchAuthView(view) {
      document.getElementById('auth-hub-view').style.display = view === 'hub' ? 'block' : 'none';
      document.getElementById('auth-phone-entry-view').style.display = view === 'phone_entry' ? 'block' : 'none';
      document.getElementById('auth-phone-otp-view').style.display = view === 'phone_otp' ? 'block' : 'none';
      document.getElementById('auth-email-view').style.display = view === 'email' ? 'block' : 'none';

      const title = document.getElementById('auth-title');
      const sub = document.getElementById('auth-sub');
      if (view === 'hub') { title.textContent = 'Welcome 💄'; sub.textContent = 'Choose your login method to continue'; }
      if (view === 'phone_entry' || view === 'phone_otp') { title.textContent = 'Mobile Verification'; sub.textContent = 'Secure, fast authentication'; }
      if (view === 'email') switchAuthMode('login');
    }

    async function submitPhoneEntry() {
      const fieldVal = document.getElementById('auth-phone').value;
      const p = fieldVal.trim().replace(/\s/g, '');
      if (!p || p.length < 10) return showToast('Enter valid 10-digit number');
      currentAuthPhone = p;
      try {
        await api('/api/auth/send-otp', 'POST', { phone: p });
        document.getElementById('display-phone').textContent = '+91 ' + p;
        switchAuthView('phone_otp');
      } catch (e) { showToast(e.message); }
    }

    async function submitPhoneOTP() {
      const fieldVal = document.getElementById('auth-otp').value;
      const otp = fieldVal.trim().replace(/\s/g, '');
      if (!otp) return showToast('Enter OTP');
      try {
        const data = await api('/api/auth/verify-otp', 'POST', { phone: currentAuthPhone, otp });
        authSuccess(data);
      } catch (e) { showToast(e.message); }
    }

    async function handleGoogleResponse(response) {
      try {
        const data = await api('/api/auth/google', 'POST', { credential: response.credential });
        authSuccess(data);
      } catch (e) { showToast(e.message); }
    }

    // Developer tool to simulate Google login if Google Client ID is missing/invalid
    window.addEventListener('load', () => {
      const btnWrapper = document.querySelector('.g_id_signin');
      if (btnWrapper) {
        btnWrapper.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const mockJwtPayload = btoa(JSON.stringify({ email: 'test@gmail.com', name: 'Google Tester', sub: 'mock123' }));
          handleGoogleResponse({ credential: 'mock.' + mockJwtPayload + '.mock' });
        });
      }
    });

    async function authSuccess(data) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('facelook_token', data.token);

      showToast('Welcome, ' + state.user.name + '! 💄');

      // Delay slightly so they can see the toast before the screen refreshes seamlessly to Home
      setTimeout(() => {
        window.location.reload();
      }, 700);
    }

    function switchAuthMode(mode) {
      state.authMode = mode;
      document.getElementById('tab-login').classList.toggle('active', mode === 'login');
      document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
      document.getElementById('name-group').style.display = mode === 'signup' ? 'block' : 'none';
      document.getElementById('forgot-link').style.display = mode === 'login' ? 'block' : 'none';
      document.getElementById('auth-title').textContent = mode === 'login' ? 'Welcome Back 💄' : 'Create Account ✨';
      document.getElementById('auth-sub').textContent = mode === 'login' ? 'Sign in to your account' : 'Join the FACÉLOOK family';
      document.getElementById('email-submit-btn').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
      document.getElementById('auth-switch-text').textContent = mode === 'login' ? "Don't have an account? " : "Already have an account? ";
      document.getElementById('auth-switch-btn').textContent = mode === 'login' ? 'Sign Up' : 'Sign In';
      document.getElementById('auth-switch-btn').onclick = () => switchAuthMode(mode === 'login' ? 'signup' : 'login');
    }

    function togglePw() {
      const inp = document.getElementById('auth-pw');
      const btn = document.querySelector('.pw-toggle');
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
      else { inp.type = 'password'; btn.textContent = '👁️'; }
    }

    async function submitAuth() {
      const email = document.getElementById('auth-email').value;
      const pw = document.getElementById('auth-pw').value;
      const name = document.getElementById('auth-name')?.value || email.split('@')[0];
      if (!email || !pw) { showToast('Please fill all fields'); return; }

      try {
        const endpoint = state.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const data = await api(endpoint, 'POST', { email, password: pw, name });
        authSuccess(data);
      } catch (err) {
        showToast(err.message);
      }
    }

    function logout() {
      state.user = null;
      state.token = null;
      localStorage.removeItem('facelook_token');
      state.cart = [];
      state.wishlist = [];
      updateAuthUI();
      updateBadges();
      showToast('Signed out successfully');
      goTo('home');
    }

    function updateAuthUI() {
      const btn = document.getElementById('auth-nav-btn');
      if (btn) {
        btn.textContent = state.user ? '👤' : '🔑';
        btn.title = state.user ? state.user.name : 'Account';
      }
      const g = document.getElementById('sidebar-greeting');
      if (g) {
        if (state.user) {
          g.style.background = 'var(--pale)';
          g.style.borderRadius = '12px';
          g.style.padding = '12px 14px';
          g.style.fontSize = '13px';
          g.style.color = 'var(--tm)';
          g.style.display = 'block'; 
          g.innerHTML = `👋 Hi, <strong style="color:var(--rose-d)">${state.user.name}</strong>!`; 
        } else {
          g.style.display = 'none';
        }
      }
      const sab = document.getElementById('sidebar-auth-btn');
      if (sab) {
        sab.style.display = 'block';
        if(state.user) {
           sab.innerHTML = `<button class="btn btn-ghost btn-full" onclick="logout();closeSidebar();" style="border-radius:30px; border:1px solid var(--nude-dark); color:var(--td); font-family:'Bebas Neue',cursive; font-size:18px;">SIGN OUT</button>`;
        } else {
           sab.innerHTML = `<button class="btn btn-primary btn-full" onclick="goTo('auth');closeSidebar();" style="border-radius:30px; font-family:'Bebas Neue',cursive; font-size:18px;">SIGN IN / SIGN UP</button>`;
        }
      }
    }

    function prefillAndTrack(id) {
        document.getElementById('acc-track-order-id').value = id;
        switchAccTab('track');
        submitAccTracking();
    }
    
    async function submitAccTracking() {
      const oid = document.getElementById('acc-track-order-id').value;
      if(!oid) {
        showToast('Please enter an Order ID');
        return;
      }
      
      const resContainer = document.getElementById('acc-track-result');
      resContainer.style.display = 'block';
      resContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Fetching status...</div>';
      
      try {
        const res = await fetch('/api/track/' + encodeURIComponent(oid));
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        
        let timelineHTML = '';
        data.tracking.forEach(t => {
            timelineHTML += `
            <div class="timeline-step ${t.status}">
              <div class="timeline-title">${t.title}</div>
              <div class="timeline-date">${t.date}</div>
            </div>`;
        });
        
        resContainer.innerHTML = `
          <h4 style="margin-top:24px; margin-bottom: 12px;">Order Status: <span style="color:var(--rose);">${data.tracking.find(t => t.status === 'active')?.title || 'Completed'}</span></h4>
          <div class="timeline" style="margin-top: 20px;">
            ${timelineHTML}
          </div>
        `;
      } catch (err) {
        resContainer.innerHTML = '<div style="color:red; text-align:center; margin-top: 20px;">Order not found. Please check your Order ID.</div>';
      }
    }

    // ─── ACCOUNT ─────────────────────────────────
    function renderAccount() {
       document.getElementById('prof-name').value = state.user?.name || '';
       document.getElementById('prof-email').value = state.user?.email || state.user?.phone || '';
       switchAccTab(state.accTab);
    }
    
    function switchAccTab(tab) {
       state.accTab = tab;
       document.querySelectorAll('.acc-tab-btn').forEach(btn => {
           if(btn.dataset.tab === tab) btn.classList.add('active');
           else btn.classList.remove('active');
       });
       document.querySelectorAll('.acc-section').forEach(sec => {
           if(sec.id === 'acc-' + tab) sec.classList.add('active');
           else sec.classList.remove('active');
       });
       if(tab === 'orders') fetchOrders();
    }
    
    async function fetchOrders() {
      if (!state.token) return;
      try {
        const orders = await api('/api/orders');
        state.orders = orders;
        let html = '';
        if (orders.length === 0) {
          html = `<div class="empty-state" style="padding:40px 20px;"><div class="empty-icon">📦</div><div class="empty-title">No orders yet</div><p class="empty-sub">When you place orders, they will appear here.</p><button class="btn btn-primary" onclick="goTo('shop')">Start Shopping</button></div>`;
        } else {
          orders.forEach(o => {
            const isPaid = o.status === 'Paid' || o.payment_status === 'Paid' || o.details?.pay === 'cod';
            const orderIdStr = o.id || o._id.toString().slice(-6);
            html += `<div class="order-card" style="cursor:pointer;" onclick="viewOrderDetails('${orderIdStr}')">
              <div class="order-head">
                <div>
                  <div class="order-id">Order #${orderIdStr}</div>
                  <div class="order-date">Placed on ${new Date(o.createdAt || Date.now()).toLocaleDateString()}</div>
                </div>
                <div class="order-total">₹${o.total}</div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:13px;color:var(--tm);">
                  Method: ${o.details?.pay?.toUpperCase() || 'Digital'}
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                  <button class="btn-track" onclick="event.stopPropagation(); prefillAndTrack('${orderIdStr}')">Track Order</button>
                  <span class="order-status ${isPaid ? 'status-paid' : 'status-pending'}">
                    ${isPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>`;
          });
        }
        document.getElementById('acc-orders-content').innerHTML = html;
      } catch (e) {
        document.getElementById('acc-orders-content').innerHTML = `<div class="empty-state"><p style="color:var(--tl)">${e.message}</p></div>`;
      }
    }
    function viewOrderDetails(orderId) {
      if (!state.orders) return;
      const order = state.orders.find(o => (o.id || o._id.toString().slice(-6)) == orderId);
      if (!order) return;

      const isPaid = order.status === 'Paid' || order.payment_status === 'Paid' || order.details?.pay === 'cod';
      const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString();
      
      let html = `
        <div style="background: white; border-radius: 8px; border: 1px solid var(--border); padding: 20px; margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <div style="font-size:18px; font-weight:600; font-family:'Playfair Display',serif; color:var(--td);">Order #${orderId}</div>
              <div style="font-size:12px; color:var(--tm); margin-top:4px;">Placed on ${orderDate}</div>
            </div>
            <span class="order-status ${isPaid ? 'status-paid' : 'status-pending'}">${isPaid ? 'Paid' : 'Pending'}</span>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:13px; color:var(--tm);">
            <div style="flex:1;">
              <strong>Delivery Address</strong><br>
              ${order.details?.name || ''}<br>
              ${order.details?.address || ''}<br>
              ${order.details?.city || ''} - ${order.details?.pincode || ''}<br>
              ${order.details?.phone || ''}
            </div>
            <div style="flex:1; text-align:right;">
              <strong>Payment Method</strong><br>
              ${(order.details?.pay || 'digital').toUpperCase()}
            </div>
          </div>
          
          ${generateTrackingTimeline(order.status)}
          
          <h4 style="font-family:'Playfair Display',serif; color:var(--td); margin-bottom:12px;">Order Items</h4>
      `;

      if (order.details && order.details.cart && order.details.cart.length > 0) {
        html += `<div style="border: 1px solid var(--border); border-radius: 6px; overflow:hidden;">`;
        order.details.cart.forEach(item => {
          html += `
            <div style="display:flex; padding:12px; border-bottom: 1px solid var(--border); align-items:center; gap:12px;">
              <img src="${item.image}" alt="${item.name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">
              <div style="flex:1;">
                <div style="font-weight:600; font-size:14px;">${item.name}</div>
                <div style="font-size:12px; color:var(--tm);">Qty: ${item.qty} &times; ₹${item.price}</div>
              </div>
              <div style="font-weight:600;">₹${item.price * item.qty}</div>
            </div>
          `;
        });
        html += `</div>`;
      } else {
        html += `<div class="empty-state" style="padding:20px;"><p style="font-size:13px; color:var(--tl);">Product details are unavailable for this legacy order.</p></div>`;
      }

      const subtotal = order.details?.subtotal || order.total;
      const shipping = order.details?.shipping || 0;
      const discount = order.details?.discount || 0;

      html += `
          <div style="margin-top:20px; border-top: 1px solid var(--border); padding-top:16px;">
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px; color:var(--tm);">
              <span>Subtotal</span>
              <span>₹${subtotal}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px; color:var(--tm);">
              <span>Shipping</span>
              <span>${shipping === 0 ? 'Free' : '₹' + shipping}</span>
            </div>
            ${discount > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px; color:#28a745;">
              <span>Discount</span>
              <span>-₹${discount}</span>
            </div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:600; margin-top:12px; color:var(--td); border-top: 1px dashed var(--border); padding-top:12px;">
              <span>Total Amount</span>
              <span>₹${order.total}</span>
            </div>
            <div style="font-size:11px; color:var(--tl); margin-top:4px; text-align:right;">Inclusive of all taxes</div>
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%; margin-bottom:20px;" onclick="prefillAndTrack('${orderId}')">Track This Order</button>
      `;

      document.getElementById('order-details-content').innerHTML = html;
      goTo('order-details');
    }


    // ─── SIDEBAR ─────────────────────────────────
    function openSidebar() {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('overlay').classList.add('open');
    }
    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('open');
    }

    // ─── BADGES ──────────────────────────────────
    function updateBadges() {
      const cartN = state.cart.reduce((a, i) => a + i.qty, 0);
      const wishN = state.wishlist.length;
      const cb = document.getElementById('cart-badge');
      const wb = document.getElementById('wish-badge');
      const bnc = document.getElementById('bn-cart-badge');
      const bnw = document.getElementById('bn-wish-badge');
      if (cb) { cb.textContent = cartN; cb.classList.toggle('show', cartN > 0); }
      if (wb) { wb.textContent = wishN; wb.classList.toggle('show', wishN > 0); }
      if (bnc) { bnc.textContent = cartN; bnc.classList.toggle('show', cartN > 0); }
      if (bnw) { bnw.textContent = wishN; bnw.classList.toggle('show', wishN > 0); }
    }

    // ─── CONTACT ─────────────────────────────────
    async function sendMessage() {
      const name = document.getElementById('c-name')?.value;
      const email = document.getElementById('c-email')?.value;
      const message = document.getElementById('c-msg')?.value;
      if (!name || !email || !message) { showToast('Please fill in your name, email, and message'); return; }
      
      try {
        await api('/api/contact', 'POST', { name, email, subject: 'Contact Form Submission', message });
        document.getElementById('contact-form-area').innerHTML = `
      <div style="text-align:center;padding:32px 0;">
        <div style="font-size:48px;margin-bottom:12px;">💌</div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;color:var(--rose-d);font-style:italic;">Message Sent!</div>
        <p style="font-size:13px;color:var(--tl);margin-top:6px;">We'll reply within 24 hours.</p>
      </div>`;
      } catch (e) {
        showToast(e.message);
      }
    }

    // ─── NEWSLETTER ──────────────────────────────
    async function subscribeNL(btnElement) {
      const parent = btnElement.closest('.newsletter-split') || document;
      const emailInput = parent.querySelector('input[type="email"]');
      const email = emailInput ? emailInput.value : null;
      
      if (!email) { showToast('Please enter an email address'); return; }
      
      try {
        const res = await api('/api/newsletter', 'POST', { email });
        showToast(res.message || 'Subscribed! Welcome to FACELOOK 💌');
        if (emailInput) emailInput.value = '';
      } catch (e) {
        showToast(e.message);
      }
    }



    // ─── INIT ────────────────────────────────────
    // ─── CAROUSEL ─────────────────────────────────
    let currentSlide = 0;
    let slideInterval;

    function setSlide(index) {
      const slides = document.querySelectorAll('.hero-slide');
      const dots = document.querySelectorAll('.hero-dot');
      if (!slides.length) return;
      currentSlide = index;
      slides.forEach((slide) => {
        slide.style.transform = `translateX(-${currentSlide * 100}%)`;
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
      });
      resetInterval();
    }

    function nextSlide() {
      const slides = document.querySelectorAll('.hero-slide');
      if (!slides.length) return;
      currentSlide = (currentSlide + 1) % slides.length;
      setSlide(currentSlide);
    }

    function resetInterval() {
      clearInterval(slideInterval);
      slideInterval = setInterval(nextSlide, 4000);
    }

    function renderHeroSlider(slides) {
      const carousel = document.querySelector('.hero-carousel');
      const dotsContainer = document.querySelector('.hero-dots');
      if (!carousel || !dotsContainer) return;
      
      carousel.innerHTML = '';
      dotsContainer.innerHTML = '';
      
      slides.forEach((slide, index) => {
        let mediaHtml = '';
        if (slide.media) {
            const isVideo = slide.media.startsWith('data:video');
            if (isVideo) {
                mediaHtml = `<video src="${slide.media}" autoplay loop muted playsinline style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:0; pointer-events:none;"></video>`;
            } else {
                mediaHtml = `<img src="${slide.media}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:0; pointer-events:none;">`;
            }
        }
        
        const overlayHtml = `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7)); z-index:1; pointer-events:none;"></div>`;
        
        const contentHtml = `
          <div class="hero-content-custom">
            ${slide.tag ? `<div class="hero-tag-custom">${slide.tag}</div>` : ''}
            ${slide.eyebrow ? `<div class="hero-eyebrow-custom">${slide.eyebrow}</div>` : ''}
            ${slide.title ? `<h1 class="hero-title-custom">${slide.title}</h1>` : ''}
            ${slide.subtitle ? `<p class="hero-subtitle-custom">${slide.subtitle}</p>` : ''}
            <div class="hero-btns-custom">
              <a href="/shop" onclick="event.preventDefault(); goTo('shop')" class="btn-hero-primary">SHOP NOW</a>
              <a href="/about" onclick="event.preventDefault(); goTo('about')" class="btn-hero-secondary">EXPLORE</a>
            </div>
          </div>
        `;

        const slideDiv = document.createElement('div');
        slideDiv.className = 'hero-slide';
        slideDiv.style.position = 'relative';
        slideDiv.style.overflow = 'hidden';
        
        slideDiv.innerHTML = mediaHtml + overlayHtml + contentHtml;
        carousel.appendChild(slideDiv);
        
        const dot = document.createElement('div');
        dot.className = 'hero-dot';
        if (index === 0) dot.classList.add('active');
        dot.onclick = () => setSlide(index);
        dotsContainer.appendChild(dot);
      });
      
      currentSlide = 0;
      setSlide(0);
    }

    async function fetchNotifications() {
        if (!state.token) return;
        try {
            const notifs = await api('/api/notifications');
            state.notifications = notifs;
            updateNotificationUI();
        } catch (e) { console.error('Error fetching notifications:', e); }
    }

    function updateNotificationUI() {
        const notifs = state.notifications || [];
        const unread = notifs.filter(n => !n.isRead).length;
        
        const desktopBadge = document.getElementById('notif-badge');
        const mobileBadge = document.getElementById('mobile-notif-badge');
        
        if (unread > 0) {
            if(desktopBadge) { desktopBadge.style.display = 'block'; desktopBadge.innerText = unread; }
            if(mobileBadge) { mobileBadge.style.display = 'block'; mobileBadge.innerText = unread; }
        } else {
            if(desktopBadge) desktopBadge.style.display = 'none';
            if(mobileBadge) mobileBadge.style.display = 'none';
        }
        
        let html = '';
        if (notifs.length === 0) {
            html = '<div style="text-align:center; padding:10px 0;">No new notifications</div>';
        } else {
            notifs.forEach(n => {
                html += `<div style="padding:12px; margin-bottom:8px; border-radius:8px; background:${n.isRead ? 'transparent' : 'rgba(219,39,119,0.05)'}; border:1px solid ${n.isRead ? 'var(--border)' : 'rgba(219,39,119,0.2)'}; cursor:pointer;" onclick="markNotificationRead('${n.id || n._id}')">
                    <div style="font-weight:600; color:var(--td); display:flex; justify-content:space-between;">
                        <span>${n.title}</span>
                        ${!n.isRead ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--rose);display:inline-block;"></span>' : ''}
                    </div>
                    <div style="margin-top:4px;">${n.message}</div>
                    <div style="font-size:11px; color:var(--tl); margin-top:6px;">${new Date(n.createdAt).toLocaleString()}</div>
                </div>`;
            });
        }
        
        const desktopList = document.getElementById('notif-list');
        const mobileList = document.getElementById('mobile-notif-list');
        if(desktopList) desktopList.innerHTML = html;
        if(mobileList) mobileList.innerHTML = html;
    }

    async function markNotificationRead(id) {
        try {
            await api('/api/notifications/' + id + '/read', 'PUT');
            fetchNotifications();
        } catch(e) {}
    }

    async function markAllNotificationsRead() {
        const notifs = state.notifications || [];
        const unread = notifs.filter(n => !n.isRead);
        if (unread.length === 0) return;
        try {
            await Promise.all(unread.map(n => api('/api/notifications/' + (n.id || n._id) + '/read', 'PUT')));
            fetchNotifications();
        } catch(e) { console.error(e); }
    }

    function toggleMobileNotifications() {
        const el = document.getElementById('mobile-notif-container');
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    function toggleDesktopNotifications(e) {
        if(e) e.preventDefault();
        const el = document.getElementById('notif-dropdown');
        if(el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    }

    async function fetchOffers() {
        try {
            const offers = await api('/api/coupons/active');
            let html = '';
            if (!offers || offers.length === 0) {
                html = '<div style="text-align:center; padding:20px; color:var(--tl);">No offers currently available.</div>';
            } else {
                offers.forEach(o => {
                    const discount = o.type === 'percentage' ? `${o.value}% OFF` : `₹${o.value} OFF`;
                    const maxDisc = o.maxDiscount ? ` (Up to ₹${o.maxDiscount})` : '';
                    const minOrder = o.minOrder ? ` on orders above ₹${o.minOrder}` : '';
                    html += `<div style="padding:15px; border:1px dashed var(--rose); border-radius:8px; background:rgba(219,39,119,0.02); display:flex; flex-direction:column; gap:5px;">
                        <div style="font-weight:700; color:var(--rose); font-size:18px;">${o.code}</div>
                        <div style="font-weight:600; color:var(--td);">${discount}${maxDisc}${minOrder}</div>
                        ${o.campaignName ? `<div style="font-size:12px; color:var(--tl);">${o.campaignName}</div>` : ''}
                    </div>`;
                });
            }
            const dropupContent = document.getElementById('offers-dropup-content');
            if (dropupContent) dropupContent.innerHTML = html;
        } catch (e) {
            console.error('Error fetching offers:', e);
            const dropupContent = document.getElementById('offers-dropup-content');
            if (dropupContent) dropupContent.innerHTML = '<div style="text-align:center; padding:20px; color:var(--rose);">Error loading offers.</div>';
        }
    }

    function toggleOffersDropup(e) {
        if(e) e.preventDefault();
        const dropup = document.getElementById('offers-dropup');
        if(dropup) {
            const isHidden = dropup.style.display === 'none';
            dropup.style.display = isHidden ? 'block' : 'none';
            if(isHidden) {
                fetchOffers();
            }
        }
    }

    function generateTrackingTimeline(status) {
        status = (status || 'pending').toLowerCase();
        let statuses = ['pending', 'processing', 'shipped', 'delivered'];
        
        if (status === 'cancelled') {
            return `
            <div class="timeline" style="margin:20px 0; padding:10px;">
              <div class="timeline-step active">
                <div class="timeline-title">Order Cancelled</div>
                <div class="timeline-date">Order has been cancelled</div>
              </div>
            </div>`;
        }
        
        let idx = statuses.indexOf(status);
        if (idx === -1) idx = 0;
        
        let timelineHTML = '';
        statuses.forEach((s, i) => {
            let className = '';
            if (i < idx) className = 'completed';
            else if (i === idx) className = 'active';
            
            let displayTitle = s.charAt(0).toUpperCase() + s.slice(1);
            timelineHTML += `
            <div class="timeline-step ${className}">
              <div class="timeline-title">${displayTitle}</div>
              <div class="timeline-date">${className ? 'Completed' : (i===idx ? 'Current' : 'Pending')}</div>
            </div>`;
        });
        
        return `<div class="timeline" style="margin:20px 0; padding:10px;">${timelineHTML}</div>`;
    }

    async function initApp() {
      // Instantly switch to the correct page skeleton to avoid waiting on the homepage
      const path = window.location.pathname;
      let initialPage = 'home';
      if (path.startsWith('/product/')) initialPage = 'product';
      else if (path.startsWith('/category/')) initialPage = 'shop';
      else if (path !== '/' && path !== '') initialPage = path.replace('/', '');
      
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById('page-' + initialPage);
      if (targetPage) targetPage.classList.add('active');

      try {
        PRODUCTS = await api('/api/products');
        PRODUCTS.forEach(p => p.slug = slugify(p.name));
        
        api('/api/settings/hero_slides')
          .then(slides => {
             if (slides && slides.length > 0) {
                 renderHeroSlider(slides);
             }
          })
          .catch(err => console.error('Failed to load hero slides', err));

        api('/api/settings')
          .then(settings => {
             if (settings) {
                 if(settings.announcement_banner) document.getElementById('announcement-text').innerText = settings.announcement_banner;
                 if(settings.policy_about) document.getElementById('page-about').innerHTML = settings.policy_about;
                 if(settings.policy_refund) document.getElementById('page-refund').innerHTML = settings.policy_refund;
                 if(settings.policy_shipping) document.getElementById('page-shipping').innerHTML = settings.policy_shipping;
                 if(settings.policy_return) document.getElementById('page-terms').innerHTML = settings.policy_return;
             }
          })
          .catch(err => console.error('Failed to load store policies', err));
          
        if (state.token) {
          state.cart = await api('/api/cart');
          state.wishlist = await api('/api/wishlist');
          fetchNotifications();
        }
      } catch (err) {
        console.error("Init Error:", err);
      }
      
      // Trigger route
      handleRoute();
      
      updateAuthUI();
      updateBadges();
      resetInterval();
    }
    initApp();
  