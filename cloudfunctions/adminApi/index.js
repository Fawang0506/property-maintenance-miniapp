const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function getSettings() {
  try {
    const doc = await db.collection('settings').doc('global').get();
    return (doc && doc.data) || { admins: [], adminTokens: [] };
  } catch (e) {
    return { admins: [], adminTokens: [] };
  }
}

function csvEscape(value) {
  const v = value === null || value === undefined ? '' : String(value);
  return `"${v.replace(/"/g, '""')}"`;
}

async function scoreEngineerForOrder(engineer, order) {
  // Basic scoring: lower is better
  // score = loadWeight * load + priorityWeight * priorityScore + skillMismatchPenalty
  // For now: load = current assigned count; priorityScore: 高=0, 中=5, 低=10 (lower better)
  try {
    const loadRes = await db.collection('maintenance').where({ assigneeOpenId: engineer.openId, status: db.RegExp({ regexp: '处理中|待处理', options: 'i' }) }).count();
    const load = loadRes.total || 0;
    const priority = (order.priority || '中');
    const priorityScore = priority === '高' ? 0 : (priority === '中' ? 5 : 10);

    // skill match: if order.category in engineer.skills then 0 else 20
    const skills = engineer.skills || [];
    const skillMismatch = (skills.includes(order.category) ? 0 : 20);

    // area match bonus
    const areaMatch = (engineer.areas || []).some(a => a && order.area && a.toLowerCase() === order.area.toLowerCase()) ? 0 : 5;

    const score = load * 10 + priorityScore + skillMismatch + areaMatch;
    return { openId: engineer.openId, score, load };
  } catch (e) {
    return { openId: engineer.openId, score: 9999, load: 9999 };
  }
}

exports.main = async (event, context) => {
  const action = event.action || 'list';
  const adminToken = event.adminToken || event.headers && event.headers['x-admin-token'];
  const settings = await getSettings();
  const validTokens = Array.isArray(settings.adminTokens) ? settings.adminTokens : [];

  if (action !== 'login' && !validTokens.includes(adminToken)) {
    return { code: 1, message: '未授权的管理员 token' };
  }

  try {
    switch (action) {
      case 'login': {
        if (!validTokens.includes(adminToken)) {
          return { code: 1, message: '管理员 token 无效' };
        }
        return { code: 0, data: { ok: true, token: adminToken, role: 'admin' } };
      }

      case 'list': {
        const page = Number(event.page || 1);
        const pageSize = Number(event.pageSize || 20);
        const filter = event.filter || {};
        const where = {};

        if (filter.status) where.status = filter.status;
        if (filter.keyword) where.title = db.RegExp({ regexp: filter.keyword, options: 'i' });
        if (filter.area) where.area = filter.area;
        if (filter.priority) where.priority = filter.priority;

        const skip = (page - 1) * pageSize;
        const totalRes = await db.collection('maintenance').where(where).count();
        const listRes = await db.collection('maintenance').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get();

        return { code: 0, data: { list: listRes.data, total: totalRes.total, page, pageSize } };
      }

      case 'get': {
        const id = event.id;
        if (!id) return { code: 1, message: '缺少工单 id' };
        const res = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: res.data || {} };
      }

      case 'assign': {
        const id = event.id;
        const assigneeOpenId = event.assigneeOpenId || (event.payload && event.payload.assigneeOpenId);
        if (!id || !assigneeOpenId) return { code: 1, message: '缺少工单或指派人信息' };
        const now = new Date();
        const rec = await db.collection('maintenance').doc(id).get();
        const record = { type: 'assign', by: 'admin', to: assigneeOpenId, at: now };
        const update = {
          assigneeOpenId,
          updatedAt: now,
          status: rec.data && rec.data.status ? rec.data.status : '待处理',
          records: _.push([record])
        };
        await db.collection('maintenance').doc(id).update({ data: update });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'dispatchOrder': {
        // smart assign a single order by id
        const id = event.id || (event.payload && event.payload.id);
        if (!id) return { code: 1, message: '缺少工单 id' };
        const orderRes = await db.collection('maintenance').doc(id).get();
        const order = orderRes.data;
        if (!order) return { code: 1, message: '工单不存在' };
        if (order.assigneeOpenId) return { code: 1, message: '工单已被指派' };

        // find candidate engineers: areas match or global engineers
        const engRes = await db.collection('engineers').get();
        const engineers = engRes.data || [];
        if (!engineers.length) return { code: 1, message: '无可用工程师' };

        // score each engineer
        const scored = await Promise.all(engineers.map(e => scoreEngineerForOrder(e, order)));
        scored.sort((a,b) => a.score - b.score);
        const selected = scored[0];
        if (!selected) return { code: 1, message: '无法选择工程师' };

        // assign
        const now = new Date();
        await db.collection('maintenance').doc(id).update({ data: { assigneeOpenId: selected.openId, updatedAt: now, records: _.push([{ type: 'assign', by: 'dispatch', to: selected.openId, at: now }]) } });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: { assignedTo: selected.openId, score: selected.score, order: updated.data } };
      }

      case 'batchDispatchArea': {
        // assign all pending orders in area according to scoring
        const area = event.area || (event.payload && event.payload.area);
        if (!area) return { code: 1, message: '缺少 area 参数' };

        const pendingRes = await db.collection('maintenance').where({ area, status: '待处理' }).get();
        const pending = pendingRes.data || [];
        if (!pending.length) return { code: 0, data: { assigned: 0 } };

        const engRes = await db.collection('engineers').get();
        const engineers = engRes.data || [];
        if (!engineers.length) return { code: 1, message: '无可用工程师' };

        let assignedCount = 0;
        for (const order of pending) {
          const scored = await Promise.all(engineers.map(e => scoreEngineerForOrder(e, order)));
          scored.sort((a,b) => a.score - b.score);
          const sel = scored[0];
          if (!sel) continue;
          const now = new Date();
          await db.collection('maintenance').doc(order._id).update({ data: { assigneeOpenId: sel.openId, updatedAt: now, records: _.push([{ type: 'assign', by: 'dispatch', to: sel.openId, at: now }]) } });
          assignedCount++;
        }

        return { code: 0, data: { assigned: assignedCount } };
      }

      case 'reportDetailed': {
        // return time-series for last N days and per-engineer counts
        const days = Number(event.days || 14);
        const now = new Date();
        const results = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const start = new Date(d.setHours(0,0,0,0));
          const end = new Date(d.setHours(23,59,59,999));
          const dayCount = await db.collection('maintenance').where({ createdAt: _.gte(start).and(_.lte(end)) }).count();
          results.push({ date: start.toISOString().slice(0,10), count: dayCount.total || 0 });
        }

        // per-engineer counts (last 30 days)
        const engRes2 = await db.collection('engineers').get();
        const engineers = engRes2.data || [];
        const perEngineer = [];
        for (const e of engineers) {
          const c = await db.collection('maintenance').where({ assigneeOpenId: e.openId, createdAt: _.gte(new Date(Date.now() - 30*24*3600*1000)) }).count();
          perEngineer.push({ openId: e.openId, name: e.name, count: c.total || 0 });
        }

        return { code: 0, data: { timeseries: results, perEngineer } };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('adminApi error', err);
    return { code: 1, message: err && err.message ? err.message : '管理员 API 执行失败' };
  }
};
