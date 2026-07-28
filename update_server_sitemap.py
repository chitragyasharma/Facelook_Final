import re

def main():
    with open('server/server.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Create slugify for server
    sitemap_logic = """
function slugify(text) {
    return text.toString().toLowerCase()
    .replace(/\\s+/g, '-')
    .replace(/[^\\w\\-]+/g, '')
    .replace(/\\-\\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

app.get('/sitemap.xml', async (req, res) => {
    try {
        const products = await Product.find({}, 'name updatedAt');
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.facelookcosmetics.in/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/shop</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/category/face</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/category/lips</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/category/eyes</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/category/nails</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

        products.forEach(p => {
            const slug = slugify(p.name);
            xml += `  <url>
    <loc>https://www.facelookcosmetics.in/product/${slug}</loc>
    <lastmod>${new Date(p.updatedAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
        });

        xml += `</urlset>`;
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});
"""

    if '/sitemap.xml' not in js:
        # Insert before module.exports or app.listen
        if 'module.exports = app;' in js:
            js = js.replace('module.exports = app;', sitemap_logic + '\nmodule.exports = app;')
        else:
            js += '\n' + sitemap_logic

    with open('server/server.js', 'w', encoding='utf-8') as f:
        f.write(js)

if __name__ == '__main__':
    main()
