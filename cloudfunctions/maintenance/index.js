const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// helper: check admin
async function isAdmin(openid) {
  try {
    const s = await db.collection('settings').doc('global').get();
    const admins = (s.data && s.data.admins) || [];
    return admins.includes(openid);
  } catch (e) {
    return false;
  }
}

exports.main = async (event, context) => {
  const { action, id, payload, page = 1, pageSize = 20, filter = {} } = event;
  const openid = context.OPENID;

  try {
    switch (action) {
      case 'listAssigned': {
        const where = { assigneeOpenId: openid };
        const res = await db.collection('maintenance').where(where).orderBy('createdAt', 'desc').limit(pageSize).get();
        return { code: 0, data: res.data || [] };
      }

      case 'acceptTask': {
        if (!id) return { code: 1, message: '缺少工单 ID' };
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };
        if (rec.data.assigneeOpenId !== openid && !(await isAdmin(openid))) {
          return { code: 1, message: '没有权限接单' };
        }
        const now = new Date();
        await db.collection('maintenance').doc(id).update({
          data: {
            status: '处理中',
            updatedAt: now,
            records: _.push([{ type: 'accept', by: openid, at: now }])
          }
        });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'rejectTask': {
        if (!id) return { code: 1, message: '缺少工单 ID' };
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };
        if (rec.data.assigneeOpenId !== openid && !(await isAdmin(openid))) {
          return { code: 1, message: '没有权限拒单' };
        }
        const now = new Date();
        await db.collection('maintenance').doc(id).update({
          data: {
            status: '待处理',
            updatedAt: now,
            assigneeOpenId: '',
            records: _.push([{ type: 'reject', by: openid, at: now }])
          }
        });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'completeTask': {
        if (!id) return { code: 1, message: '缺少工单 ID' };
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };
        if (rec.data.assigneeOpenId !== openid && !(await isAdmin(openid))) {
          return { code: 1, message: '没有权限完成此工单' };
        }
        const now = new Date();
        await db.collection('maintenance').doc(id).update({
          data: {
            status: '已完成',
            updatedAt: now,
            records: _.push([{ type: 'complete', by: openid, at: now }])
          }
        });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('engineer cloud function error:', err);
    return { code: 1, message: err && err.message ? err.message : '工程师任务操作失败' };
  }
};
