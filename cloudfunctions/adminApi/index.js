const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSettings() {
  try {
    const doc = await db.collection('settings').doc('global').get();
    return (doc && doc.data) || { admins: [], adminTokens: [], sla: { warnHours: 8, criticalHours: 24 } };
  } catch (e) {
    return { admins: [], adminTokens: [], sla: { warnHours: 8, criticalHours: 24 } };
  }
}

function csvEscape(value) {
  const v = value === null || value === undefined ? '' : String(value);
  return `"${v.replace(/"/g, '""')}"`;
}

function formatHours(hours) {
  return Number(hours || 0).toFixed(1);
}

async function scoreEngineerForOrder(engineer, order) {
  try {
    const loadRes = await db.collection('maintenance').where({ assigneeOpenId: engineer.openId, status: db.RegExp({ regexp: '处理中|待处理', options: 'i' }) }).count();
    const load = loadRes.total || 0;
    const priority = (order.priority || '中');
    const priorityScore = priority === '高' ? 0 : (priority === '中' ? 5 : 10);
    const skills = engineer.skills || [];
    const skillMismatch = (skills.includes(order.category) ? 0 : 20);
    const areaMatch = (engineer.areas || []).some(a => a && order.area && a.toLowerCase() === order.area.toLowerCase()) ? 0 : 5;
    const score = load * 10 + priorityScore + skillMismatch + areaMatch;
    return { openId: engineer.openId, score, load };
  } catch (e) {
    return { openId: engineer.openId, score: 9999, load: 9999 };
  }
}

