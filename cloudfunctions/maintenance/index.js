const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, id, payload } = event;

  try {
    switch (action) {
      case 'list': {
        const res = await db.collection('maintenance')
          .orderBy('createdAt', 'desc')
          .get();
        return { code: 0, data: res.data };
      }

      case 'get': {
        if (!id) {
          return { code: 1, message: '缺少 id' };
        }

        const res = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: res.data || {} };
      }

      case 'create': {
        const item = payload || {};
        const now = new Date();
        const record = {
          title: item.title || '新报修',
          category: item.category || '一般维修',
          location: item.location || '未填写',
          contact: item.contact || '未填写',
          description: item.description || '',
          status: item.status || '待处理',
          createdAt: now,
          updatedAt: now,
          creatorOpenId: context.OPENID || ''
        };

        const res = await db.collection('maintenance').add({ data: record });
        return { code: 0, data: { _id: res._id, ...record } };
      }

      case 'update': {
        if (!id) {
          return { code: 1, message: '缺少 id' };
        }

        const updateData = {
          ...(payload || {}),
          updatedAt: new Date()
        };

        await db.collection('maintenance').doc(id).update({
          data: updateData
        });

        const res = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: res.data || {} };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('maintenance cloud function error:', err);
    return {
      code: 1,
      message: err && err.message ? err.message : '云函数执行失败'
    };
  }
};
