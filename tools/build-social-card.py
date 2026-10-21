"""Build the public share artwork using the game's licensed serif font."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent.parent
font_path=root/'assets/fonts/NotoSerifJP-Bold.ttf'
heading_font_path=root/'assets/fonts/KanjiTowerDisplay-Heavy.ttf'
# Reuse the game's palette so equal stroke counts match in static artwork too.
palette=json.loads(subprocess.check_output(['node','--import','tsx','--input-type=module','-e',
    "import {kanji,color} from './src/data/index.ts'; process.stdout.write(JSON.stringify(Object.fromEntries(kanji.map(k=>[k.char,color(k.char)]))))"],cwd=root,text=True,encoding='utf-8'))
image=Image.new('RGB',(1200,630),'#ffffff')
d=ImageDraw.Draw(image)
def text(x,y,s,size,color='#212b45',heading=False):
    d.text((x,y),s,font=ImageFont.truetype(str(heading_font_path if heading else font_path),size),fill=color)
d.rounded_rectangle((685,38,1162,592),radius=36,fill='#fffefa')
text(64,71,'合体！',51,'#df3655',heading=True)
text(64,140,'漢字',128,'#df3655',heading=True)
text(64,299,'タワーバトル',72,heading=True)
d.rounded_rectangle((68,470,298,539),radius=14,fill='#df3655')
text(113,478,'遊ぶ',32,'#ffffff',heading=True)
d.line((230,505,263,505),fill='#ffffff',width=2)
d.line((255,498,263,505,255,512),fill='#ffffff',width=2)
text(825,71,'木',135,palette['木'])
text(795,219,'森',145,palette['森'])
text(752,375,'日',112,palette['日'])
text(951,373,'月',112,palette['月'])
d.rectangle((742,526,1102,538),fill='#293757')
d.rectangle((742,526,1102,528),fill='#526078')
image.save(root/'public/social-card.png',optimize=True)

# Use the same font outline for the browser icon; no system-font substitution.
glyphs=json.loads((root/'src/data/glyphs.json').read_text(encoding='utf-8'))
coordinates={'M':('x','y'),'L':('x','y'),'Q':('x1','y1','x','y'),'C':('x1','y1','x2','y2','x','y'),'Z':()}
def icon_glyph(char, transform):
    path=' '.join(c['type']+' '.join(str(c[key]) for key in coordinates[c['type']])
                  for c in glyphs[char]['commands'])
    return f'<path data-kanji="{char}" d="{path}" transform="{transform}" fill="white" stroke="white" stroke-width=".8" stroke-linejoin="round"/>'

icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#df3655"/>'
icon+=icon_glyph('木','translate(32 17) rotate(-8) scale(.27)')
icon+=icon_glyph('林','translate(32 45) scale(.36)')
icon+='<g stroke="white" stroke-linecap="round" fill="none"><path d="M16 8v9M47 6v8" stroke-width="2" opacity=".65"/><path d="M13 60h38" stroke-width="2.5"/></g></svg>\n'
(root/'public/icon.svg').write_text(icon,encoding='utf-8')

# A font specimen for inspecting stroke contrast; this is not a browser screenshot.
specimen=Image.new('RGB',(1200,340),'#ffffff')
sd=ImageDraw.Draw(specimen)
sf=ImageFont.truetype(str(font_path),115)
for i,char in enumerate('木日月口森想'):
    sd.text((55+i*185,65),char,font=sf,fill=palette[char])
sd.line((45,257,1155,257),fill='#e4eaf5',width=1)
sf=ImageFont.truetype(str(font_path),24)
sd.text((48,278),'Noto Serif JP Bold',font=sf,fill='#6c7c99')
specimen.save(root/'docs/font-specimen.png')
