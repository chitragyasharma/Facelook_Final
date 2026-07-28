import re

def main():
    with open('index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace category links: href="#shop-Category"
    def repl_category(m):
        cat = m.group(1)
        return f'href="/category/{cat.lower()}" onclick="event.preventDefault(); shopByFilter(\'{cat}\')"'
    
    html = re.sub(r'href="#shop-([A-Za-z]+)"', repl_category, html)
    
    # Replace normal static links: href="#page"
    # we should exclude "#product-${p.id}" from this because it has template strings
    def repl_page(m):
        page = m.group(1).lower()
        # map account to profile
        if page == 'account': page = 'profile'
        return f'href="/{page}" onclick="event.preventDefault(); goTo(\'{page}\')"'
        
    html = re.sub(r'href="#([a-z]+)"', repl_page, html)

    # Replace JS dynamic product links: href="#product-${p.id}"
    # Wait, the product links should be:
    # `href="/product/${p.slug}" onclick="event.preventDefault(); openProduct(${p.id})"`
    # But wait, in JS, `p.slug` might not be accessible if it wasn't added yet, 
    # but products are fetched in initApp and we added slugs there.
    # The existing template string is: href="#product-${p.id}"
    
    html = html.replace('href="#product-${p.id}"', 'href="/product/${p.slug}" onclick="event.preventDefault(); openProduct(${p.id})"')

    # Wait, there's also `window.location.hash = '#cart'` in JS
    html = re.sub(r"window\.location\.hash\s*=\s*'#([a-z]+)'", r"goTo('\1')", html)

    with open('index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    with open('client/index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Done")

if __name__ == '__main__':
    main()
