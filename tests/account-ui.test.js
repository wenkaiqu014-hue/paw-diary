import test from 'node:test';
import assert from 'node:assert/strict';
let api;try{api=await import('../src/ui/account.js');}catch{}
const available=()=>assert.ok(api,'account UI module must be available');
test('email/code validation accepts adapter OTP range and returns actionable stable errors',()=>{
  available();assert.throws(()=>api.validateEmail(''),e=>e.messageKey==='account.emailRequired');
  assert.throws(()=>api.validateEmail('wrong'),e=>e.messageKey==='account.emailInvalid');
  assert.equal(api.validateEmail('  pet@example.com  '),'pet@example.com');
  for(const code of ['1234','123456','1234567890'])assert.equal(api.validateCode(code),code);
  for(const code of ['123','12345678901','12ab',''])assert.throws(()=>api.validateCode(code),e=>e.messageKey==='account.codeInvalid'||e.messageKey==='account.codeRequired');
});
test('account factory exposes root hooks without requiring passwords or a DOM before opening',()=>{
  available();const ui=api.createAccountUI({auth:{},getGeneration:()=>0,modal:()=>true,closeModal:()=>{},onSignedIn:()=>{},onSignedOut:()=>{},onImportLocal:()=>{},t:key=>key,document:null});
  for(const hook of ['openLogin','openAccount','destroy'])assert.equal(typeof ui[hook],'function');ui.destroy();ui.destroy();
});

test('beta validation preserves leading zeros and rejects missing or non-six-digit invitation values',()=>{
  available();assert.equal(typeof api.validateBetaCode,'function');
  assert.equal(api.validateBetaCode('012349'),'012349');
  assert.throws(()=>api.validateBetaCode(''),e=>e.messageKey==='account.betaRequired');
  for(const value of ['12345','1234567','１２３４５６','12ab56',' 012349 '])assert.throws(()=>api.validateBetaCode(value),e=>e.messageKey==='account.betaInvalid');
});
