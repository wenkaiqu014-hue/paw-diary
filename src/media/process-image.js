export const MAX_SOURCE_BYTES=10*1024*1024;
export const MAX_DISPLAY_BYTES=1024*1024;
export async function inspectImageBlob(blob,{maxBytes=MAX_SOURCE_BYTES}={}){
  if(!(blob instanceof Blob)||blob.size===0)throw new Error('图片格式无效');
  if(blob.size>maxBytes)throw new Error('图片过大，原图最多10MiB');
  const b=new Uint8Array(await blob.slice(0,16).arrayBuffer());
  const png=b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n);
  const jpeg=b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
  const webp=b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
  const actual=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;
  if(!actual||blob.type!==actual)throw new Error('图片格式与MIME不一致，只支持JPEG/PNG/WebP');
  return actual;
}
function canvasFactory(w,h){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);if(!globalThis.document)throw new Error('图片处理不可用');const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;}
function encode(canvas,type,quality){if(canvas.convertToBlob)return canvas.convertToBlob({type,quality});return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片压缩失败')),type,quality));}
export async function processImage(blob,{kind='photo',decode=globalThis.createImageBitmap,createCanvas=canvasFactory,maxSourceBytes=MAX_SOURCE_BYTES,maxOutputBytes=MAX_DISPLAY_BYTES}={}){
  const type=await inspectImageBlob(blob,{maxBytes:maxSourceBytes});
  if(!['photo','avatar'].includes(kind))throw new Error('图片用途无效');
  if(typeof decode!=='function')throw new Error('图片解码不可用');
  let image;
  try{image=await decode(blob,{imageOrientation:'from-image'});}catch{throw new Error('图片解码失败');}
  try{
    if(!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<1||image.height<1)throw new Error('图片尺寸无效');
    const limit=kind==='avatar'?512:1920,scale=Math.min(1,limit/Math.max(image.width,image.height));
    let width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
    // PNG keeps alpha; lossy formats can progressively lower quality. Dimensions may shrink too.
    for(let attempt=0;attempt<9;attempt++){
      const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片画布不可用');
      ctx.drawImage(image,0,0,width,height);
      const output=await encode(canvas,type,Math.max(.45,.9-attempt*.07));
      if(output&&output.size>0&&output.size<=maxOutputBytes){if(type==='image/png'&&output.type!=='image/png')throw new Error('透明图片编码失败');await inspectImageBlob(output,{maxBytes:maxOutputBytes});return {blob:output,width,height,mime:output.type,bytes:output.size};}
      width=Math.max(1,Math.round(width*.8));height=Math.max(1,Math.round(height*.8));
    }
    throw new Error('图片压缩后仍超过1MiB，请选择较小图片');
  }finally{image.close?.();}
}
