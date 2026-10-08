import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('installable manifest retains the paw-diary subpath and has real platform icons',async()=>{
 const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
 const base='https://wenkaiqu014-hue.github.io/paw-diary/';
 assert.equal(new URL(manifest.start_url,base).href,base+'#home');
 assert.equal(new URL(manifest.scope,base).href,base);
 // Manifest identity is origin-relative, unlike its start_url and scope.
 assert.equal(new URL(manifest.id,new URL(manifest.start_url,base).origin).href,base);
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.prefer_related_applications,false);
 for(const size of [192,512]){
  const entry=manifest.icons.find(icon=>icon.sizes===`${size}x${size}`&&icon.purpose==='any');
  assert.ok(entry);const bytes=await readFile(entry.src);
  assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 const maskable=manifest.icons.find(icon=>icon.purpose==='maskable');assert.ok(maskable);
 const touch=await readFile('assets/app-icons/apple-touch-icon-180.png');assert.equal(touch.readUInt32BE(16),180);
 const html=await readFile('index.html','utf8');
 assert.match(html,/rel="manifest" href="manifest.webmanifest"/);
 assert.match(html,/rel="apple-touch-icon"/);
});
