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

// helper: get engineer by id
async function getEngineer(id) {
  try {
    const res = await db.collection('engineers').doc(id).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

exports.main = async (event, context) => {
  const { action, id, payload, page = 1, pageSize = 20, filter = {} } = event;
  const openid = context.OPENID;

  try {
    switch (action) {
      case 'whoami': {
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
        // 支持分页和过滤。filter 可包含 status, userOnly, area, priority
        const where = {};
        if (filter.status) where.status = filter.status;
        if (filter.userOnly) where.creatorOpenId = openid;
        if (filter.keyword) where.title = db.RegExp({ regexp: filter.keyword, options: 'i' });
        if (filter.area) where.area = filter.area;
        if (filter.priority) where.priority = filter.priority;

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
          area: item.area || '',
          priority: item.priority || '中',
          locationDetail: item.locationDetail || '',
          contact: item.contact || '未填写',
          description: item.description || '',
          images: item.images || [],
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
        const userIsAdmin = await isAdmin(openid);
        const rec = await db.collection('maintenance').doc(id).get();
        if (!rec || !rec.data) return { code: 1, message: '工���不存在' };

        // Only allow update by creator, assignee or admin
        if (rec.data.creatorOpenId !== openid && rec.data.assigneeOpenId !== openid && !userIsAdmin) {
          return { code: 1, message: '没有权限更新该工单' };
        }

        const updateData = { ...(payload || {}), updatedAt: new Date() };
        await db.collection('maintenance').doc(id).update({ data: updateData });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'assign': {
        if (!id) return { code: 1, message: '缺少 id' };
        if (!(await isAdmin(openid))) return { code: 1, message: '仅管理员可指派' };
        const assigneeOpenId = event.assigneeOpenId || (payload && payload.assigneeOpenId);
        if (!assigneeOpenId) return { code: 1, message: '缺少被指派人 openId' };
        const now = new Date();
        await db.collection('maintenance').doc(id).update({ data: { assigneeOpenId, updatedAt: now, records: _.push([{ type: 'assign', by: openid, to: assigneeOpenId, at: now }]) } });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'assignByStrategy': {
        // 自动派单策略：按 area -> 优先级 -> 最少在责工单
        if (!(await isAdmin(openid))) return { code: 1, message: '仅管理员可触发自动派单' };
        const targetArea = (payload && payload.area) || filter.area || '';
        if (!targetArea) return { code: 1, message: '请指定区域 area' };

        // 找到可用工程师
        const engineersRes = await db.collection('engineers').where({ areas: db.RegExp({ regexp: targetArea, options: 'i' }) }).get();
        const engineers = engineersRes.data || [];
        if (!engineers.length) return { code: 1, message: '该区域暂无工程师' };

        // 为简化：选择当前工单最少的工程师
        const counts = await Promise.all(engineers.map(async e => {
          const c = await db.collection('maintenance').where({ assigneeOpenId: e.openId, status: db.RegExp({ regexp: '处理中|待处理', options: 'i' }) }).count();
          return { engineer: e, count: c.total || 0 };
        }));

        counts.sort((a,b) => a.count - b.count);
        const selected = counts[0] && counts[0].engineer;
        if (!selected) return { code: 1, message: '无法找到合适工程师' };

        // assign all matching unassigned in area and status '待处理'
        const toAssignRes = await db.collection('maintenance').where({ area: targetArea, status: '待处理' }).get();
        const toAssign = toAssignRes.data || [];
        const now = new Date();
        for (const t of toAssign) {
          await db.collection('maintenance').doc(t._id).update({ data: { assigneeOpenId: selected.openId, updatedAt: now, records: _.push([{ type: 'assign', by: openid, to: selected.openId, at: now }]) } });
        }

        return { code: 0, data: { assignedTo: selected.openId, count: toAssign.length } };
      }

      case 'addRecord': {
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
        if (!id) return { code: 1, message: '缺少 id' };
        const rating = (payload && payload.rating) || event.rating;
        const comment = (payload && payload.comment) || event.comment || '';
        const r = await db.collection('maintenance').doc(id).get();
        const item = r.data || {};
        const allowed = item.creatorOpenId === openid || (await isAdmin(openid)) || item.assigneeOpenId === openid;
        if (!allowed) return { code: 1, message: '没有权限结案' };
        const now = new Date();
        const updates = { status: '已完成', updatedAt: now, records: _.push([{ type: 'close', by: openid, at: now, rating: rating || null, comment }]) };
        await db.collection('maintenance').doc(id).update({ data: updates });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'createEngineer': {
        if (!(await isAdmin(openid))) return { code: 1, message: '仅管理员可新增工程师' };
        const eng = payload || {};
        if (!eng.openId || !eng.name) return { code: 1, message: '缺少工程师 openId 或 name' };
        const doc = { openId: eng.openId, name: eng.name, phone: eng.phone || '', areas: eng.areas || [], createdAt: new Date() };
        const res = await db.collection('engineers').add({ data: doc });
        return { code: 0, data: { _id: res._id, ...doc } };
      }

      case 'listEngineers': {
        const res = await db.collection('engineers').get();
        return { code: 0, data: res.data || [] };
      }

      case 'stats': {
        // 返回按状态、按区域、按优先级统计
        const total = await db.collection('maintenance').count();
        const byStatus = await db.collection('maintenance').aggregate().group({
          _id: '$status',
          count: $.sum(1)
        }).end().catch(()=>({}));
        // Fallback simple counts if aggregate not supported
        const pending = await db.collection('maintenance').where({ status: '待处理' }).count();
        const processing = await db.collection('maintenance').where({ status: '处理中' }).count();
        const done = await db.collection('maintenance').where({ status: '已完成' }).count();

        return { code: 0, data: { total: total.total || 0, pending: pending.total || 0, processing: processing.total || 0, done: done.total || 0 } };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('maintenance cloud function error:', err);
    return { code: 1, message: err && err.message ? err.message : '云函数执行失败' };
  }
};
