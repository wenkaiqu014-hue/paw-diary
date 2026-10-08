import {t as defaultTranslator} from './i18n.js';
const codes = {unauth:'error.unauth',unauthenticated:'error.unauth',forbidden:'error.forbidden',invalid:'error.invalid',conflict:'error.conflict',unavailable:'error.unavailable',quota:'error.quota',quota_exceeded:'error.quota',storage_full:'error.quota',generation:'error.generation',stale_generation:'error.generation',not_found:'error.notFound',media_type:'error.mediaType',media_size:'error.mediaSize',media_decode:'error.mediaDecode',batch_limit:'error.batchLimit'};
Object.assign(codes,{DEMO_TYPE_UNSUPPORTED:'error.demoCustomType',RECOVERY_CONFIRMATION_REQUIRED:'error.recoveryConfirmation',WORKSPACE_CHANGED:'error.generation',UNAUTHENTICATED:'error.unauth',FORBIDDEN:'error.forbidden',INVALID_INPUT:'error.invalid',CONFLICT:'error.conflict',UNAVAILABLE:'error.unavailable',QUOTA_EXCEEDED:'error.quota',STALE_GENERATION:'error.generation'});
Object.assign(codes,{BETA_CODE_REQUIRED:'errors.beta_code_required',BETA_CODE_INVALID:'errors.beta_code_invalid',BETA_ACCESS_REQUIRED:'errors.beta_access_required',BETA_CONFIG_INVALID:'errors.beta_config_invalid',RATE_LIMITED:'errors.rate_limited'});
const backendKeys=new Set(['errors.beta_code_required','errors.beta_code_invalid','errors.beta_access_required','errors.beta_config_invalid','errors.rate_limited','errors.unauthenticated','errors.forbidden','errors.invalid_input','errors.conflict','errors.unavailable','errors.mediaQuota','errors.invalidImage','errors.workspaceTooLarge','errors.idempotencyReused']);
const known = new Map([
  ['请先恢复所属宠物，或在本次备份预览中一起确认恢复宠物','error.restoreParent'],
  ...Object.entries({'体重需在0.01至200 kg之间':'error.weightRange','体重需为数字':'error.weightNumber','下一次日期应晚于记录日期':'error.nextDate','记录日期不能晚于今天':'error.futureRecord','生日或到家日期不能晚于今天':'error.futurePetDate','生日不能晚于来到家的日期':'error.birthdayArrival','估计月龄需为0到1200的整数':'error.estimatedAge','生日和估计月龄只能填写一个':'error.ageMethod','请先恢复所属宠物':'error.restoreParent','已完成事项不能改为待办，请新增事项':'error.completedReminder','已取消事项不能完成':'error.cancelledReminder','备份不是有效的 JSON 文件':'error.backupJSON','备份格式无效':'error.backupFormat','不支持此备份版本':'error.backupVersion','请按预览逐项确认冲突':'error.confirmConflicts','图片格式与MIME不一致，只支持JPEG/PNG/WebP':'error.mediaType','图片格式无效':'error.mediaType','图片过大，原图最多10MiB':'error.mediaSize','图片解码失败':'error.mediaDecode','图片尺寸无效':'error.mediaDecode','照片总容量超过空间配额':'error.quota'}),
  ['请填写宠物名字。','error.petName'], ['请填写宠物名字','error.petName'],
  ['请选择 JPG、PNG 或 WebP 图片。','error.mediaType'], ['图片超过 10MB，请选择小一点的图片。','error.mediaSize'],
  ['图片无法读取，请换一张。','error.mediaDecode'], ['无法读取图片，请换一张。','error.mediaDecode'],
  ...['记录不存在','事项不存在','宠物不存在','宠物不存在或已在回收站','记录已在回收站，请先恢复','事项已在回收站，请先恢复','所选资料不存在'].map(message=>[message,'error.notFound']),
]);
// Only reviewed message keys are displayed. Raw exceptions can contain private paths or details.
const fieldLabels={宠物名:'宠物名字',自定义宠物类型:'自定义类型',自定义记录类型:'自定义类型',记录名称:'记录名称',事项名称:'事项名称',备注:'备注',品种:'品种 · 可选',记录日期:'记录日期',下一次日期:'下一次日期 · 可选',生日:'生日',到家日期:'来到家的日期 · 可选',事项日期:'护理日期',城市:'所在城市'};
const trustedKeys = new Set(Object.values(codes).concat('error.generic','error.petName'));
export function localizeError(error, translator=defaultTranslator) {
  const failure=error?.error??error;
  if((failure?.code==='RATE_LIMITED'||failure?.messageKey==='errors.rate_limited')&&Number.isInteger(failure?.params?.retryAfterSeconds)&&failure.params.retryAfterSeconds>=0&&failure.params.retryAfterSeconds<=86400)return translator('errors.rate_limited_wait',{retryAfterSeconds:failure.params.retryAfterSeconds});
  if(backendKeys.has(failure?.messageKey))return translator(failure.messageKey,failure.params??{});
  if(trustedKeys.has(failure?.messageKey)) return translator(failure.messageKey,failure.params??{});
  if(codes[failure?.code])return translator(codes[failure.code],failure.params??{});
  if(known.has(failure?.message))return translator(known.get(failure.message));
  if(backendKeys.has(failure?.message))return translator(failure.message);
  const fieldError=/^(.+?)(不能为空|不能超过(\d+)字|不是有效日期|格式无效)$/.exec(failure?.message??'');
  if(fieldError&&Object.hasOwn(fieldLabels,fieldError[1])){const field=translator(fieldLabels[fieldError[1]]);return translator(fieldError[2]==='不能为空'?'error.fieldRequired':fieldError[3]?'error.fieldLong':'error.dateInvalid',{field,max:fieldError[3]});}
  return translator('error.generic');
}
export const translateError=localizeError;
