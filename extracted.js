
    // ─── DATA ───────────────────────────────────
    const state = {
      page: 'home',
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
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://facelpro.onrender.com';

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
      if (bnMap[page]) document.getElementById(bnMap[page]).classList.add('active');
      state.page = page;
      window.scrollTo(0, 0);
      if (page === 'home') renderHome();
      if (page === 'shop') renderShop();
      if (page === 'cart') renderCart();
      if (page === 'wishlist') renderWishlist();
      if (page === 'checkout') { state.checkoutStep = 1; renderCheckout(); }
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
      document.title = title ? `${title} | Facelook Cosmetics` : 'Facelook Cosmetics';
      if (desc) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.name = 'description';
          document.head.appendChild(metaDesc);
        }
        metaDesc.content = desc;
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
        // Handle old hash paths if they exist
        if (page === 'shop') state.shopFilter = 'All';
        renderPage(page);
        
        let seoTitles = {
          'home': 'Home',
          'shop': 'Shop All',
          'cart': 'Shopping Cart',
          'profile': 'My Account',
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
    const MOCK_REVIEWS = [
      { name: 'Priya K.', title: 'Absolutely love the pigmentation!', body: 'This is my second time buying this. The color payoff is insane and it stays on all day.', rating: 5, date: '2 days ago' },
      { name: 'Ananya S.', title: 'Good for everyday use', body: 'Very smooth application. Not entirely transfer-proof but I love how lightweight it feels.', rating: 4, date: '1 week ago' },
      { name: 'Megha R.', title: 'Gorgeous shade', body: 'Looks exactly like the picture. Highly recommend for festive seasons.', rating: 5, date: '2 weeks ago' }
    ];

    function renderReviews() {
      const list = document.getElementById('reviews-list');
      if (!list) return;
      
      const summaryHTML = `
        <div class="reviews-summary">
          <div>
            <div class="reviews-rating-big">4.8</div>
            <div class="reviews-rating-stars">★★★★★</div>
            <div class="reviews-rating-count">Based on 124 reviews</div>
          </div>
          <div style="flex:1;">
             <div style="font-size:13px; color:var(--tm); line-height:1.6;">
               <strong>98%</strong> of customers recommend this product.<br>
               "Excellent pigmentation and long-lasting formula."
             </div>
          </div>
        </div>
      `;
      
      const reviewsHTML = MOCK_REVIEWS.map(r => {
        const initials = r.name.split(' ').map(n=>n[0]).join('').substring(0,2);
        return `
        <div class="review-card" style="padding: 24px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div class="review-card-header">
            <div class="review-avatar">${initials}</div>
            <div>
              <div class="review-meta" style="font-weight:600; color:var(--td); font-size:14px;">${r.name} <span class="review-verified">✓ Verified Buyer</span></div>
              <div class="review-stars">${stars(r.rating)} <span style="color:var(--tl); font-size:12px; margin-left:6px;">${r.date}</span></div>
            </div>
          </div>
          <div class="review-title" style="font-size:15px; margin-bottom:8px;">${r.title}</div>
          <div class="review-body" style="font-size:14px; line-height:1.6; color:#444;">${r.body}</div>
        </div>
      `}).join('');
      
      list.innerHTML = summaryHTML + reviewsHTML;
    }

    function openReviewModal() {
      document.getElementById('review-modal-overlay').classList.add('active');
    }

    function closeReviewModal() {
      document.getElementById('review-modal-overlay').classList.remove('active');
    }

    function submitReview() {
      closeReviewModal();
      showToast('Review submitted for moderation!');
      document.getElementById('review-name').value = '';
      document.getElementById('review-title').value = '';
      document.getElementById('review-body').value = '';
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
      </div>
      <div class="product-info">
        <div class="product-stars">${stars(p.rating)}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-shade">${p.shade}</div>
        ${swatchesHTML}
        <div class="product-row" style="margin-top: 8px;">
          <div><span class="product-price">₹${p.price}</span><span class="product-orig">₹${p.orig}</span></div>
          <button class="add-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToCart(${p.id})">+</button>
        </div>
      </div>
    </a>`;
    }

    // ─── HOME ────────────────────────────────────
    function renderHome() {
      const feat = document.getElementById('home-featured');
      feat.innerHTML = PRODUCTS.slice(0, 5).map(p => productCardHTML(p, 'width:148px;flex-shrink:0;')).join('');
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
        .filter(p => state.shopFilter === 'All' || p.cat === state.shopFilter || p.tag === state.shopFilter)
        .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.shade.toLowerCase().includes(q.toLowerCase()));

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
      if (mainImg) {
        if (!isCompact) {
          mainImg.src = shadeData.image;
          mainImg.style.objectFit = 'contain';
        }
      } else {
        document.getElementById('detail-emoji').innerHTML = `<img src="${isCompact ? p.images[0] : shadeData.image}" id="main-detail-img" style="width:100%;height:100%;object-fit:contain;">`;
      }

      document.getElementById('detail-shade').innerHTML = 'Shade: <span style="font-weight:600;color:var(--td);">' + shadeData.name + '</span>';

      document.querySelectorAll('#detail-palette-dots .shade-dot').forEach((el, i) => {
        el.classList.toggle('active', i === index);
      });
    }
    function swapDetailImage(src, el, pid) {
      const mainImg = document.getElementById('main-detail-img');
      if (mainImg) {
        mainImg.src = src;
        mainImg.style.objectFit = 'contain';
      }
      document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
      if (el) el.classList.add('active');
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

      document.getElementById('detail-emoji').innerHTML = mainSrc ? `<img src="${mainSrc}" id="main-detail-img" style="width:100%;height:100%;object-fit:contain;">` : (p.emoji || '💄');

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
          `<img src="${src}" class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="swapDetailImage('${src}', this, ${p.id})">`
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

      document.getElementById('detail-price').textContent = '₹' + p.price;
      document.getElementById('detail-orig').textContent = '₹' + p.orig;
      document.getElementById('detail-discount').textContent = disc + '% OFF';
      document.getElementById('detail-stars').textContent = stars(p.rating);
      document.getElementById('detail-reviews').textContent = '(' + p.reviews + ' reviews)';
      document.getElementById('detail-desc').textContent = p.desc;
      document.getElementById('detail-qty').textContent = state.detailQty;
      document.getElementById('detail-tag-badge').innerHTML = p.tag ? `<span style="background:var(--rose);color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">${p.tag}</span>` : '';
      document.getElementById('detail-tag-label').innerHTML = p.tag ? `<span style="background:var(--pale);color:var(--rose);font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">${p.tag}</span>` : '';
      document.getElementById('sticky-add-btn').textContent = '🛒 Add to Cart — ₹' + p.price;

      const wishBtn = document.getElementById('detail-wish-btn');
      wishBtn.textContent = inW ? '♥' : '♡';
      wishBtn.classList.toggle('active', !!inW);

      // Related
      const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
      document.getElementById('related-products').innerHTML = related.map(r => productCardHTML(r, 'width:140px;flex-shrink:0;')).join('');

      renderPage('product');
    }

    function changeQty(delta) {
      state.detailQty = Math.max(1, state.detailQty + delta);
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
      <div class="summary-total"><span>Total</span><span style="color:var(--rose-d)">₹${sub + ship}</span></div>
    </div>
    <div style="padding:0 16px 16px;">
      <button class="btn btn-primary btn-full" onclick="goTo('checkout')">Proceed to Checkout — ₹${sub + ship}</button>
    </div>`;
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
          <div style="font-size:13px;font-weight:700;color:var(--td);margin-bottom:10px;">Order Summary</div>
          ${state.cart.map(item => `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;color:var(--tm);"><span style="display:flex;align-items:center;gap:6px;">${item.image ? `<img src="${item.image}" style="width:20px;height:20px;object-fit:cover;border-radius:4px;">` : (item.emoji || '💄')} ${item.name} ×${item.qty}</span><span>₹${item.price * item.qty}</span></div>`).join('')}
          <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;font-weight:800;font-size:14px;color:var(--rose-d);"><span>Total</span><span>₹${total}</span></div>
        </div>
      </div>`;
        document.getElementById('checkout-footer').innerHTML = `<button class="btn btn-primary btn-full" onclick="nextCheckout(2)">Place Order — ₹${total}</button>`;
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
      const total = sub + ship;

      try {
        const res = await api('/api/checkout', 'POST', { total, details: state.checkoutData });
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
        if (!state.checkoutData.name || !state.checkoutData.email) { showToast('Please fill required fields'); return; }
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
        let html = '';
        if (orders.length === 0) {
          html = `<div class="empty-state" style="padding:40px 20px;"><div class="empty-icon">📦</div><div class="empty-title">No orders yet</div><p class="empty-sub">When you place orders, they will appear here.</p><button class="btn btn-primary" onclick="goTo('shop')">Start Shopping</button></div>`;
        } else {
          orders.forEach(o => {
            const isPaid = o.status === 'Paid' || o.payment_status === 'Paid' || o.details?.pay === 'cod';
            html += `<div class="order-card">
              <div class="order-head">
                <div>
                  <div class="order-id">Order #${o.id || o._id.toString().slice(-6)}</div>
                  <div class="order-date">Placed on ${new Date(o.createdAt || Date.now()).toLocaleDateString()}</div>
                </div>
                <div class="order-total">₹${o.total}</div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:13px;color:var(--tm);">
                  Method: ${o.details?.pay?.toUpperCase() || 'Digital'}
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                  <button class="btn-track" onclick="prefillAndTrack('${o.id || o._id.toString().slice(-6)}')">Track Order</button>
                  <span class="order-status ${isPaid ? 'status-paid' : 'status-pending'}">
                    ${isPaid ? 'Paid' : 'Pending'}
                </span>
              </div>
            </div>`;
          });
        }
        document.getElementById('acc-orders-content').innerHTML = html;
      } catch (e) {
        document.getElementById('acc-orders-content').innerHTML = `<div class="empty-state"><p style="color:var(--tl)">${e.message}</p></div>`;
      }
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
    function sendMessage() {
      const name = document.getElementById('c-name')?.value;
      const email = document.getElementById('c-email')?.value;
      if (!name || !email) { showToast('Please fill in your name and email'); return; }
      document.getElementById('contact-form-area').innerHTML = `
    <div style="text-align:center;padding:32px 0;">
      <div style="font-size:48px;margin-bottom:12px;">💌</div>
      <div style="font-family:'Playfair Display',serif;font-size:20px;color:var(--rose-d);font-style:italic;">Message Sent!</div>
      <p style="font-size:13px;color:var(--tl);margin-top:6px;">We'll reply within 24 hours.</p>
    </div>`;
    }

    // ─── NEWSLETTER ──────────────────────────────
    function subscribeNL() {
      showToast('Subscribed! Welcome to FACELOOK 💌');
    }



    // ─── INIT ────────────────────────────────────
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
        // Add slugs to all products
        PRODUCTS.forEach(p => p.slug = slugify(p.name));
        
        if (state.token) {
          state.cart = await api('/api/cart');
          state.wishlist = await api('/api/wishlist');
        }
      } catch (err) {
        console.error("Init Error:", err);
      }
      
      // Trigger route
      handleRoute();
      
      updateAuthUI();
      updateBadges();
    }
    initApp();
  