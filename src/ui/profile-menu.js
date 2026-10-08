export function createProfileMenu({triggers,onProfile,onAccount,onAbout,onHelp,onInstall,getInstallLabel,getLocale=()=> 'zh-CN',document=globalThis.document}={}){
 let host=null,origin=null;
 const close=(returnFocus=true)=>{if(!host)return;host.remove();host=null;for(const trigger of triggers)trigger.setAttribute('aria-expanded','false');if(returnFocus)origin?.focus();};
 function open(trigger){if(host){close();return;}origin=trigger;host=document.createElement('div');host.className='profile-menu';host.setAttribute('role','menu');host.setAttribute('aria-label',getLocale()==='en'?'Account menu':'个人菜单');const en=getLocale()==='en';
  for(const [label,action] of [[en?'Personal profile':'个人资料',onProfile],[en?'Sign-in and account':'登录与账号',onAccount],[getInstallLabel?.()??(en?'Install desktop app':'安装桌面版'),onInstall],[en?'Help':'使用帮助',onHelp],[en?'About Paw Diary':'关于爪爪日记',onAbout]]){if(!action)continue;const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=label;button.onclick=()=>{close(action===onInstall);action();};host.append(button);}
  document.body.append(host);const rect=trigger.getBoundingClientRect(),width=Math.min(224,document.documentElement.clientWidth-32);host.style.width=`${width}px`;host.style.left=`${Math.max(16,Math.min(rect.left,document.documentElement.clientWidth-width-16))}px`;host.style.top=rect.bottom+host.offsetHeight+8<document.documentElement.clientHeight?`${rect.bottom+8}px`:`${Math.max(16,rect.top-host.offsetHeight-8)}px`;trigger.setAttribute('aria-expanded','true');host.querySelector('button')?.focus();
 }
 const clicked=event=>{const trigger=triggers.find(x=>x===event.currentTarget);open(trigger);};
 for(const trigger of triggers){trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.addEventListener('click',clicked);}
 const outside=event=>{if(host&&!host.contains(event.target)&&!triggers.some(x=>x.contains(event.target)))close(false);};
 const keys=event=>{if(!host)return;if(event.key==='Escape'){event.preventDefault();close();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...host.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}else if(event.key==='Tab')close(false);};
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keys);
 return {close,destroy(){close(false);for(const trigger of triggers)trigger.removeEventListener('click',clicked);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keys);}};
}
