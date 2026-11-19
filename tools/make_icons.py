#!/usr/bin/env python3
"""make_icons.py — dessine les icônes de l'application (PWA) : tapis vert, trois cartes en éventail dont le 21 d'atout.
Utilisation : python3 tools/make_icons.py   (nécessite Playwright pour Python)"""
import os
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'icons')

def svg(maskable):
    pad = 0.18 if maskable else 0.0          # zone de sécurité des icônes « maskable » (Android)
    s = 1 - 2 * pad
    card = lambda rot, body: f'<g transform="rotate({rot} 256 430)"><rect x="176" y="120" width="160" height="250" rx="18" fill="#fbf8ef" stroke="#d6cdb4" stroke-width="3"/>{body}</g>'
    back = '<rect x="188" y="132" width="136" height="226" rx="10" fill="#26407c"/><path d="M188 132 l136 226 M324 132 l-136 226" stroke="#1d3263" stroke-width="10"/><circle cx="256" cy="245" r="16" fill="#d2a64b"/>'
    atout = '<rect x="176" y="208" width="160" height="74" fill="#26407c"/><rect x="176" y="208" width="160" height="74" fill="none" stroke="#d2a64b" stroke-width="5"/><text x="256" y="262" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="58" fill="#f2e6c8">21</text><text x="196" y="170" font-family="Georgia, serif" font-weight="700" font-size="36" fill="#26407c">21</text>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><radialGradient id="f" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#21684f"/><stop offset=".6" stop-color="#17503f"/><stop offset="1" stop-color="#0b2c24"/></radialGradient></defs>
<rect width="512" height="512" rx="{0 if maskable else 112}" fill="url(#f)"/>
{'' if maskable else '<rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="#d2a64b" stroke-width="6" opacity=".55"/>'}
<g transform="translate({256 - 256 * s} {256 - 256 * s}) scale({s})">
<ellipse cx="256" cy="420" rx="150" ry="22" fill="#000" opacity=".3"/>
{card(-24, back)}{card(24, back)}{card(0, atout)}
</g></svg>'''

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    for name, size, mask in [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('maskable-512.png', 512, True),
                             ('apple-touch-icon.png', 180, True), ('favicon-32.png', 32, False)]:
        pg.set_viewport_size({'width': size, 'height': size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(mask).replace("width=\"512\" height=\"512\"", f"width=\"{size}\" height=\"{size}\"")}</body></html>')
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
    with open(os.path.join(OUT, 'icon.svg'), 'w') as f: f.write(svg(False))
    b.close()
print('icônes écrites dans', OUT)
