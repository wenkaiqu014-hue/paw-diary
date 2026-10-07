"""Real DOM regressions with real demo repository; model boundary is controlled."""
import json,subprocess,tempfile,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='paw-stage3-review-') as folder:
    out=Path(folder)
    source='''import {createDemoRepository} from './src/data/demo-repository.js';
import {createWeeklyRecap} from './src/features/weekly-recap.js';
import {computeRecapFacts,recapSourceHash} from './src/domain/recap-facts.js';
import {createAiEntry} from './src/features/ai-entry.js';
const repo=createDemoRepository({storage:localStorage});let snapshot=await repo.snapshot(),scope={repository:repo,generation:1,mode:'demo',petId:snapshot.activePetId};
let release;globalThis.__review={pending:false,saved:false};
const recap=createWeeklyRecap({getSnapshot:()=>snapshot,getRepository:()=>repo,getScope:()=>scope,getLocale:()=> 'zh-CN',openModal:()=>false,onChanged:async()=>{snapshot=await repo.snapshot();globalThis.__review.saved=snapshot.profile.stage3.recaps.length===1;recap.mount(document.querySelector('#recap'));},request:async(action,payload)=>{const facts=computeRecapFacts({snapshot,...payload}),sourceHash=await recapSourceHash({snapshot,...payload});globalThis.__review.pending=true;return new Promise(resolve=>{release=()=>resolve({recap:{id:'demo-recap',petId:scope.petId,from:payload.from,to:payload.to,generatedAt:new Date().toISOString(),sourceHash,recordIds:facts.recordIds,reminderIds:facts.reminderIds,facts,story:'仅依据本次日期范围的合成日记。',storySources:facts.recordIds.slice(0,1),uiLocale:'zh-CN'}});});}});
globalThis.__review.release=()=>release();recap.mount(document.querySelector('#recap'));
globalThis.__review.openEntry=()=>createAiEntry({getRepository:()=>repo,getSnapshot:()=>snapshot,getScope:()=>scope,getLocale:()=> 'zh-CN',openModal:(title,html)=>{document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-body').innerHTML=html;document.querySelector('#dialog').showModal();return true;},request:async action=>action==='ai.quota'?{remaining:3}:{today:new Date(Date.now()+8*3600000).toISOString().slice(0,10),drafts:[{draftId:'date-draft',petId:scope.petId,type:'deworm',occurredDate:new Date(Date.now()+8*3600000).toISOString().slice(0,10),value:null,unit:null,title:'合成驱虫',note:'',nextDate:null,missingFields:['nextDate'],sourceText:'今天驱虫了，下个月再做。'}]},onSaved:()=>{globalThis.__review.dateConfirmed=true;}}).open();'''
    script=out/'app.js'
    command="import {build} from 'esbuild';await build({stdin:{contents:"+json.dumps(source,ensure_ascii=False)+",resolveDir:"+json.dumps(str(ROOT))+",sourcefile:'review-entry.js'},bundle:true,format:'esm',outfile:"+json.dumps(str(script))+"});"
    subprocess.run(['node','--input-type=module','-e',command],cwd=ROOT,check=True,capture_output=True)
    (out/'index.html').write_text('<!doctype html><html><body><div id="recap"></div><dialog id="dialog"><h2 id="dialog-title"></h2><div id="dialog-body"></div></dialog><script type="module" src="/app.js"></script></body></html>')
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=folder))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(channel='chrome');page=b.new_page()
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
            expect(page.locator('[data-recap-generate]')).to_be_enabled()
            page.locator('[data-recap-generate]').click();page.wait_for_function('__review.pending')
            expect(page.locator('[data-recap-range]')).to_be_disabled()
            expect(page.locator('[data-recap-from]')).to_be_disabled()
            expect(page.locator('[data-recap-to]')).to_be_disabled()
            page.evaluate('__review.release()');expect(page.locator('.recap-story')).to_be_visible()
            page.locator('[data-recap-save]').click();page.wait_for_function('__review.saved',timeout=5000)
            page.evaluate('__review.openEntry()');page.locator('#ai-text').fill('今天驱虫了，下个月再做。');page.locator('#ai-parse').click()
            expect(page.locator('.ai-draft')).to_have_count(1)
            assert page.locator('[name=nextDate]').evaluate('e=>e.required')
            page.locator('#ai-confirm').click();assert not page.evaluate('!!__review.dateConfirmed')
            page.locator('[name=skipNextDate]').check()
            assert page.locator('[name=nextDate]').is_disabled()
            page.locator('#ai-confirm').click();page.wait_for_function('__review.dateConfirmed')
            assert not errors,errors
            b.close()
            print('PASS: recap date lock, real demo saves, and ambiguous next date requires explicit choice')
    finally:server.shutdown();server.server_close()