exports.main = async (event, context) => {
  const action = event.action || 'list';
  const adminToken = event.adminToken || (event.headers && event.headers['x-admin-token']);
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
          records: _.push([record]),
        };
        await db.collection('maintenance').doc(id).update({ data: update });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: updated.data || {} };
      }

      case 'dispatchOrder': {
        const id = event.id || (event.payload && event.payload.id);
        if (!id) return { code: 1, message: '缺少工单 id' };
        const orderRes = await db.collection('maintenance').doc(id).get();
        const order = orderRes.data;
        if (!order) return { code: 1, message: '工单不存在' };
        if (order.assigneeOpenId) return { code: 1, message: '工单已被指派' };

        const engRes = await db.collection('engineers').get();
        const engineers = engRes.data || [];
        if (!engineers.length) return { code: 1, message: '无可用工程师' };

        const scored = await Promise.all(engineers.map(e => scoreEngineerForOrder(e, order)));
        scored.sort((a, b) => a.score - b.score);
        const selected = scored[0];
        if (!selected) return { code: 1, message: '无法选择工程师' };

        const now = new Date();
        await db.collection('maintenance').doc(id).update({
          data: {
            assigneeOpenId: selected.openId,
            updatedAt: now,
            records: _.push([{ type: 'assign', by: 'dispatch', to: selected.openId, at: now }]),
          },
        });
        const updated = await db.collection('maintenance').doc(id).get();
        return { code: 0, data: { assignedTo: selected.openId, score: selected.score, order: updated.data } };
      }

      case 'batchDispatchArea': {
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
          scored.sort((a, b) => a.score - b.score);
          const sel = scored[0];
          if (!sel) continue;
          const now = new Date();
          await db.collection('maintenance').doc(order._id).update({
            data: {
              assigneeOpenId: sel.openId,
              updatedAt: now,
              records: _.push([{ type: 'assign', by: 'dispatch', to: sel.openId, at: now }]),
            },
          });
          assignedCount++;
        }

        return { code: 0, data: { assigned: assignedCount } };
      }

      case 'dashboard': {
        const days = Number(event.days || 7);
        const all = await db.collection('maintenance').limit(2000).get();
        const list = all.data || [];
        const sla = settings.sla || { warnHours: 8, criticalHours: 24 };

        const totals = {
          total: list.length,
          pending: 0,
          processing: 0,
          completed: 0,
          canceled: 0,
          overdue: 0,
          warning: 0,
          critical: 0,
        };

        const byArea = {};
        const byPriority = { 高: 0, 中: 0, 低: 0 };
        const byEngineer = {};
        const trend = [];
        const alerts = [];

        let totalResolveHours = 0;
        let resolveCount = 0;
        let newCount = 0;

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - Math.max(1, days - 1));
        startDate.setHours(0, 0, 0, 0);

        for (const item of list) {
          if (item.status === '待处理') totals.pending++;
          if (item.status === '处理中') totals.processing++;
          if (item.status === '已完成') totals.completed++;
          if (item.status === '已取消') totals.canceled++;

          if (item.createdAt && new Date(item.createdAt) >= startDate) {
            newCount++;
          }

          const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : null;
          const overdueMs = createdAt ? (Date.now() - createdAt) : 0;
          const isOverdue = item.status !== '已完成' && item.status !== '已取消' && createdAt && overdueMs > Number(sla.warnHours || 8) * 3600000;
          if (isOverdue) {
            totals.overdue++;
            const level = overdueMs > Number(sla.criticalHours || 24) * 3600000 ? 'critical' : 'warning';
            if (level === 'critical') totals.critical++;
            else totals.warning++;
            alerts.push({
              _id: item._id,
              title: item.title || '未命名工单',
              area: item.area || '未分区',
              priority: item.priority || '中',
              assignee: item.assigneeOpenId || '未指派',
              overdueHours: Number((overdueMs / 3600000).toFixed(1)),
              level,
              createdAt: item.createdAt,
            });
          }

          const area = item.area || '未分区';
          byArea[area] = (byArea[area] || 0) + 1;

          const p = item.priority || '中';
          byPriority[p] = (byPriority[p] || 0) + 1;

          if (item.assigneeOpenId) {
            byEngineer[item.assigneeOpenId] = (byEngineer[item.assigneeOpenId] || 0) + 1;
          }

          if (item.status === '已完成' && item.createdAt && item.updatedAt) {
            const diffMs = new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime();
            totalResolveHours += diffMs / 3600000;
            resolveCount++;
          }
        }

        for (let i = days - 1; i >= 0; i--) {
          const day = new Date(today);
          day.setDate(today.getDate() - i);
          day.setHours(0, 0, 0, 0);
          const nextDay = new Date(day);
          nextDay.setDate(day.getDate() + 1);

          const dayCount = list.filter(item => {
            const ts = item.createdAt ? new Date(item.createdAt).getTime() : null;
            return ts && ts >= day.getTime() && ts < nextDay.getTime();
          }).length;

          const completed = list.filter(item => {
            const ts = item.updatedAt ? new Date(item.updatedAt).getTime() : null;
            return ts && ts >= day.getTime() && ts < nextDay.getTime() && item.status === '已完成';
          }).length;

          trend.push({
            date: `${day.getMonth() + 1}/${day.getDate()}`,
            total: dayCount,
            completed,
            pending: Math.max(0, dayCount - completed),
          });
        }

        const topEngineer = Object.entries(byEngineer)
          .map(([openId, count]) => ({ openId, count }))
          .sort((a, b) => b.count - a.count)[0] || null;

        const avgCompletionHours = resolveCount ? (totalResolveHours / resolveCount) : 0;
        const completionRate = totals.total ? Number(((totals.completed / totals.total) * 100).toFixed(2)) : 0;

        return {
          code: 0,
          data: {
            totals,
            byArea: Object.entries(byArea).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            byPriority: Object.entries(byPriority).map(([name, count]) => ({ name, count })).filter(item => item.count > 0),
            topEngineer,
            avgCompletionHours: Number(avgCompletionHours.toFixed(2)),
            completionRate,
            newCount,
            trend,
            alerts: alerts.slice(0, 10),
            generatedAt: new Date().toISOString(),
          }
        };
      }

      case 'performance': {
        const engineersRes = await db.collection('engineers').get();
        const engineers = engineersRes.data || [];
        const results = [];

        for (const engineer of engineers) {
          const tickets = await db.collection('maintenance').where({ assigneeOpenId: engineer.openId }).get();
          const list = tickets.data || [];
          const total = list.length;
          const completed = list.filter(item => item.status === '已完成').length;
          const pending = list.filter(item => item.status === '待处理').length;
          const processing = list.filter(item => item.status === '处理中').length;
          const overTime = list.filter(item => item.status !== '已完成' && item.createdAt && Date.now() - new Date(item.createdAt).getTime() > 24 * 3600000).length;
          const resolvedHours = list.filter(item => item.status === '已完成' && item.createdAt && item.updatedAt).reduce((sum, item) => {
            const diff = new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime();
            return sum + diff / 3600000;
          }, 0);
          const avgHours = total ? Number((resolvedHours / completed || 0).toFixed(2)) : 0;
          const completionRate = total ? Number(((completed / total) * 100).toFixed(2)) : 0;

          results.push({
            openId: engineer.openId,
            name: engineer.name || '工程师',
            total,
            completed,
            pending,
            processing,
            overTime,
            avgHours,
            completionRate,
          });
        }

        results.sort((a, b) => b.completionRate - a.completionRate || b.total - a.total);
        return { code: 0, data: { engineers: results } };
      }

      case 'reportDetailed': {
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

        const engRes2 = await db.collection('engineers').get();
        const engineers = engRes2.data || [];
        const perEngineer = [];
        for (const e of engineers) {
          const c = await db.collection('maintenance').where({ assigneeOpenId: e.openId, createdAt: _.gte(new Date(Date.now() - 30*24*3600*1000)) }).count();
          perEngineer.push({ openId: e.openId, name: e.name, count: c.total || 0 });
        }

        return { code: 0, data: { timeseries: results, perEngineer } };
      }

      case 'listEngineers': {
        const res = await db.collection('engineers').get();
        return { code: 0, data: res.data || [] };
      }

      case 'createEngineer': {
        const eng = event.payload || {};
        if (!eng.openId || !eng.name) return { code: 1, message: '缺少工程师 openId 或 name' };
        const doc = { openId: eng.openId, name: eng.name, phone: eng.phone || '', areas: eng.areas || [], skills: eng.skills || [], createdAt: new Date() };
        const r = await db.collection('engineers').add({ data: doc });
        return { code: 0, data: { _id: r._id, ...doc } };
      }

      case 'export': {
        const days = Number(event.days || 7);
        const filter = event.filter || {};
        const where = {};
        if (filter.status) where.status = filter.status;
        if (filter.keyword) where.title = db.RegExp({ regexp: filter.keyword, options: 'i' });
        if (filter.area) where.area = filter.area;
        if (filter.priority) where.priority = filter.priority;

        const all = await db.collection('maintenance').where(where).limit(2000).get();
        const list = all.data || [];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const filtered = list.filter(item => {
          if (!item.createdAt) return false;
          return new Date(item.createdAt) >= cutoff;
        });

        const header = ['工单ID', '标题', '状态', '类别', '位置', '区域', '优先级', '联系人', '创建时间', '更新时间'];
        const rows = filtered.map(item => [
          item._id || item.id || '',
          item.title || '',
          item.status || '',
          item.category || '',
          item.location || '',
          item.area || '',
          item.priority || '',
          item.contact || '',
          item.createdAt ? new Date(item.createdAt).toISOString() : '',
          item.updatedAt ? new Date(item.updatedAt).toISOString() : '',
        ]);

        const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
        return { code: 0, data: { csv, filename: `maintenance-export-${days}d.csv` } };
      }

      case 'setSla': {
        const sla = event.payload || {};
        const next = {
          warnHours: Number(sla.warnHours || settings.sla?.warnHours || 8),
          criticalHours: Number(sla.criticalHours || settings.sla?.criticalHours || 24),
        };
        await db.collection('settings').doc('global').set({ data: { ...(settings || {}), sla: next } });
        return { code: 0, data: next };
      }

      case 'getSla': {
        return { code: 0, data: settings.sla || { warnHours: 8, criticalHours: 24 } };
      }

      default:
        return { code: 1, message: '未知 action' };
    }
  } catch (err) {
    console.error('adminApi error', err);
    return { code: 1, message: err && err.message ? err.message : '管理员 API 执行失败' };
  }
};
