const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

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

      case 'listEngineers': {
        const res = await db.collection('engineers').get();
        return { code: 0, data: res.data || [] };
      }

      case 'createEngineer': {
        const eng = event.payload || {};
        if (!eng.openId || !eng.name) return { code: 1, message: '缺少工程师 openId 或 name' };
        const doc = { openId: eng.openId, name: eng.name, phone: eng.phone || '', areas: eng.areas || [], createdAt: new Date() };
        const r = await db.collection('engineers').add({ data: doc });
        return { code: 0, data: { _id: r._id, ...doc } };
      }

      case 'export': {
        const page = Number(event.page || 1);
        const pageSize = Number(event.pageSize || 500);
        const filter = event.filter || {};
        const where = {};
        if (filter.status) where.status = filter.status;
        if (filter.keyword) where.title = db.RegExp({ regexp: filter.keyword, options: 'i' });

        const skip = (page - 1) * pageSize;
        const listRes = await db.collection('maintenance').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get();
        const list = listRes.data || [];

        const header = ['工单ID', '标题', '状态', '类别', '位置', '区域', '优先级', '联系人', '创建时间', '更新时间'];
        const rows = list.map(item => [
          item._id || item.id || '',
          item.title || '',
          item.status || '',
          item.category || '',
          item.location || '',
          item.area || '',
          item.priority || '',
          item.contact || '',
          item.createdAt ? new Date(item.createdAt).toISOString() : '',
          item.updatedAt ? new Date(item.updatedAt).toISOString() : ''
        ]);

        const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
        return { code: 0, data: { csv }, filename: 'maintenance-export.csv' };
      }

      case 'report': {
        // quick aggregated report: by area and by priority
        const areas = await db.collection('maintenance').aggregate().group({ _id: '$area', count: _.sum(1) }).end().catch(()=>null);
        const byPriority = {
          high: (await db.collection('maintenance').where({ priority: '高' }).count()).total || 0,
          medium: (await db.collection('maintenance').where({ priority: '中' }).count()).total || 0,
          low: (await db.collection('maintenance').where({ priority: '低' }).count()).total || 0
        };
        return { code: 0, data: { areas: (areas && areas.list) || [], byPriority } };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('adminApi error', err);
    return { code: 1, message: err && err.message ? err.message : '管理员 API 执行失败' };
  }
};
