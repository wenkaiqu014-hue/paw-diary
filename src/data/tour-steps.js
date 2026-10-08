const step = (id, zhTitle, enTitle, zhBody, enBody) => Object.freeze({
  id, selector: `[data-tour="${id}"]`, titleKey: `tour.${id}.title`, bodyKey: `tour.${id}.body`,
  title: Object.freeze({ zh: zhTitle, en: enTitle }), body: Object.freeze({ zh: zhBody, en: enBody }),
});
export const TOUR_STEPS = Object.freeze([
  step('workspace', '选择档案空间', 'Choose your workspace',
    '示例可放心体验；自己的本地档案保存在此浏览器。登录和迁移由你确认。',
    'Explore the demo, or keep your own local records in this browser. You confirm sign-in and any migration.'),
  step('pets', '添加和管理宠物', 'Add and manage pets',
    '在这里添加、切换和管理宠物。还没有宠物，也可以先了解入口。',
    'Add, switch and manage pets here. You can explore this guide before adding a pet.'),
  step('record', '记下发生的事', 'Record what happened',
    '已发生的事存为记录，未来安排存为计划。AI草稿需要核对确认后才保存。',
    'Save past events as records and future arrangements as plans. Review and confirm AI drafts before saving.'),
  step('reminders', '查看护理待办', 'Check care reminders',
    '护理待办来自计划分类，完成后才形成记录。日历通过导出文件添加，不自动同步。',
    'Care reminders come from categorized plans; completing one creates a record. Calendar files are exported, not synced automatically.'),
  step('recap', '回看成长足迹', 'Look back on growth',
    '回顾依据当前宠物的实际记录，没有数据不虚构。公开摘要还需要你单独确认。',
    'Recaps use the current pet’s actual records and do not invent missing data. Publishing a summary needs your separate confirmation.'),
  step('community-nav', '认识社区和同城宠友', 'Meet the community',
    '社区和同城展示真实公开内容，互动需要登录；健康资料不会自动公开。使用帮助里可重看指引。',
    'Browse real public posts and nearby pet owners; sign in to interact. Health records stay private. Replay this guide from Help.'),
]);
