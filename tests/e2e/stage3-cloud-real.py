"""Real A-only stage3 acceptance. No credentials or private content are printed; no OTP sent."""
import argparse, importlib.util, json, subprocess, time, uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/stage3/cloud'
spec=importlib.util.spec_from_file_location('auth_acceptance',ROOT/'tests/e2e/cloud-auth-real.py')
authmod=importlib.util.module_from_spec(spec);spec.loader.exec_module(authmod)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:4199/')
    parser.add_argument('--sessions',type=Path,required=True)
    parser.add_argument('--headed',action='store_true')
    parser.add_argument('--resume-fixture',action='store_true')
    parser.add_argument('--verify-persistence-only',action='store_true',help='Reuse prior model evidence and verify saved current-fixture data without new AI calls.')
    parser.add_argument('--skip-parse',action='store_true',help='Use real authenticated saveBatch for the marked fixture; consume no parse-model call.')
    args=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True)
    observer=OUT/'session-observer.js'
    built=subprocess.run(['node','tests/helpers/browser-session-bootstrap.mjs','--outfile',str(observer)],cwd=ROOT,capture_output=True,timeout=25)
    if built.returncode:raise authmod.SafeFailure('BOOTSTRAP_BUILD_FAILED')
    bridge=OUT/'real-user-bridge.js'
    source='''import cloudbase from '@cloudbase/js-sdk';
let app; const config=()=>globalThis.__PAW_PUBLIC_CONFIG__;
const sdk=()=>{app??=cloudbase.init({env:config().environmentId,region:config().region,accessKey:config().publishableKey});return app.auth();};
const call=async(name,action,payload={},extra={})=>{const s=await sdk().getSession();if(!s.data?.session?.access_token)throw new Error('SESSION_MISSING');let r=await app.callFunction({name,data:{version:1,action,payload,authToken:s.data.session.access_token,requestId:crypto.randomUUID(),...extra}});r=r.result??r;if(typeof r==='string')r=JSON.parse(r);if(!r.ok)throw new Error(r.error?.code??'API_FAILED');return r;};
globalThis.__stage3Real={async saveOwnBatch(marker){const r=await call('paw-api','health.snapshot'),snap=r.data,pet=snap.pets.find(p=>p.name===marker&&p.deletedAt===null);if(!pet||!marker.startsWith('阶段3合成验收-'))throw new Error('FIXTURE_MISSING');const existing=snap.records.filter(x=>x.petId===pet.id&&x.deletedAt===null&&x.note==='阶段3纯合成验收：'+marker);if(existing.length)return{realBatch:true,fixtureRecordIds:existing.map(x=>x.id),reused:true};const result=await call('paw-api','records.saveBatch',{inputs:[{petId:pet.id,type:'weight',occurredDate:new Date(Date.now()+8*3600000).toISOString().slice(0,10),value:4.6,unit:'kg',title:'阶段3合成验收体重',note:'阶段3纯合成验收：'+marker,nextDate:null}]},{expectedRevision:r.revision,expectedWorkspaceId:r.workspaceId,idempotencyKey:crypto.randomUUID()});return{realBatch:true,fixtureRecordIds:result.data.records.map(x=>x.id),reused:false};},async verify(marker){const session=await sdk().getSession(),proof=await call('paw-auth','auth.session'),r=await call('paw-api','health.snapshot');const snap=r.data,pet=snap.pets.find(p=>p.name===marker&&p.deletedAt===null),records=snap.records.filter(x=>x.petId===pet?.id&&x.deletedAt===null),progress=snap.profile.stage3?.onboardingByPet?.[pet?.id],recaps=(snap.profile.stage3?.recaps??[]).filter(x=>x.petId===pet?.id);return{trustedOwner:proof.data.principal.userId===session.data.user?.id||proof.data.principal.userId===session.data.session?.user?.id,privateSnapshot:snap.mode==='account',fixtureExists:!!pet,fixtureRecords:records.length,progressSaved:!!progress,recapSaved:recaps.length>0,recapSourcesOwned:recaps.every(x=>x.recordIds.every(id=>records.some(r=>r.id===id))),revision:r.revision};}};'''
    buildcode="import {build} from 'esbuild'; await build({stdin:{contents:"+json.dumps(source)+",resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:"+json.dumps(str(bridge))+",logLevel:'silent'});"
    built=subprocess.run(['node','--input-type=module','-e',buildcode],cwd=ROOT,capture_output=True,timeout=25)
    if built.returncode:raise authmod.SafeFailure('BRIDGE_BUILD_FAILED')
    marker=json.loads((OUT/'real-A-flags.json').read_text())['fixtureMarker'] if args.resume_fixture else '阶段3合成验收-'+uuid.uuid4().hex[:8]
    if not isinstance(marker,str) or not marker.startswith('阶段3合成验收-'):raise authmod.SafeFailure('FIXTURE_MARKER_MISSING')
    previous=json.loads((OUT/'real-A-flags.json').read_text()) if args.verify_persistence_only else {}
    flags={'realSdk':True,'mockProvider':False,'mailSent':False,'onlyActorA':True}
    if args.verify_persistence_only:
        for name in ('authenticatedBatchDirect','batchSaved','realRecap','recapSaved','recapSourcesOwned','realAssistant','assistantSourceVisible'):
            if previous.get(name) is not True:raise authmod.SafeFailure('PRIOR_MODEL_EVIDENCE_MISSING')
            flags[name]=True
        flags['modelsReusedFromPriorSuccessfulSteps']=True
    helper=None;ok=False;stage='resume'
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(channel='chrome',headless=not args.headed)
        helper=authmod.Acceptance(browser,args,observer)
        try:
            helper.resume('A',{})
            actor=helper.actors['A'];page=actor['page'];page.set_default_timeout(12000)
            page.add_script_tag(path=str(bridge))
            observed=page.evaluate('async()=>{try{return await __stage3Real.verify(null)}catch(e){return {safeFailure:["UNAUTHENTICATED","INVALID_INPUT","UNAVAILABLE","SESSION_MISSING","API_FAILED"].includes(e.message)?e.message:"SDK_REQUEST_FAILED"}}}')
            if observed.get('safeFailure'):raise authmod.SafeFailure(observed['safeFailure'])
            if not observed['trustedOwner'] or not observed['privateSnapshot']:raise authmod.SafeFailure('TRUSTED_OWNER_NOT_PROVEN')
            flags.update(trustedOwner=True,privateSnapshot=True,resumed=True)
            stage='fixture_pet'
            if args.resume_fixture:
                page.locator('.pet-entry').filter(has_text=marker).locator('[data-action=select-pet]').click()
                flags['fixtureReused']=True
            else:
                page.locator('[data-action=new-pet]').first.click();expect(page.locator('#pet-form')).to_be_visible()
                page.locator('#pet-form [name=name]').fill(marker);page.locator('#pet-form [name=type]').select_option('cat')
                page.locator('#pet-form [name=estimatedAgeMonths]').fill('12');page.locator('#pet-form [type=submit]').click()
                expect(page.locator('#dialog')).not_to_be_visible(timeout=20000)
                page.wait_for_timeout(800);helper.checkpoint('A',actor,'fixture_checkpoint')
                observed=page.evaluate('marker=>__stage3Real.verify(marker)',marker)
                if not observed['fixtureExists'] or not observed['progressSaved']:raise authmod.SafeFailure('PET_ONBOARDING_NOT_PERSISTED')
            observed=page.evaluate('marker=>__stage3Real.verify(marker)',marker)
            if not observed['fixtureExists'] or not observed['progressSaved']:raise authmod.SafeFailure('PET_ONBOARDING_NOT_PERSISTED')
            flags.update(fixtureCreated=True,onboardingSaved=True)
            stage='records_batch'
            if args.skip_parse:
                receipt=page.evaluate('marker=>__stage3Real.saveOwnBatch(marker)',marker)
                (OUT/'batch-own-receipt.json').write_text(json.dumps(receipt))
                flags['authenticatedBatchDirect']=True
                page.reload(wait_until='domcontentloaded');helper.assert_cloud('A',actor);helper.checkpoint('A',actor,'batch_refresh_checkpoint');page.add_script_tag(path=str(bridge))
                page.locator('.pet-entry').filter(has_text=marker).locator('[data-action=select-pet]').click()
            else:
                page.locator('[data-action=record]').first.click()
                page.locator('[data-action=ai-entry]').first.click();expect(page.locator('#ai-entry-form')).to_be_visible()
                page.locator('#ai-text').fill(marker+'今天称重4.6公斤。')
                page.locator('#ai-parse').click();expect(page.locator('#ai-confirm')).to_be_visible(timeout=40000)
                
                for row in page.locator('.ai-draft').all():
                    row.locator('[name=petId]').select_option(label=marker)
                    row.locator('[name=note]').fill('阶段3纯合成验收：'+marker)
                page.locator('#ai-confirm').click();expect(page.locator('#dialog')).not_to_be_visible(timeout=25000)
            helper.checkpoint('A',actor,'batch_checkpoint')
            observed=page.evaluate('marker=>__stage3Real.verify(marker)',marker)
            if observed['fixtureRecords']<1:raise authmod.SafeFailure('BATCH_NOT_PERSISTED')
            flags.update(realParse=not args.skip_parse,batchSaved=True)
            if not args.verify_persistence_only:
                stage='onboarding_skip'
                page.locator('nav [data-page=home]').click()
                skip=page.locator('[data-s3-skip]')
                if skip.count():skip.click();page.wait_for_timeout(1000)
                stage='recap_generate'
                page.locator('[data-recap-generate]').click()
                expect(page.locator('.recap-story')).to_be_visible(timeout=40000)
                page.locator('[data-recap-save]').click()
                expect(page.locator('[data-recap-save]')).to_contain_text('私有保存',timeout=25000)
                helper.checkpoint('A',actor,'recap_checkpoint')
                observed=page.evaluate('marker=>__stage3Real.verify(marker)',marker)
                if not observed['recapSaved'] or not observed['recapSourcesOwned']:raise authmod.SafeFailure('RECAP_NOT_PERSISTED')
                flags.update(realRecap=True,recapSaved=True,recapSourcesOwned=True)
                stage='assistant'
                page.locator('[data-action=open-assistant]').click()
                page.locator('#assistant-question').fill('请根据当前宠物的记录，回答最近记录了什么，并给出记录依据。')
                page.locator('#assistant-ask').click()
                expect(page.locator('.assistant-message.assistant')).to_be_visible(timeout=40000)
                source=page.locator('[data-assistant-source]');assert source.count()>0
                source.first.click();expect(page.locator('#dialog [data-readonly-ai]')).to_be_visible()
                page.locator('#close-dialog').click();flags.update(realAssistant=True,assistantSourceVisible=True)
            stage='refresh'
            page.locator('nav [data-page=health]').click()
            helper.refresh('A',actor)
            page.add_script_tag(path=str(bridge));observed=page.evaluate('marker=>__stage3Real.verify(marker)',marker)
            assert observed['fixtureRecords']>=1 and observed['recapSaved'] and observed['progressSaved']
            flags.update(refreshPersisted=True)
            page.locator('nav [data-page=home]').click()
            for width in (1440,390):
                page.set_viewport_size({'width':width,'height':1000});page.screenshot(path=str(OUT/f'cloud-home-{width}.png'),full_page=True)
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            flags.update(horizontalOverflow=False,pageErrors=actor['errors'])
            stage='scope_exit'
            page.locator('[data-action=workspace-local]').first.click()
            expect(page.locator('#workspace-badge')).to_have_text('本地档案',timeout=15000)
            expect(page.locator('#pet-form')).to_be_visible(timeout=15000)
            page.locator('#close-dialog').click();expect(page.locator('#dialog')).not_to_be_visible()
            page.locator('[data-action=open-assistant]').click()
            assert page.locator('.assistant-message').count()==0
            assert marker not in page.locator('#assistant-form').inner_text()
            page.locator('#close-dialog').click();flags['exitHistoryCleared']=True
            ok=True
        except Exception as error:
            flags['errorCode']=str(error) if isinstance(error,authmod.SafeFailure) else 'REAL_UI_CHECK_FAILED'
            flags['failedStage']=stage
            if helper.actors.get('A'):
                helper.actors['A']['page'].screenshot(path=str(OUT/'failed-ui.png'),full_page=True)
        finally:
            try:helper.stop();flags['sessionCheckpointed']=True
            except Exception:flags['sessionCheckpointed']=False
    evidence={**flags,'ok':ok,'fixtureMarker':marker if flags.get('fixtureCreated') else None}
    (OUT/'real-A-flags.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
    print(json.dumps({**flags,'ok':ok},ensure_ascii=False))
    return 0 if ok else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception:print(json.dumps({'ok':False,'errorCode':'REAL_ACCEPTANCE_STARTUP_FAILED','mailSent':False}));raise SystemExit(1)
