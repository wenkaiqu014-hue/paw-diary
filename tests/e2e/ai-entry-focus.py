"""Real AI-entry UI, no model/auth requests; checks focus, copy and geometry."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4209/')
SOURCE=BASE
OUT=Path(__file__).resolve().parents[2]/'test-results/ai062-focus'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
    results=[]
    for width in (1440,390):
        page=browser.new_page(viewport={'width':width,'height':1000})
        page.route('https://**/*',lambda route:route.abort())
        page.route(BASE+'src/**',lambda route:route.fulfill(path=str(Path(__file__).resolve().parents[2]/route.request.url.split(BASE,1)[1].split('?',1)[0]),content_type='text/javascript'))
        page.goto(BASE+'#health',wait_until='networkidle')
        page.locator('[data-action=record]').first.click()
        page.locator('[data-action=record-mode][data-value=ai]').click()
        focus=page.evaluate('document.activeElement.id || document.activeElement.dataset.action || document.activeElement.tagName')
        results.append({'width':width,'automaticFocus':focus})
        assert focus!='ai-text',f'AI switching stole focus: {focus}'
        # Replace app body with a narrow real feature fixture. Its quota boundary is injected,
        # never a live CloudBase/model request; all UI/copy/CSS remains production code.
        manifest=page.request.get(BASE+'asset-manifest.json').json()
        page.set_content('<link rel="stylesheet" href="'+BASE+manifest['style']+'"><dialog open id="dialog"><h2 id="dialog-title">AI</h2><div id="test-host"></div></dialog>')
        page.evaluate("""async ({source}) => {
            const {createAiEntry}=await import(source+'src/features/ai-entry.js');
            const getScope=()=>({petId:'focus-pet',mode:'local',workspaceId:'focus-fixture',generation:1});
            const snapshot={pets:[{id:'focus-pet',name:'焦点验收宠物',deletedAt:null}],records:[],reminders:[]};
            createAiEntry({request:async()=>({remaining:12}),getRepository:()=>({}),getSnapshot:()=>snapshot,getScope,getLocale:()=> 'zh-CN'}).open({host:document.querySelector('#test-host')});
        }""",{'source':SOURCE})
        expect(page.locator('#ai-quota')).to_contain_text('12')
        quota=page.locator('#ai-quota').inner_text()
        results[-1]['quota']=quota
        for feature in ('一句话记入','成长回顾','记录助手'):
            assert feature in quota,f'Quota must name {feature}: {quota}'
        page.locator('#ai-text').click()
        metrics=page.locator('#ai-text').evaluate("""e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect(),q=document.querySelector('#ai-quota').getBoundingClientRect();return {border:s.borderColor,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,gap:q.top-b.bottom,focusVisible:e.matches(':focus-visible'),lineHeight:getComputedStyle(document.querySelector('#ai-quota')).lineHeight}}""")
        results[-1]['pointer']=metrics
        assert metrics['outline']!='rgb(188, 115, 60)',metrics
        assert metrics['gap']>=16,metrics
        assert float(metrics['outlineWidth'].replace('px',''))<=2,metrics
        page.locator('#ai-parse').focus()
        page.keyboard.press('Shift+Tab')
        keyboard=page.locator('#ai-text').evaluate("""e=>{const s=getComputedStyle(e);return {focused:document.activeElement===e,focusVisible:e.matches(':focus-visible'),outline:s.outlineColor,outlineWidth:s.outlineWidth}}""")
        results[-1]['keyboard']=keyboard
        assert keyboard['focused'] and keyboard['focusVisible'],keyboard
        assert keyboard['outline']!='rgb(188, 115, 60)' and float(keyboard['outlineWidth'].replace('px',''))>=2,keyboard
        page.screenshot(path=str(OUT/f'{width}-focus.png'),full_page=True)
        # Verify translated quota uses the same three actions, not opaque "three features".
        english=page.evaluate("""async ({source})=>{const {setLocale}=await import(source+'src/ui/i18n.js');setLocale('en');const {stage3Text}=await import(source+'src/ui/stage3-copy.js');return stage3Text('quota',{count:12});}""",{'source':SOURCE})
        assert all(s in english for s in ('Write a sentence','Growth recap','Record assistant')),english
        results[-1]['englishQuota']=english
        page.close()
    browser.close()
    (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps(results,ensure_ascii=False))
    print('PASS: AI entry focus, specific quota copy, green focus and separated quota at 1440/390')
