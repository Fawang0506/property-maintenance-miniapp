const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Scheduler: reassign orders when assignee does not accept within SLA
// Run periodically (e.g., cloud scheduler every 10 minutes)

async function getSettings() {
  try {
    const doc = await db.collection('settings').doc('global').get();
    return (doc && doc.data) || {};
  } catch (e) {
    return {};
  }
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
  console.log('scheduler started');
  const settings = await getSettings();
  const acceptTimeoutHours = (settings.dispatch && settings.dispatch.acceptTimeoutHours) || 1; // default 1 hour
  const now = Date.now();
  try {
    // find assigned but still pending orders
    const res = await db.collection('maintenance').where({ status: '待处理' }).limit(1000).get();
    const list = res.data || [];
    if (!list.length) return { code: 0, message: 'no pending' };

    const engineersRes = await db.collection('engineers').get();
    const engineers = engineersRes.data || [];
    if (!engineers.length) return { code: 0, message: 'no engineers' };

    let reassignCount = 0;

    for (const order of list) {
      if (!order.assigneeOpenId) continue;
      // find last assign record timestamp
      const records = order.records || [];
      const assigns = records.filter(r => r.type === 'assign');
      if (!assigns.length) continue;
      const lastAssign = assigns[assigns.length - 1];
      const assignAt = lastAssign && lastAssign.at ? new Date(lastAssign.at).getTime() : null;
      if (!assignAt) continue;
      const hoursSinceAssign = (now - assignAt) / 3600000;
      if (hoursSinceAssign < acceptTimeoutHours) continue; // not timed out yet

      // try reassign to next best (exclude current assignee)
      const candidates = engineers.filter(e => e.openId !== order.assigneeOpenId);
      if (!candidates.length) continue;
      const scored = await Promise.all(candidates.map(e => scoreEngineerForOrder(e, order)));
      scored.sort((a,b) => a.score - b.score);
      const selected = scored[0];
      if (!selected) continue;

      const nowDate = new Date();
      // add record about timeout and reassign
      await db.collection('maintenance').doc(order._id).update({ data: {
        assigneeOpenId: selected.openId,
        updatedAt: nowDate,
        records: _.push([
          { type: 'assign_timeout', by: 'scheduler', from: order.assigneeOpenId, at: nowDate, note: `auto reassign after ${acceptTimeoutHours}h` },
          { type: 'assign', by: 'scheduler', to: selected.openId, at: nowDate }
        ])
      }});

      await db.collection('logs').add({ data: { kind: 'reassign', orderId: order._id, at: nowDate, from: order.assigneeOpenId, to: selected.openId, reason: 'assignee timeout' } });
      reassignCount++;
    }

    return { code: 0, data: { reassignCount } };
  } catch (err) {
    console.error('scheduler error', err);
    return { code: 1, message: err.message || 'scheduler failed' };
  }
};
