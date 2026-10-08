import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
test('public config forwards only strict beta boolean to actual app factories',async()=>{
 const source=await fs.readFile(new URL('../src/config/public-config.js',import.meta.url),'utf8');
 for(const value of [true,false,'true',undefined]){
  const previous=globalThis.__PAW_PUBLIC_CONFIG__;
  try{globalThis.__PAW_PUBLIC_CONFIG__={betaRequired:value};const {PUBLIC_CONFIG}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+typeof value+':'+String(value)).toString('base64'));
   assert.equal(PUBLIC_CONFIG.betaRequired,value===true);assert.ok(Object.isFrozen(PUBLIC_CONFIG));
  }finally{globalThis.__PAW_PUBLIC_CONFIG__=previous;}
 }
});
