import re

def main():
    with open('index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add CSS for grid swatches
    css_to_add = """
    .grid-swatches-container {
      display: flex;
      gap: 4px;
      margin-top: 6px;
      align-items: center;
    }
    .grid-swatch {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid var(--border);
    }
    .grid-swatch-more {
      font-size: 10px;
      color: var(--tm);
      margin-left: 2px;
    }
"""
    html = html.replace('/* --- END CSS --- */', css_to_add + '\n    /* --- END CSS --- */')

    # 2. Update productCardHTML
    old_card_js = """    function productCardHTML(p, extraStyle = '') {
      const inWish = state.wishlist.find(w => w.id === p.id);
      const disc = Math.round((1 - p.price / p.orig) * 100);
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
        <div class="product-row">
          <div><span class="product-price">₹${p.price}</span><span class="product-orig">₹${p.orig}</span></div>
          <button class="add-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToCart(${p.id})">+</button>
        </div>
      </div>
    </a>`;
    }"""

    new_card_js = """    function productCardHTML(p, extraStyle = '') {
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
    }"""

    html = html.replace(old_card_js, new_card_js)

    with open('index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Added swatches.")

if __name__ == '__main__':
    main()
