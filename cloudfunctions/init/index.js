const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  // 简单初始化脚本：创建 settings/global 文档并设置 admins 数组（为空）
  try {
    const doc = { _id: 'global', admins: [], createdAt: new Date() };
    const existing = await db.collection('settings').doc('global').get().catch(()=>null);
    if (existing && existing.data) {
      return { code: 0, message: 'already initialized', data: existing.data };
    }
    const res = await db.collection('settings').add({ data: doc });
    return { code: 0, data: doc };
  } catch (err) {
    console.error('init error', err);
    return { code: 1, message: err.message || 'init failed' };
  }
};
