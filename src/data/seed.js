import {migrateV1,isoTime} from '../domain/schema.js';
export function createSeedState({now=new Date().toISOString()}={}) {
  const timestamp=isoTime(now);
  const dayOffset=n=>{const d=new Date(timestamp);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function legacySeed(){return {version:1,city:'深圳',activePet:'pet-mochi',pets:[{id:'pet-mochi',name:'糯米',type:'dog',breed:'金毛寻回犬',sex:'男孩子',birthday:dayOffset(-425),arrival:dayOffset(-365),image:'assets/dog.jpg'}],records:[
  {id:'w1',petId:'pet-mochi',type:'weight',date:dayOffset(-90),value:19.2,note:'第一次认真称重。'},
  {id:'w2',petId:'pet-mochi',type:'weight',date:dayOffset(-60),value:20.1,note:'饭吃得香，散步也很积极。'},
  {id:'w3',petId:'pet-mochi',type:'weight',date:dayOffset(-30),value:21.4,note:'记录每一次小小的变化。'},
  {id:'w4',petId:'pet-mochi',type:'weight',date:dayOffset(-1),value:22.5,note:'又长大了一点点，今天也好好吃饭啦。'},
  {id:'v1',petId:'pet-mochi',type:'vaccine',date:dayOffset(-350),title:'年度疫苗复查',note:'示例档案。下次时间以实际兽医安排为准。',nextDate:dayOffset(15)},
  {id:'d1',petId:'pet-mochi',type:'deworm',date:dayOffset(-25),title:'体外驱虫',note:'完成一次驱虫记录。',nextDate:dayOffset(5)},
  {id:'j1',petId:'pet-mochi',type:'daily',date:dayOffset(-3),title:'第一次去海边',note:'追着浪花跑了好久。回家的路上，累得睡着了。'}
],posts:[
  {id:'post1',author:'糯米的铲屎官',pet:'糯米',city:'深圳',topic:'遛宠搭子',title:'把周末交给草地和毛孩子',text:'今天的快乐是两只小狗给的。跑累了就一起躺在草地上，原来发呆也可以这么幸福。\n有人想一起解锁新的遛狗路线吗？',image:'assets/walk.jpg',avatar:'assets/dog.jpg',likes:28,liked:false,date:dayOffset(-1),comments:[{author:'豆豆妈妈',text:'一起！我们也很喜欢周末去草地玩。'}]},
  {id:'post2',author:'小橘的室友',pet:'小橘',city:'上海',topic:'今日萌宠',title:'今天的任务：在阳光下充满电',text:'认真观察了十分钟，结论是：猫咪真的很会享受生活。你家毛孩子最喜欢待在哪个角落？',image:'assets/cat.jpg',avatar:'assets/cat.jpg',likes:46,liked:false,date:dayOffset(-2),comments:[]},
  {id:'post3',author:'年糕同学',pet:'年糕',city:'深圳',topic:'养宠心得',title:'开始记体重以后，才看见小小的变化',text:'以前只觉得它长大了，现在把每次称重记下来，看着曲线一点点变化，陪伴好像有了形状。分享一个习惯：固定时间、用同一台秤，记录更好对比。',image:'',avatar:'assets/dog.jpg',likes:17,liked:false,date:dayOffset(-4),comments:[]}
]};}
  return migrateV1(legacySeed(),{now:timestamp});
}
