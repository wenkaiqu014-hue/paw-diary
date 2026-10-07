import test from 'node:test';
import assert from 'node:assert/strict';
const {processImage}=await import('../src/media/process-image.js').catch(()=>({}));
const png=new Uint8Array([137,80,78,71,13,10,26,10,...new Uint8Array(40)]);
const jpeg=new Uint8Array([255,216,255,...new Uint8Array(40)]);
const blob=(bytes=png,type='image/png')=>new Blob([bytes],{type});
function raster(width,height){const drawn=[];return {decode:async()=>({width,height,close(){}}),createCanvas:(w,h)=>({getContext:()=>({drawImage(...args){drawn.push(args);}}),convertToBlob:async({type})=>blob(type==='image/png'?png:jpeg,type)}),drawn};}
test('image processor is available for browser media',()=>assert.equal(typeof processImage,'function'));
test('rejects fake MIME signature and 10MiB sources before decode',async()=>{let called=false;const decode=()=>{called=true;};await assert.rejects(processImage(blob(jpeg,'image/png'),{decode}),/格式|MIME/);await assert.rejects(processImage(new Blob([new Uint8Array(10*1024*1024+1)],{type:'image/png'}),{decode}),/10|过大/);assert.equal(called,false);});
test('display is 1920 bounded and PNG transparency is preserved',async()=>{const deps=raster(4000,2000),out=await processImage(blob(),deps);assert.equal(out.width,1920);assert.equal(out.height,960);assert.equal(out.mime,'image/png');assert.ok(out.bytes<=1024*1024);});
test('avatar bound is 512 and images never upscale',async()=>{assert.equal((await processImage(blob(),{kind:'avatar',...raster(2000,1000)})).width,512);assert.equal((await processImage(blob(),raster(80,40))).width,80);});
test('decoder failure and compression unable to fit do not produce success',async()=>{await assert.rejects(processImage(blob(),{decode:async()=>{throw Error('decode');}}),/decode|解码/);await assert.rejects(processImage(blob(),{...raster(20,20),createCanvas:()=>({getContext:()=>({drawImage(){}}),convertToBlob:async()=>new Blob([new Uint8Array(1024*1024+1)],{type:'image/png'})})}),/压缩|1MiB|过大/);});
