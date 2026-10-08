"""Layout regression at narrow CSS widths; does not claim native Windows zoom."""
import functools,json,threading,os
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/v100/zoom-layout';OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=True)
  for width in [637,768,390,1440]:
   page=browser.new_page(viewport={'width':width,'height':540});page.set_default_timeout(10000)
   page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
   close=page.locator('[data-help-close]')
   if close.is_visible():close.click()
   page.locator('#workspace-controls p').wait_for()
   metrics=page.evaluate('''()=>{
    const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const container=document.querySelector('#workspace-controls'),para=container.querySelector('p'),assistant=document.querySelector('#assistant-launcher, .assistant-launcher');
    return {container:box(container),paragraph:box(para),assistant:assistant?box(assistant):null,buttons:[...container.querySelectorAll('button')].filter(n=>n.offsetWidth).map(box),overflow:document.documentElement.scrollWidth-innerWidth};
   }''')
   page.screenshot(path=str(OUT/f'{width}.png'),full_page=True)
   results.append({'width':width,**metrics})
   (OUT/'metrics.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
   assert metrics['paragraph']['width'] >= min(160,metrics['container']['width']-40), f'{width}: paragraph compressed: {metrics}'
   assert metrics['overflow']<=1,f'{width}: horizontal overflow: {metrics}'
   for rect in metrics['buttons']:
    assistant=metrics['assistant']
    if assistant:
     assert not (rect['x']<assistant['right'] and rect['right']>assistant['x'] and rect['y']<assistant['bottom'] and rect['bottom']>assistant['y']), f'{width}: assistant overlaps control'
    assert rect['width']>=44 and rect['height']>=44 and rect['right']<=width+1,f'{width}: unreachable button: {rect}'
   # Bring login/local controls into the viewport and check no floating action covers them.
   for button in page.locator('#workspace-controls button:visible').all():
    button.scroll_into_view_if_needed()
    assert button.evaluate('''n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n}'''), f'{width}: control obscured'
   page.close()
  browser.close()
finally:server.shutdown()
print('PASS readable banner, reachable unobscured controls, no horizontal overflow at 390/637/768/1440 CSS widths')
