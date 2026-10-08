"""Real Chromium CSS layout of synthetic portrait/landscape images; no live account."""
import argparse, base64, io, json, re
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--label', default='green')
args = parser.parse_args()
OUT = ROOT / 'test-results/v101/image-layout' / args.label
OUT.mkdir(parents=True, exist_ok=True)

def fixture(width, height):
    image = Image.new('RGB', (width, height), '#e7eee0')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width-1, height-1), outline='#244f40', width=16)
    for x, y, color in [(0, 0, 'red'), (width-64, 0, 'blue'), (0, height-64, 'green'), (width-64, height-64, 'orange')]:
        draw.rectangle((x, y, x+63, y+63), fill=color)
    draw.ellipse((width//4, height//4, 3*width//4, 3*height//4), outline='#244f40', width=16)
    out = io.BytesIO()
    image.save(out, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()

css = (ROOT / 'style.css').read_text()
css = re.sub(r'@import\s+["\']([^"\']+)["\'];', lambda match: (ROOT / match[1]).read_text(), css)
cases = [('portrait', fixture(600, 900)), ('landscape', fixture(1200, 600))]
sections = ''
for surface, image_class in [('community-editor-dialog', 'photo-preview'), ('community-detail-dialog', 'photo-preview'), ('community-public', 'post-image')]:
    for shape, src in cases:
        sections += f'<section class="{surface}" style="width:min(720px,calc(100% - 32px));padding:25px;margin:24px auto;background:white"><h2>{surface}: {shape}</h2><img class="{image_class}" data-test="{surface}-{shape}" src="{src}"></section>'
sections += '<img class="photo-preview" id="unrelated-photo" alt="outside-community" src="' + cases[0][1] + '">'
metrics, failures = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in [1440, 390]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        page.set_content('<!doctype html><html><head><style>' + css + '</style></head><body>' + sections + '</body></html>')
        page.wait_for_function('Array.from(document.images).every(n => n.complete && n.naturalWidth)')
        rows = page.locator('[data-test]').evaluate_all('''nodes => nodes.map(n => {
            const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect(),s=getComputedStyle(n);
            return {case:n.dataset.test,width:r.width,height:r.height,naturalWidth:n.naturalWidth,naturalHeight:n.naturalHeight,fit:s.objectFit,parentWidth:p.width};
        })''')
        for row in rows:
            metrics.append({'viewport': width, **row})
            expected = row['naturalWidth'] / row['naturalHeight']
            actual = row['width'] / row['height']
            if abs(actual-expected) > .01 or row['fit'] != 'contain':
                failures.append(f'{width} {row["case"]}: image cropped/distorted {row}')
            height_limit = 241 if row['case'].startswith('community-public-') else 481
            if row['height'] > height_limit or row['width'] > row['parentWidth']:
                failures.append(f'{width} {row["case"]}: image exceeds content/viewport bound {row}')
        assert page.locator('#unrelated-photo').evaluate('n => n.getBoundingClientRect().height') == 150, 'Unrelated photo-preview changed'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
        page.screenshot(path=str(OUT / f'{width}.png'), full_page=True)
        page.close()
    browser.close()
(OUT / 'metrics.json').write_text(json.dumps({'metrics': metrics, 'failures': failures}, indent=2))
assert not failures, '\n'.join(failures)
print('PASS: portrait/landscape original ratios and complete contain rendering at 1440/390; unrelated preview remains unchanged.')
