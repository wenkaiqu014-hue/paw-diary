import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Isolate the actual rejected Promise from node:test's own rejection listener.
test('topbar region apply preserves selection and handles a real community load rejection',()=>{
 const probe=String.raw`
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {createCommunityController} from './src/features/community.js';
const source=readFileSync('app.js','utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const node=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);if(!node)throw Error('Missing actual app function '+name);return source.slice(node.start,node.end);};
const model=createCommunityController({repository:{request:async()=>{throw Object.assign(new Error('synthetic offline'),{code:'UNAVAILABLE'});}},getSession:()=>({userId:null,generation:0})});
model.setFilters({scope:'city'});
const apply={},label={},body={querySelector:()=>({})},stored=new Map(),unhandled=[],toasts=[];
const region={cityId:'110100',cityName:'synthetic city',districtId:null,districtName:null};
const context={getLocale:()=> 'zh-CN',communityIdentityGeneration:0,communityBrowseRegion:{},modal:()=>true,
 mountRegionPicker:()=>({getValue:()=>({...region}),destroy(){}}),getCommunityRepository:()=>({}),
 $:selector=>selector==='#community-browse-apply'?apply:selector==='#city-label'?label:body,
 localStorage:{setItem:(key,value)=>stored.set(key,value)},closeModal:()=>{},
 publicSurface:{setBrowseRegion:value=>model.setBrowseRegion(value)},
 localizeError:error=>error.code,toast:message=>toasts.push(message)};
process.on('unhandledRejection',error=>unhandled.push(error.code??String(error)));
vm.createContext(context);
vm.runInContext([declaration('setCommunityBrowseRegion'),declaration('openCommunityBrowseRegion'),'openCommunityBrowseRegion();'].join(String.fromCharCode(10)),context);
apply.onclick();
await new Promise(resolve=>setTimeout(resolve,30));
console.log(JSON.stringify({unhandled,toasts,selection:context.communityBrowseRegion,persisted:JSON.parse(stored.get('paw-diary:community-browse-region')),label:label.textContent,filter:model.getState().filters,error:model.getState().error}));
model.destroy();
`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',probe],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const observed=JSON.parse(result.stdout.trim());
 assert.deepEqual(observed.unhandled,[],'directory failure must not escape as an unhandled promise rejection');
 assert.deepEqual(observed.toasts,['UNAVAILABLE'],'the same live surface should explain the failure');
 assert.equal(observed.selection.cityId,'110100');
 assert.deepEqual(observed.persisted,observed.selection,'browsing preference remains available for retry');
 assert.equal(observed.label,'synthetic city');
 assert.equal(observed.filter.cityId,'110100');
 assert.equal(observed.error,'UNAVAILABLE');
});
