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
  const { action, id, payload } = event;
  const openid = context.OPENID;

  try {
    switch (action) {
      case 'checkin': {
        // engineer check-in (record with optional location)
        if (!id) return { code: 1, message: '缺少工单 id' };
        const { latitude, longitude, note } = payload || {};
        const now = new Date();
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };
        // only assignee or admin can checkin
        if (rec.data.assigneeOpenId !== openid && !(await isAdmin(openid))) {
          return { code: 1, message: '没有权限签到' };
        }

        const record = { type: 'checkin', by: openid, at: now, location: { latitude, longitude }, note: note || '' };
        await db.collection('maintenance').doc(id).update({ data: { records: _.push([record]), updatedAt: now } });
        const updated = await db.collection('maintenance').doc(id).get();
        // write audit log
        await db.collection('logs').add({ data: { kind: 'checkin', orderId: id, by: openid, at: now, payload: record } });
        return { code: 0, data: updated.data || {} };
      }

      case 'addRecord': {
        // support images and text in records
        if (!id) return { code: 1, message: '缺少工单 id' };
        const { text, images } = payload || {};
        if (!text && (!images || images.length === 0)) return { code: 1, message: '记录内容不能为空' };
        const rcd = await db.collection('maintenance').doc(id).get();
        const item = rcd.data || {};
        const allowed = (await isAdmin(openid)) || item.assigneeOpenId === openid || item.creatorOpenId === openid;
        if (!allowed) return { code: 1, message: '没有权限添加记录' };

        const now = new Date();
        const record = { type: 'record', by: openid, text: text || '', images: images || [], at: now };
        await db.collection('maintenance').doc(id).update({ data: { records: _.push([record]), updatedAt: now } });
        const updated = await db.collection('maintenance').doc(id).get();
        // log
        await db.collection('logs').add({ data: { kind: 'record', orderId: id, by: openid, at: now, payload: record } });
        return { code: 0, data: updated.data || {} };
      }

      case 'arrivalConfirm': {
        // mark engineer arrived and optionally upload final photos
        if (!id) return { code: 1, message: '缺少工单 id' };
        const { images } = payload || {};
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };
        const item = rec.data;
        if (item.assigneeOpenId !== openid && !(await isAdmin(openid))) return { code: 1, message: '没有权限操作' };
        const now = new Date();
        const record = { type: 'arrival', by: openid, at: now, images: images || [] };
        await db.collection('maintenance').doc(id).update({ data: { records: _.push([record]), updatedAt: now } });
        const updated = await db.collection('maintenance').doc(id).get();
        await db.collection('logs').add({ data: { kind: 'arrival', orderId: id, by: openid, at: now, payload: record } });
        return { code: 0, data: updated.data || {} };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('maintenance extended error:', err);
    return { code: 1, message: err && err.message ? err.message : '操作失败' };
  }
};
