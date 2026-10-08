import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const allowed=['START-HERE.html','README.txt','check-public.ps1','RUN-CHECK.cmd','report-schema.json','device-checklist.md'];
export async function buildAcceptancePack({version='1.0.0',outdir=join(root,'test-results/stage5/windows-acceptance'),sourceDir=join(root,'tools/acceptance/windows')}={}) {
  if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw new Error('Invalid product version');
  outdir=resolve(outdir);sourceDir=resolve(sourceDir);await mkdir(outdir,{recursive:true});
  const result=await build({entryPoints:[join(sourceDir,'report-ui.js')],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],minify:true,logLevel:'silent',define:{__PAW_ACCEPTANCE_VERSION__:JSON.stringify(version)}});
  const javascript=result.outputFiles[0].text.replaceAll('</script','<\\/script');
  for(const file of allowed){
    if(file==='device-checklist.md'){await copyFile(join(root,version==='1.0.0'?'docs/verification/v100-device-checklist.md':'docs/verification/stage5-user-checklist.md'),join(outdir,file));continue;}
    let text=await readFile(join(sourceDir,file),'utf8');text=text.replaceAll('__PRODUCT_VERSION__',version);
    if(file==='START-HERE.html')text=text.replace('<!-- INLINE_REPORT_UI -->','<script>'+javascript+'</script>');
    await writeFile(join(outdir,file),text,'utf8');
  }
  const defaultDir=join(root,'test-results/stage5/windows-acceptance');
  const archivePath=join(outdir===defaultDir?dirname(outdir):outdir,`paw-diary-v${version}-windows-acceptance.zip`);
  await rm(archivePath,{force:true});execFileSync('zip',['-q','-X',archivePath,...allowed],{cwd:outdir});
  const sha256=createHash('sha256').update(await readFile(archivePath)).digest('hex');
  const fileSha256=Object.fromEntries(await Promise.all(allowed.map(async file=>[file,createHash('sha256').update(await readFile(join(outdir,file))).digest('hex')])));
  return {archivePath,files:allowed.slice(),sha256,fileSha256};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const option=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
  const result=await buildAcceptancePack({version:option('--version')??'1.0.0',...(option('--outdir')?{outdir:option('--outdir')}:{})});
  console.log(JSON.stringify(result,null,2));
}
