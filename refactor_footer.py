import re
import sys

def refactor_footer():
    with open('client/index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    footer_pattern = re.compile(r'<footer style="padding:40px 20px; background:var\(--bg\); border-top:1px solid var\(--border\); text-align:center;">.*?</footer>', re.DOTALL)
    
    match = footer_pattern.search(html)
    if not match:
        print("Footer not found!")
        sys.exit(1)
        
    footer_html = match.group(0)
    
    html = footer_pattern.sub('', html)
    
    if '<!-- ═══════════════════════════════════\n     BOTTOM NAVIGATION\n════════════════════════════════════ -->' in html:
        bottom_nav = '<!-- ═══════════════════════════════════\n     BOTTOM NAVIGATION\n════════════════════════════════════ -->'
        html = html.replace(bottom_nav, footer_html + '\n\n  ' + bottom_nav)
    elif '<!-- Bottom Navigation -->' in html:
        html = html.replace('<!-- Bottom Navigation -->', footer_html + '\n\n  <!-- Bottom Navigation -->')
    else:
        # Just put it before the script tags
        html = html.replace('<script>', footer_html + '\n\n  <script>')

    with open('client/index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Successfully refactored footers!")

if __name__ == "__main__":
    refactor_footer()
