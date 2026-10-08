"""Actual app chrome-avatar function and production loader in synthetic DOM; no cloud."""
import base64, functools, hashlib, io, json, re, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/v101/chrome-avatar'
OUT.mkdir(parents=True, exist_ok=True)
picture = Image.new('RGB', (120, 120), '#315b48')
draw = ImageDraw.Draw(picture)
draw.ellipse((30, 30, 90, 90), fill='#efd8ab')
raw = io.BytesIO(); picture.save(raw, format='PNG'); raw = raw.getvalue()
reply = {'dataUrl': 'data:image/png;base64,' + base64.b64encode(raw).decode(), 'sha256': hashlib.sha256(raw).hexdigest()}
css = (ROOT / 'style.css').read_text()
css = re.sub(r'@import\s+["\']([^"\']+)["\'];', lambda m: (ROOT / m[1]).read_text(), css)
source = (ROOT / 'app.js').read_text()
start = source.index('function updatePublicIdentityChrome(){')
end = source.index('\nfunction setCommunityBrowseRegion', start)
actual_function = source[start:end]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for width in [1440, 390]:
            page = browser.new_page(viewport={'width': width, 'height': 900})
            page.goto(f'http://127.0.0.1:{server.server_port}/package.json')
            page.set_content('<style>' + css + '</style><aside class="sidebar"><button class="profile-link" id="about-button"><span class="owner-avatar">我</span><span>我的成长手账<small>本地体验</small></span><span></span></button></aside><header class="topbar"><div>Avatar test</div><div class="top-actions"><button id="owner-profile-button" class="owner-avatar small owner-profile-button">我</button></div></header>')
            page.evaluate('''async ({actualFunction, reply}) => {
              const {createCommunityImageLoader} = await import('/src/media/community-images.js');
              const $ = s => document.querySelector(s);
              let locale='zh-CN',authPrincipal={userId:'A'},communityIdentityGeneration=1;
              let publicProfile={nickname:'Alpha',authorId:'author-A',avatarAssetId:'avatar-A'};
              let publicChromeAvatarTurn=0,publicChromeAvatar=null,reads=0,mode='ok',releaseA;
              const getLocale=()=>locale;
              const communitySession=()=>({userId:authPrincipal?.userId??null,generation:communityIdentityGeneration});
              const loader=createCommunityImageLoader({read:async ({assetId})=>{
                reads++; if(mode==='fail')throw Error('Synthetic failed read');
                if(mode==='defer' && assetId==='late-A')await new Promise(resolve=>releaseA=resolve);
                return reply;
              }});
              const getCommunityImages=()=>loader;
              eval(actualFunction + `;window.avatarTest={
                update:updatePublicIdentityChrome,
                getReads:()=>reads,
                locale:()=>{locale='en';updatePublicIdentityChrome()},
                remove:()=>{publicProfile.avatarAssetId=null;updatePublicIdentityChrome()},
                fail:()=>{mode='fail';publicProfile.avatarAssetId='failed';updatePublicIdentityChrome()},
                startLate:()=>{mode='defer';publicProfile.avatarAssetId='late-A';updatePublicIdentityChrome()},
                switchB:()=>{authPrincipal={userId:'B'};communityIdentityGeneration++;publicProfile={nickname:'Beta',authorId:'author-B',avatarAssetId:'avatar-B'};updatePublicIdentityChrome()},
                resolveLate:()=>releaseA(),
                current:()=>publicChromeAvatar
              }`);
              window.avatarTest.update();
            }''', {'actualFunction': actual_function, 'reply': reply})
            page.wait_for_function('document.querySelectorAll(".owner-avatar img").length===2 && [...document.querySelectorAll(".owner-avatar img")].every(n=>n.complete&&n.naturalWidth===120)')
            metrics = page.locator('.owner-avatar').evaluate_all('''nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),i=n.querySelector('img'),b=i.getBoundingClientRect(),s=getComputedStyle(i);return {id:n.id||'side',width:r.width,height:r.height,imageWidth:b.width,imageHeight:b.height,dx:b.x-r.x,dy:b.y-r.y,fit:s.objectFit,radius:s.borderRadius,naturalWidth:i.naturalWidth}})''')
            for item in metrics:
                if item['width'] == 0:
                    assert width == 390 and item['id'] == 'side', item
                    continue  # Production mobile layout intentionally hides the sidebar.
                assert item['width'] == item['height'] and item['width'] in [31, 36], item
                assert item['imageWidth'] == item['width'] and item['imageHeight'] == item['height'], item
                assert abs(item['dx']) < .1 and abs(item['dy']) < .1 and item['radius']=='50%' and item['fit']=='cover', item
            page.screenshot(path=str(OUT / f'{width}.png'))
            reads = page.evaluate('avatarTest.getReads()')
            page.evaluate('avatarTest.locale()')
            assert page.evaluate('avatarTest.getReads()') == reads
            assert page.locator('.owner-avatar img').count() == 2
            page.evaluate('avatarTest.remove()')
            assert page.locator('.owner-avatar img').count() == 0 and page.locator('#owner-profile-button').inner_text() == 'A'
            page.evaluate('avatarTest.fail()')
            page.wait_for_timeout(50)
            assert page.locator('.owner-avatar img').count() == 0 and page.locator('#owner-profile-button').inner_text() == 'A'
            page.evaluate('avatarTest.startLate()')
            page.wait_for_timeout(50)
            page.evaluate('avatarTest.switchB()')
            page.wait_for_function('document.querySelectorAll(".owner-avatar img").length===2')
            page.evaluate('avatarTest.resolveLate()')
            page.wait_for_timeout(50)
            assert 'avatar-B' in page.evaluate('avatarTest.current().key') and 'late-A' not in page.evaluate('avatarTest.current().key')
            results.append({'viewport':width,'metrics':metrics,'localeCache':True,'removalFallback':True,'readFailureFallback':True,'lateOwnerIsolation':True,'fixtureSha256':reply['sha256']})
            page.close()
        browser.close()
finally:
    server.shutdown()
(OUT / 'metrics.json').write_text(json.dumps(results, indent=2))
print('PASS chrome top/sidebar PNG decode, square/center/circle, locale cache, removal/read failure fallback and late-owner isolation at 1440/390.')
