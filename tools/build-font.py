"""Generate a small OFL font without changing the game's glyph outlines."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent / 'python-deps'))
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.varLib.instancer import instantiateVariableFont
import json

root = Path(__file__).resolve().parent.parent
source = root / 'assets/fonts/NotoSerifJP-Bold.ttf'
target = root / 'public/fonts/KanjiTowerSerif.woff2'
text = ''.join(chr(i) for i in range(32, 127))
for path in (root / 'src').rglob('*'):
    if path.suffix in ('.ts', '.json', '.css') and path.name != 'glyphs.json':
        text += path.read_text(encoding='utf-8')
text += (root / 'index.html').read_text(encoding='utf-8')
variable = root / 'assets/fonts/NotoSerifJP-Variable.ttf'
if not source.exists() or variable.stat().st_mtime > source.stat().st_mtime:
    instance = instantiateVariableFont(TTFont(variable), {'wght': 700}, inplace=True)
    instance.save(source)
font = TTFont(source)
options = subset.Options()
options.flavor = 'woff2'
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
names = {1: 'Kanji Tower Serif', 2: 'Bold', 3: 'KanjiTowerSerif-Bold-1',
         4: 'Kanji Tower Serif Bold', 6: 'KanjiTowerSerif-Bold', 16: 'Kanji Tower Serif', 17: 'Bold'}
for record in font['name'].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.flavor = 'woff2'
font.save(target)

# Compare decoded contours, including composite glyph decomposition.
original, output = TTFont(source), TTFont(target)
def drawing(font, char):
    glyphs = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[font.getBestCmap()[ord(char)]].draw(pen)
    return pen.value
characters = json.loads((root / 'src/data/kanji.json').read_text(encoding='utf-8'))
for item in characters:
    assert drawing(original, item['char']) == drawing(output, item['char']), item['char']
print(f'{len(characters)} game glyphs unchanged; font {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')

# Dela Gothic's naturally heavy strokes are used only for prominent UI text.
heading_text = text
heading = TTFont(root / 'assets/fonts/DelaGothicOne-Regular.ttf')
heading_subsetter = subset.Subsetter(options=options)
heading_subsetter.populate(text=heading_text)
heading_subsetter.subset(heading)
heading_names = {1: 'Kanji Tower Display', 2: 'Regular', 3: 'KanjiTowerDisplay-Heavy-1',
                 4: 'Kanji Tower Display', 6: 'KanjiTowerDisplay-Heavy',
                 16: 'Kanji Tower Display', 17: 'Regular'}
for record in heading['name'].names:
    if record.nameID in heading_names:
        record.string = heading_names[record.nameID].encode(record.getEncoding())
heading.save(root / 'assets/fonts/KanjiTowerDisplay-Heavy.ttf')
heading.flavor = 'woff2'
heading_target = root / 'public/fonts/KanjiTowerDisplay.woff2'
heading.save(heading_target)
assert all(ord(char) in heading.getBestCmap() for char in '合体！漢字タワーバトル総画数次の漢字を選ぶ回転0123456789')
print(f'Heavy Gothic UI font: {heading_target.stat().st_size:,} bytes; gameplay remains Serif Bold')

# Only the title's short exclamation uses the dedicated display face.
impact = TTFont(root / 'assets/fonts/MochiyPopOne-Regular.ttf')
impact_subset = subset.Subsetter(options=options)
impact_subset.populate(text='合体！')
impact_subset.subset(impact)
impact_names = {1:'Kanji Tower Impact',2:'Regular',3:'KanjiTowerImpact-1',4:'Kanji Tower Impact',6:'KanjiTowerImpact',16:'Kanji Tower Impact',17:'Regular'}
for record in impact['name'].names:
    if record.nameID in impact_names:
        record.string=impact_names[record.nameID].encode(record.getEncoding())
impact.save(root / 'assets/fonts/KanjiTowerImpact.ttf')
impact.flavor='woff2'
impact.save(root / 'public/fonts/KanjiTowerImpact.woff2')
assert all(ord(char) in impact.getBestCmap() for char in '合体！')
print(f'Title accent font: {(root / "public/fonts/KanjiTowerImpact.woff2").stat().st_size:,} bytes')
