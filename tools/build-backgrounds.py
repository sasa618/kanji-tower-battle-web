"""Build lightweight, decorative SVGs from the game's existing letter outlines."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
glyphs = json.loads((root / 'src/data/glyphs.json').read_text(encoding='utf-8'))
coordinates = {'M': ('x', 'y'), 'L': ('x', 'y'), 'Q': ('x1', 'y1', 'x', 'y'),
               'C': ('x1', 'y1', 'x2', 'y2', 'x', 'y'), 'Z': ()}

def glyph(char, transform, color, opacity=.12):
    commands = [c['type'] + ' '.join(str(c[key]) for key in coordinates[c['type']])
                for c in glyphs[char]['commands']]
    return f'<path data-kanji="{char}" d="{" ".join(commands)}" transform="{transform}" fill="{color}" opacity="{opacity}"/>'

page = '''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="720" viewBox="0 0 640 720" fill="none">
  <defs><pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r=".85" fill="#b7c2d5" opacity=".32"/></pattern></defs>
  <path fill="url(#dots)" d="M0 0h640v720H0z"/>
  <g stroke="#6351ca" opacity=".09"><circle cx="615" cy="234" r="64" stroke-width="9"/><circle cx="615" cy="234" r="81" stroke-width="1.3"/></g>
  <rect x="28" y="430" width="78" height="78" rx="18" transform="rotate(-12 67 469)" stroke="#087f83" stroke-width="1.5" opacity=".12"/>
  <path d="M398 92v12m-6-6h12" stroke="#6351ca" stroke-width="1.5" stroke-linecap="round" opacity=".16"/>
  <circle cx="280" cy="326" r="6" stroke="#ca951f" stroke-width="1.7" opacity=".20"/>
'''
page += glyph('木', 'translate(102 141) rotate(-8) scale(1.12)', '#df3655', .10)
page += glyph('森', 'translate(497 503) rotate(7) scale(1.2)', '#087f83', .11)
page += glyph('日', 'translate(260 643) rotate(-7) scale(.86)', '#6351ca', .10)
page += '</svg>\n'
(root / 'public/ui-background.svg').write_text(page, encoding='utf-8')

# Fixed, pale edge decorations remain distinct from the colorful moving pieces.
board = '''<svg xmlns="http://www.w3.org/2000/svg" width="560" height="700" viewBox="0 0 560 700" preserveAspectRatio="none" fill="none">
  <g stroke="#6351ca" opacity=".10"><circle cx="588" cy="142" r="64" stroke-width="9"/><circle cx="588" cy="142" r="82" stroke-width="1.3"/></g>
  <rect x="-23" y="321" width="62" height="62" rx="15" transform="rotate(-12 8 352)" stroke="#087f83" stroke-width="1.3" opacity=".14"/>
  <path d="M520 574v12m-6-6h12" stroke="#6351ca" stroke-width="1.5" stroke-linecap="round" opacity=".19"/>
  <circle cx="29" cy="655" r="5" stroke="#ca951f" stroke-width="1.6" opacity=".23"/>
'''
board += glyph('木', 'translate(46 184) rotate(-7) scale(1.1)', '#df3655', .10)
board += glyph('林', 'translate(512 390) rotate(7) scale(1.12)', '#6351ca', .10)
board += glyph('森', 'translate(54 545) rotate(-6) scale(1.2)', '#087f83', .11)
board += '</svg>\n'
(root / 'public/board-background.svg').write_text(board, encoding='utf-8')
print(f'Background SVGs: {len(page.encode()):,} + {len(board.encode()):,} bytes')
