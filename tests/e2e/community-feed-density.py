"""Rendered production CSS: denser feed and complete compact public images."""
import argparse, base64, io, json, re
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--label', default='green')
args = parser.parse_args()
OUT = ROOT / 'test-results/v102/feed-density' / args.label
OUT.mkdir(parents=True, exist_ok=True)

def image(width, height):
    im = Image.new('RGB', (width, height), '#dce8d9')
    draw = ImageDraw.Draw(im)
    for x, y, color in [(0, 0, 'red'), (width-64, 0, 'blue'), (0, height-64, 'green'), (width-64, height-64, 'orange')]:
        draw.rectangle((x, y, x+63, y+63), fill=color)
    draw.ellipse((width//4, height//4, 3*width//4, 3*height//4), outline='#244f40', width=12)
    out = io.BytesIO(); im.save(out, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()

css = (ROOT / 'style.css').read_text()
css = re.sub(r'@import\s+["\']([^"\']+)["\'];', lambda m: (ROOT / m[1]).read_text(), css)
cases = [('portrait', image(600, 900)), ('landscape', image(1200, 600)), ('none', None)] * 2
cards = ''
for i, (shape, src) in enumerate(cases):
    photo = f'<img class="post-image" alt="完整四角测试图片" src="{src}">' if src else ''
    cards += f'<article class="post community-card" data-shape="{shape}">{photo}<div class="post-content"><div class="post-user public-identity"><span class="public-avatar">我</span><strong>合成宠友</strong></div><h2>帖子 {i+1} · {shape}</h2><p class="post-text community-article-text">公开社区测试内容，原图比例保持完整。</p><p class="post-topic">今日萌宠 · 2026/10/8</p><div class="post-actions"><button>点赞 0</button><button>查看详情</button><button>举报</button><button>不想看这篇</button></div></div></article>'
html = f'<!doctype html><html><head><style>{css}</style></head><body><aside class="sidebar"><div class="brand">爪爪日记</div></aside><div class="workspace"><header class="topbar">社区日常</header><main><section class="community-public"><div class="page-heading"><h1>社区</h1><button class="button">写一篇</button></div><div class="feed community-feed">{cards}</div></section></main><footer>每一个普通的日子，都值得被记住。</footer></div></body></html>'
metrics, failures = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in [1682, 1440, 768, 390]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        page.set_content(html)
        page.wait_for_function('Array.from(document.images).every(n => n.complete && n.naturalWidth)')
        state = page.evaluate('''() => {
          const cards=[...document.querySelectorAll('.community-card')],firstY=cards[0].getBoundingClientRect().y;
          return {columns:cards.filter(n=>Math.abs(n.getBoundingClientRect().y-firstY)<1).length,
            overflow:document.documentElement.scrollWidth>innerWidth,
            rows:cards.map(n=>{const c=n.getBoundingClientRect(),i=n.querySelector('img'),r=i?.getBoundingClientRect();return {shape:n.dataset.shape,cardWidth:c.width,imageWidth:r?.width,imageHeight:r?.height,naturalWidth:i?.naturalWidth,naturalHeight:i?.naturalHeight,fit:i?getComputedStyle(i).objectFit:null,buttonHeights:[...n.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)}})};
        }''')
        metrics.append({'viewport': width, **state})
        if width >= 1440 and state['columns'] < 5: failures.append(f'{width}: expected >=5 compact columns, got {state["columns"]}')
        if width == 390 and state['columns'] != 2: failures.append('390: expected two compact columns')
        if state['overflow']: failures.append(f'{width}: horizontal overflow')
        for row in state['rows']:
            if row['imageWidth']:
                if row['imageHeight'] > 241 or row['imageWidth'] > row['cardWidth']+1: failures.append(f'{width} {row["shape"]}: photo exceeds compact bounds {row}')
                if abs(row['imageWidth']/row['imageHeight']-row['naturalWidth']/row['naturalHeight']) > .01 or row['fit'] != 'contain': failures.append(f'{width}: cropped/distorted image {row}')
            if min(row['buttonHeights']) < 44: failures.append(f'{width}: undersized action target')
        for button in page.locator('.community-card button').all():
            button.scroll_into_view_if_needed()
            button.click(trial=True)
        page.screenshot(path=str(OUT / f'{width}.png'), full_page=True)
        page.close()
    browser.close()
(OUT / 'metrics.json').write_text(json.dumps({'metrics': metrics, 'failures': failures}, indent=2))
assert not failures, '\n'.join(failures)
print('PASS: actual workspace feed 1682/1440 compact columns, 390 two columns, <=240px intact portrait/landscape, no overflow, actions reachable.')
