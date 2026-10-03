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
      case 'whoami': {
        // return user record and role
        const userRes = await db.collection('users').where({ openId: openid }).limit(1).get();
        if (userRes.data.length === 0) {
          const newUser = { openId: openid, role: 'user', createdAt: new Date() };
          const addRes = await db.collection('users').add({ data: newUser });
          newUser._id = addRes._id;
          const role = 'user';
          return { code: 0, data: { ...newUser, role } };
        }
        const user = userRes.data[0];
        const role = (await isAdmin(openid)) ? 'admin' : (user.role || 'user');
        return { code: 0, data: { ...user, role } };
      }

      case 'list': {
        // 支持分页和过滤。filter 可包含 status, userOnly
        const where = {};
        if (filter.status) where.status = filter.status;
        if (filter.userOnly) where.creatorOpenId = openid;
        if (filter.keyword) where.title = db.RegExp({ regexp: filter.keyword, options: 'i' });

        const skip = (Math.max(1, page) - 1) * pageSize;
        const totalRes = await db.collection('maintenance').where(where).count();
        const res = await db.collection('maintenance').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get();
        return { code: 0, data: { list: res.data, total: totalRes.total } };
      }

      case 'get': {
        if (!id) return { code: 1, message: '缺少 id' };
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
          images: item.images || [], // fileID 数组
          status: item.status || '待处理',
          createdAt: now,
          updatedAt: now,
          creatorOpenId: openid,
          assigneeOpenId: item.assigneeOpenId || '',
          records: []
        };

        const addRes = await db.collection('maintenance').add({ data: record });
        return { code: 0, data: { _id: addRes._id, ...record } };
      }

      case 'update': {
        if (!id) return { code: 1, message: '缺少 id' };
        // 权限：创建者或管理员可更新（敏感字段限定）
        const userIsAdmin = await isAdmin(openid);
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工单不存在' };

        if (rec.data.creatorOpenId !== openid && !userIsAdmin) {
          // allow only status update or records if not owner
          // reject
          // but let admins update
          return { code: 1, message: '没有权限更新该工单' };
        }

        const updateData = { ...(payload || {}), updatedAt: new Date() };
        await db.collection('maintenance').doc(id).update({ data: updateData });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'assign': {
        if (!id) return { code: 1, message: '缺少 id' };
        // 只有管理员可指派
        if (!(await isAdmin(openid))) return { code: 1, message: '仅管理员可指派' };
        const assigneeOpenId = event.assigneeOpenId || (payload && payload.assigneeOpenId);
        if (!assigneeOpenId) return { code: 1, message: '缺少被指派人 openId' };
        const now = new Date();
        await db.collection('maintenance').doc(id).update({ data: { assigneeOpenId, updatedAt: now, records: _.push([{ type: 'assign', by: openid, to: assigneeOpenId, at: now }]) } });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'addRecord': {
        // 任意人添加处理记录（仅管理员或 assignee）
        if (!id) return { code: 1, message: '缺少 id' };
        const text = (payload && payload.text) || event.text || '';
        if (!text) return { code: 1, message: '处理记录不能为空' };
        const r = await db.collection('maintenance').doc(id).get();
        const item = r.data || {};
        const allowed = (await isAdmin(openid)) || item.assigneeOpenId === openid || item.creatorOpenId === openid;
        if (!allowed) return { code: 1, message: '没有权限添加记录' };

        const now = new Date();
        await db.collection('maintenance').doc(id).update({ data: { records: _.push([{ type: 'record', by: openid, text, at: now }]), updatedAt: now } });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'close': {
        // 结案并可附评价
        if (!id) return { code: 1, message: '缺少 id' };
        const rating = (payload && payload.rating) || event.rating;
        const comment = (payload && payload.comment) || event.comment || '';
        const r = await db.collection('maintenance').doc(id).get();
        const item = r.data || {};
        const allowed = item.creatorOpenId === openid || (await isAdmin(openid));
        if (!allowed) return { code: 1, message: '没有权限结案' };
        const now = new Date();
        const updates = { status: '已完成', updatedAt: now, records: _.push([{ type: 'close', by: openid, at: now, rating: rating || null, comment }]) };
        await db.collection('maintenance').doc(id).update({ data: updates });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('maintenance cloud function error:', err);
    return { code: 1, message: err && err.message ? err.message : '云函数执行失败' };
  }
};
