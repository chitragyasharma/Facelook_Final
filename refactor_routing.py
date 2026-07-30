
import re

def main():
    with open('client/index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add slugify function and navigate function
    routing_logic = """
    // --- ROUTING & SEO ---
    function slugify(text) {
      return text.toString().toLowerCase()
        .replace(/\\s+/g, '-')           // Replace spaces with -
        .replace(/[^\\w\\-]+/g, '')       // Remove all non-word chars
        .replace(/\\-\\-+/g, '-')         // Replace multiple - with single -
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
"""

    html = re.sub(
        r'function goTo\(page\) \{[^\}]+\}',
        lambda m: routing_logic.strip(),
        html,
        count=1
    )

    # 2. Replace hashchange
    html = re.sub(
        r'window\.addEventListener\(\'hashchange\', \(\) => \{[\s\S]*?\}\);',
        '',
        html
    )

    # 3. Update initApp
    init_logic = """
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
"""

    html = re.sub(
        r'// ─── INIT ────────────────────────────────────[\s\S]*?async function initApp\(\) \{[\s\S]*?updateBadges\(\);\n    \}',
        lambda m: init_logic.strip(),
        html,
        count=1
    )

    # 4. Update openProduct to handle URL pushing
    html = re.sub(
        r'function openProduct\(id\) \{',
        r'function openProduct(id, push = true) {',
        html
    )

    push_logic = """
      const p = PRODUCTS.find(x => x.id === id);
      if (!p) return;
      if (push) window.history.pushState(null, '', '/product/' + p.slug);
      updateSEO(p.name, p.desc);
      injectJSONLD(p);
"""
    html = re.sub(
        r'const p = PRODUCTS\.find\(x => x\.id === id\);\n\s*if \(\!p\) return;',
        lambda m: push_logic,
        html
    )

    # 5. Fix links across the app. 
    html = html.replace('href="#shop-eyes"', 'href="/category/eyes" onclick="event.preventDefault(); shopByFilter(\'Eyes\')"')
    html = html.replace('href="#shop-face"', 'href="/category/face" onclick="event.preventDefault(); shopByFilter(\'Face\')"')
    html = html.replace('href="#shop-lips"', 'href="/category/lips" onclick="event.preventDefault(); shopByFilter(\'Lips\')"')
    html = html.replace('href="#shop-nails"', 'href="/category/nails" onclick="event.preventDefault(); shopByFilter(\'Nails\')"')
    
    html = html.replace('href="#terms"', 'href="/terms" onclick="event.preventDefault(); goTo(\'terms\')"')
    html = html.replace('href="#privacy"', 'href="/privacy" onclick="event.preventDefault(); goTo(\'privacy\')"')
    html = html.replace('href="#refund"', 'href="/refund" onclick="event.preventDefault(); goTo(\'refund\')"')
    html = html.replace('href="#shipping"', 'href="/shipping" onclick="event.preventDefault(); goTo(\'shipping\')"')
    html = html.replace('href="#home"', 'href="/" onclick="event.preventDefault(); goTo(\'home\')"')
    html = html.replace('href="#shop"', 'href="/shop" onclick="event.preventDefault(); goTo(\'shop\')"')
    html = html.replace('href="#profile"', 'href="/profile" onclick="event.preventDefault(); goTo(\'profile\')"')
    html = html.replace('href="#cart"', 'href="/cart" onclick="event.preventDefault(); goTo(\'cart\')"')
    html = html.replace('window.location.hash = \'#\' + page;', 'goTo(page);')

    with open('client/index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Done")

if __name__ == '__main__':
    main()
