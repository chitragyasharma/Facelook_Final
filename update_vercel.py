import json

def main():
    with open('vercel.json', 'r', encoding='utf-8') as f:
        config = json.load(f)

    # Make sure robots.txt is built as static
    found_robots = False
    for build in config.get('builds', []):
        if build.get('src') == 'robots.txt':
            found_robots = True
    if not found_robots:
        config.setdefault('builds', []).append({"src": "robots.txt", "use": "@vercel/static"})

    # Add rewrite for sitemap.xml
    new_rewrites = []
    # Ensure sitemap.xml routes to /server/server.js
    new_rewrites.append({"source": "/sitemap.xml", "destination": "/server/server.js"})
    new_rewrites.append({"source": "/robots.txt", "destination": "/robots.txt"})
    
    for r in config.get('rewrites', []):
        if r.get('source') not in ['/sitemap.xml', '/robots.txt']:
            new_rewrites.append(r)
            
    config['rewrites'] = new_rewrites

    with open('vercel.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

if __name__ == '__main__':
    main()
