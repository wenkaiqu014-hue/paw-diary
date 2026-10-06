"""管理键盘定位、真实拖动和旧版完成史文案的用户行为回归。"""
from playwright.sync_api import sync_playwright,expect
import os,json
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4191/')
results={}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for case in ('keyboard_sort_focus','legacy_deleted_completion','real_drag'):
        context=b.new_context(viewport=dict(width=1440,height=1000));page=context.new_page();page.set_default_timeout(6000)
        try:
            page.goto(BASE+'#health',wait_until='networkidle')
            raw=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo'))")
            first=raw['pets'][0]['id']
            raw['pets'] += [{**raw['pets'][0],'id':f'quality-{i}','name':f'验收宠物{i}'} for i in (1,2)]
            raw['reminders'].append(dict(id='legacy-deleted',petId=first,title='旧版已删完成史',dueDate='2026-10-06',status='completed',originRecordId=None,completionRecordId=None,completedAt='2026-10-06T00:00:00.000Z',completionRecordDeleted=True,deletedAt=None))
            page.evaluate("raw=>localStorage.setItem('paw-diary:v3:demo',JSON.stringify(raw))",raw);page.reload(wait_until='networkidle')
            if case=='keyboard_sort_focus':
                page.get_by_role('button',name='上移验收宠物1',exact=True).focus();page.keyboard.press('Enter')
                page.wait_for_function("JSON.parse(localStorage.getItem('paw-diary:v3:demo')).pets[0].id==='quality-1'")
                assert page.evaluate("document.activeElement.dataset.action==='select-pet'&&document.activeElement.dataset.id==='quality-1'"),'排序后应回到同一只宠物的可用条目，不能退回main'
            elif case=='legacy_deleted_completion':
                page.get_by_role('button',name='已完成',exact=True).click()
                row=page.locator('.reminder').filter(has_text='旧版已删完成史')
                expect(row).to_contain_text('旧版关联记录已删除')
                assert '移入回收站' not in row.inner_text(),'旧版物理删除不能声称当前可从回收站恢复'
            else:
                handle=page.get_by_role('button',name='拖动排序糯米',exact=True)
                target=page.locator('.pet-entry[data-id="quality-2"]')
                a=handle.bounding_box();z=target.bounding_box()
                x,y=a['x']+a['width']/2,a['y']+a['height']/2
                page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+3,y+3);page.mouse.move(x+10,y+10)
                page.mouse.move(z['x']+z['width']/2,z['y']+z['height']/2,steps=15);page.mouse.up()
                page.wait_for_function("id=>JSON.parse(localStorage.getItem('paw-diary:v3:demo')).pets[2].id===id",arg=first)
                assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo')).pets.map(p=>p.id)")==['quality-1','quality-2',first]
                page.reload(wait_until='networkidle')
                assert page.locator('.pet-entry').last.get_attribute('data-id')==first
            results[case]='PASS'
        except Exception as e:results[case]='FAIL: '+str(e).split('\n')[0]
        finally:context.close()
    b.close()
print(json.dumps(results,ensure_ascii=False))
assert all(x=='PASS' for x in results.values()),results
