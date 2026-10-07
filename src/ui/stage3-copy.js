import {getLocale} from './i18n.js';
export const escapeStage3=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy={
 confirmPlan:['确认保存所选待办','Save selected to-dos'],purposeChanged:['用途已变更，请切回手动填写，或关闭后按新用途重新整理草稿。','The purpose changed. Use manual entry or reopen the form to organize drafts for the new purpose.'],
 aiTitle:['一句话记录','Record in a sentence'],manual:['手动填写','Fill manually'],ai:['一句话记录','Record in a sentence'],
 consent:['点击整理后，原句和必要宠物信息会发送给硅基流动。草稿确认前不会保存。','When you organize this text, it and necessary pet details are sent to SiliconFlow. Drafts are saved only after confirmation.'],
 input:['想记下什么？','What would you like to record?'],currentPet:['当前宠物：{name}；未提名字时按这只宠物整理。','Current pet: {name}; unnamed events are organized for this pet.'],example:['例如：昨天称重4.6公斤，今天做了驱虫。','Example: Weighed 4.6 kg yesterday and dewormed today.'],
 parse:['整理成草稿','Organize drafts'],loading:['正在整理…','Organizing…'],saving:['正在保存…','Saving…'],confirm:['确认保存所选条目','Save selected entries'],cancel:['取消','Cancel'],
 drafts:['核对草稿，补充缺少的信息','Review drafts and fill missing details'],select:['保存这一条','Save this entry'],pet:['宠物','Pet'],choosePet:['请选择宠物','Choose a pet'],
 type:['记录类型','Record type'],typeLabel:['自定义类型','Custom type'],date:['记录日期','Record date'],value:['体重（kg）','Weight (kg)'],title:['记录名称','Record title'],note:['备注','Note'],nextDate:['下次日期（可选）','Next date (optional)'],skipNextDate:['这次不设置提醒','Do not set a reminder this time'],source:['原句','Original text'],
 weight:['体重','Weight'],vaccine:['疫苗','Vaccination'],deworm:['驱虫','Deworming'],daily:['日常','Daily'],other:['其他','Other'],
 quota:['今天还可使用 {count} 次 AI，一句话记入、成长回顾、记录助手共用。','{count} AI requests left today, shared by Write a sentence, Growth recap and Record assistant.'],
 unavailable:['AI 暂时不可用，原文已保留，可以重试或手动填写。','AI is unavailable. Your text is kept; retry or fill manually.'],
 limited:['AI 额度已用完或请求过于频繁，请稍后再试。手动记录仍可用。','AI quota is exhausted or requests are too frequent. Try later; manual records remain available.'],
 changed:['宠物或档案空间已切换，请在当前档案重新开始。','The pet or workspace changed. Start again in the current journal.'],
 conflict:['档案已更新，请刷新后重新核对，当前输入已保留。','The journal has changed. Refresh and review again; your input is kept.'],
 invalid:['请核对日期、宠物和必填字段。','Check the pet, dates and required fields.'],progressDeferred:['进度暂未保存，已保存的记录仍保留，可稍后继续。','Progress was not saved; saved records are kept. Continue later.'],saved:['已保存。','Saved.'],
 onboarding:['开始记录你的毛孩子','Start your pet journal'],onboardingDesc:['建档、记第一笔、设提醒，三步开始。可以随时暂停。','Create a pet, save a first record and set a reminder. Pause at any time.'],
 start:['开始记录','Start recording'],continue:['继续上次记录','Continue setup'],petStep:['1 建宠物档案','1 Create a pet'],recordStep:['2 记第一笔','2 Save a first record'],reminderStep:['3 设提醒','3 Set a reminder'],
 addPet:['添加宠物','Add a pet'],firstRecord:['记第一笔','Save a first record'],setReminder:['设置提醒','Set a reminder'],skipReminder:['暂不设置提醒','Skip reminder'],later:['以后再说','Later'],done:['三步记录已完成。','Your first three steps are complete.'],
 recap:['成长回顾','Growth recap'],recapDesc:['先看真实记录，再回看一起成长的日子。','See the real records, then look back on your days together.'],
 range:['日期范围','Date range'],seven:['最近7天','Last 7 days'],thirty:['最近30天','Last 30 days'],custom:['自选日期','Custom dates'],from:['从','From'],to:['到','To'],generate:['生成回顾','Generate recap'],regenerate:['重新生成','Generate again'],
 recapConsent:['生成时会发送这个范围内的必要记录片段；回顾默认私有。','Generating sends necessary record excerpts in this range. Recaps stay private by default.'],
 noRecords:['这个范围还没有记录，先记下一个小瞬间吧。','No records in this range yet. Save a small moment first.'],
 recordCount:['记录 {count} 条','{count} records'],weightChange:['体重变化 {value} kg','Weight change {value} kg'],noWeightChange:['体重记录不足，暂不计算变化','Not enough weight records to calculate a change'],careCount:['完成护理 {count} 次','{count} completed care tasks'],
 basis:['查看依据','View sources'],generated:['生成于 {time}','Generated {time}'],stale:['记录已更新，这份回顾可能过时。','Records changed; this recap may be out of date.'],
 saveRecap:['保存回顾','Save recap'],recapSaved:['回顾已私有保存。','Recap saved privately.'],share:['分享预览','Share preview'],shareHint:['默认不含健康数值。当前可复制文字，尚不发布社区。','Health measurements are excluded by default. You can copy this text; it is not published to the community.'],copy:['复制文字','Copy text'],copied:['已复制。','Copied.'],history:['已保存的回顾','Saved recaps'],
 assistant:['记录助手','Record assistant'],assistantWelcome:['你好，试着问我网站怎么用，或查看当前宠物的记录。','Hello! Ask how to use the site, or about your current pet’s records.'],
 question:['你的问题','Your question'],ask:['发送','Send'],thinking:['正在查看记录…','Checking records…'],helpQuestion:['怎么备份我的记录？','How do I back up my records?'],recordsQuestion:['最近记录了什么？','What did I record recently?'],remindersQuestion:['接下来有哪些护理事项？','What care tasks are coming up?'],
 assistantScope:['当前宠物：{name} · 默认最近30天 · 只读','Current pet: {name} · Last 30 days by default · Read only'],noPet:['尚未建档','No pet yet'],sources:['回答依据','Answer sources'],user:['你','You'],answer:['助手','Assistant'],
 sourcesLimited:['日记最多引用20条相关记录片段，统计仍覆盖所选完整范围。','Stories use up to 20 relevant record excerpts; statistics cover the full selected range.'],
 assistantLimited:['问答查看最近30天内最多20条记录片段。完整记录可在健康档案查看。','Answers use up to 20 record excerpts from the last 30 days. See Health Records for the complete list.'],
 helpRecordTitle:['记录','Records'],helpRecord:['在首页点击“记一笔”，或到健康档案添加记录。可手动填写或用一句话生成草稿，核对后确认保存。','Select Record on Home, or add a record in Health Records. Fill manually or organize a sentence into drafts, then review and save.'],
 helpBackupTitle:['备份与恢复','Backup and restore'],helpBackup:['到健康档案导出完整备份。恢复时先选择备份文件，查看预览再确认；完整备份包含私有照片。','Export a full backup in Health Records. To restore, select the file, review the preview and confirm. Full backups include private photos.'],
 helpAccountTitle:['档案空间','Workspaces'],helpAccount:['示例用于体验。本地个人档案保存在当前浏览器，邮箱登录后可使用私有云档案；迁移本地资料需要预览确认。','Demo is for exploration. Local journals stay in this browser. Email sign-in provides a private cloud journal; local migration requires preview and confirmation.'],
 helpReminderTitle:['护理提醒','Care reminders'],helpReminder:['在健康档案添加护理事项，可设置日期、完成、取消或移入回收站；也可导出系统日历。','Add care tasks in Health Records. Set dates, complete, cancel or move them to the recycle bin, or export them to your calendar.'],
 helpRecapTitle:['成长回顾','Growth recaps'],helpRecap:['成长首页选择日期范围生成回顾，查看依据后私有保存；分享先预览并复制文字。','Choose a date range on Home to generate a recap. Check sources and save it privately; sharing provides a preview and text copy.'],
 close:['关闭','Close'],help:['使用帮助','Usage help'],viewHealth:['前往健康档案','Open health records'],notMedical:['助手只帮助使用网站和查看记录；医疗问题请咨询兽医。','The assistant helps with the site and records. Ask a veterinarian about medical questions.'],
 quotaLoading:['正在读取 AI 额度…','Checking AI quota…'],demoRecap:['当前是示例档案，生成内容仅供体验。','This is a demo journal; generated content is for demonstration.'],deferred:['需要时可以继续三步记录。','You can continue setup when you are ready.'],
 missing:['有信息尚待补充，请核对下面的字段。','Some information is missing. Review the fields below.']
};
export function stage3Text(key,params={}){let text=copy[key]?.[getLocale()==='en'?1:0]??key;for(const [name,value]of Object.entries(params))text=text.replaceAll('{'+name+'}',String(value));return text;}
export function stage3Error(error){return stage3Text(error?.code==='PURPOSE_CHANGED'?'purposeChanged':error?.code==='WORKSPACE_CHANGED'?'changed':error?.code==='CONFLICT'?'conflict':['RATE_LIMITED','QUOTA_EXCEEDED','QUOTA_EXHAUSTED'].includes(error?.code)?'limited':error?.code==='INVALID_INPUT'?'invalid':'unavailable');}
export function refreshStage3Copy(root){for(const node of root.querySelectorAll('[data-s3-key]'))node.textContent=stage3Text(node.dataset.s3Key);}

export function stage3Help(source){const key=({'help-record':'helpRecord','help-backup':'helpBackup','help-account':'helpAccount','help-reminder':'helpReminder','help-recap':'helpRecap'})[source.id];return key?{title:stage3Text(key+'Title'),text:stage3Text(key)}:{title:source.label||source.title||stage3Text('help'),text:source.text||stage3Text('assistantWelcome')};}
