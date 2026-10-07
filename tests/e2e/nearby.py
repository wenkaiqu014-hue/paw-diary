# coding: utf-8
"""Real Chrome, local synthetic discovery fixture; never a cloud acceptance claim."""
import json, os, threading
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[2]
out=root/'test-results/stage4/nearby-ui';out.mkdir(parents=True,exist_ok=True)
server=None
url=os.environ.get('PAW_NEARBY_FIXTURE_URL')
if not url:
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/test-results/stage4/nearby-fixture.html'
checks=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=os.environ.get('PAW_HEADFUL')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        try:
            for width in [390,768,1440]:
                page=browser.new_page(viewport={'width':width,'height':1000});errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(url,wait_until='networkidle')
                assert page.evaluate('window.nearbyReady'), 'mountNearby尚未实现（预期RED）'
                expect(page.locator('[data-view-profile]')).to_have_count(3)
                page.locator('[data-nearby-join]').click();assert page.evaluate('window.fixture.loginCalls')==1
                page.evaluate("window.fixture.session={userId:'a',generation:2}");page.locator('[data-nearby-refresh]').click()
                expect(page.locator('[data-nearby-own]')).to_have_count(1)
                page.locator('[data-nearby-scope="city"]').click();expect(page.locator('[data-view-profile]')).to_have_count(2)
                assert page.evaluate('typeof window.nearbyView.setBrowseRegion')=='function', '外部浏览地区接口尚未实现（预期RED）'
                page.locator('[data-nearby-regions] [data-region-district]').select_option('440305')
                expect(page.locator('[data-view-profile]')).to_have_count(1)
                assert page.evaluate('window.fixture.browse.districtId')=='440305'
                page.evaluate("window.nearbyView.setBrowseRegion({cityId:'310000',cityName:'上海市',districtId:null,districtName:null})")
                expect(page.locator('[data-view-profile="author-b"]')).to_have_count(1)
                expect(page.locator('[data-nearby-regions] [data-region-district]')).to_have_value('')
                assert page.evaluate('window.fixture.browse.districtId') is None
                assert page.evaluate('window.fixture.profileWrites')==0
                page.evaluate("window.nearbyView.setBrowseRegion({cityId:'440300',cityName:'深圳市',districtId:null,districtName:null})")
                expect(page.locator('[data-view-profile]')).to_have_count(2)
                page.locator('[data-nearby-regions] [data-region-district]').select_option('440305')
                expect(page.locator('[data-view-profile]')).to_have_count(1)
                page.locator('[data-nearby-regions] [data-region-city]').select_option('310000')
                expect(page.locator('[data-nearby-regions] [data-region-district]')).to_have_value('')
                expect(page.locator('[data-view-profile="author-b"]')).to_have_count(1)
                assert page.evaluate('window.fixture.browse.districtId') is None
                page.locator('[data-nearby-regions] [data-region-city]').select_option('440300')
                expect(page.locator('[data-view-profile]')).to_have_count(2)
                page.locator('[data-nearby-pet="cat"]').click();expect(page.locator('[data-view-profile]')).to_have_count(1)
                page.locator('[data-nearby-purpose]').select_option('养猫交流');expect(page.locator('[data-view-profile]')).to_have_count(1)
                assert page.evaluate('window.fixture.profileWrites')==0
                page.locator('[data-view-profile="author-a"]').click();expect(page.locator('[data-nearby-detail]')).to_be_visible()
                page.locator('[data-nearby-posts]').click();assert page.evaluate('window.fixture.viewedAuthor')=='author-a'
                page.evaluate("window.fixture.withdraw('author-a')");page.locator('[data-nearby-refresh]').click()
                expect(page.locator('[data-nearby-detail]')).to_be_hidden();expect(page.locator('[data-nearby-empty]')).to_be_visible()
                page.evaluate('window.fixture.fail=true');page.locator('[data-nearby-refresh]').click();expect(page.locator('[data-nearby-error]')).to_be_visible()
                page.evaluate('window.fixture.fail=false');page.locator('[data-nearby-retry]').click();expect(page.locator('[data-nearby-empty]')).to_be_visible()
                page.locator('[data-nearby-clear]').click();expect(page.locator('[data-view-profile]')).to_have_count(2)
                page.locator('[data-nearby-scope="all"]').click();expect(page.locator('[data-view-profile]')).to_have_count(2)
                page.evaluate("window.fixture.locale='en';window.nearbyView.refreshLocale()")
                expect(page.get_by_role('heading',name='Find pet friends')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth')
                assert not errors,errors
                page.screenshot(path=str(out/f'{width}-en.png'),full_page=True)
                page.evaluate('window.fixture.holdNextList=true');page.locator('[data-nearby-refresh]').click()
                page.wait_for_function('typeof window.fixture.releaseList==="function"')
                page.evaluate("window.fixture.withdraw('author-b');window.fixture.session={userId:'c',generation:99};window.fixture.mount();window.fixture.releaseList()")
                expect(page.locator('[data-view-profile]')).to_have_count(1)
                expect(page.locator('[data-view-profile="author-b"]')).to_have_count(0)
                page.evaluate('window.fixture.holdNextDetail=true');page.locator('[data-view-profile="author-c"]').click()
                page.wait_for_function('typeof window.fixture.releaseDetail==="function"')
                page.evaluate("window.fixture.session={userId:'a',generation:100};window.fixture.mount();window.fixture.releaseDetail()")
                expect(page.locator('[data-nearby-detail]')).to_be_hidden()
                assert not errors,errors
                checks.append({'width':width,'anonymousRead':True,'ownLabel':True,'filters':True,'withdrawRefresh':True,'emptyErrorRetry':True,'publicPostsLink':True,'lateIdentityResponses':True,'profileWrites':0,'pageErrors':len(errors)})
                page.close()
        finally:browser.close()
finally:
    if server:server.shutdown();server.server_close()
print(json.dumps(checks))
