const ADMIN_API_BASE_URL = 'https://your-admin-api.example.com';
const token = localStorage.getItem('adminToken') || prompt('请输入 admin token');

async function api(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload, adminToken: token });
  const res = await fetch(ADMIN_API_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || '请求失败');
  return json.data;
}

async function loadDashboard() {
  try {
    const data = await api('dashboard');
    const cards = [
      { label: '总工单', value: data.totals.total },
      { label: '待处理', value: data.totals.pending },
      { label: '处理中', value: data.totals.processing },
      { label: '已完成', value: data.totals.completed },
      { label: '平均处理时长', value: `${data.avgCompletionHours || 0} 小时` },
      { label: 'TOP 工程师', value: data.topEngineer ? data.topEngineer.openId : '无' }
    ];
    document.getElementById('dashboardCards').innerHTML = cards.map(c => `
      <div class="card">
        <div class="subtitle">${c.label}</div>
        <div class="value">${c.value}</div>
      </div>
    `).join('');

    renderList('areaChart', data.byArea || []);
    renderList('priorityChart', data.byPriority || []);
    loadPerformance();
  } catch (err) {
    alert(err.message || '加载运营大盘失败');
  }
}

async function loadPerformance() {
  try {
    const data = await api('performance');
    const list = data.engineers || [];
    const table = `
      <table>
        <thead>
          <tr><th>工程师</th><th>总工单</th><th>完成</th><th>完成率</th><th>超时</th></tr>
        </thead>
        <tbody>
          ${list.map(e => `
            <tr>
              <td>${e.name}</td>
              <td>${e.total}</td>
              <td>${e.completed}</td>
              <td>${e.completionRate}%</td>
              <td>${e.overTime}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('engineerPerformance').innerHTML = table;
  } catch (err) {
    document.getElementById('engineerPerformance').innerHTML = '加载绩效失败';
  }
}

function renderList(id, list) {
  const el = document.getElementById(id);
  if (!list.length) { el.innerHTML = '<div class="tiny">无数据</div>'; return; }
  const max = Math.max(...list.map(x => x.count || 0));
  el.innerHTML = list.map(item => `
    <div class="bar-wrap" style="margin:10px 0;">
      <span style="width:90px;display:inline-block;">${item.name || item.openId || '未知'}</span>
      <span class="bar" style="width:${Math.max(12, ((item.count || 0) / max) * 100)}%"></span>
      <span class="tiny">${item.count}</span>
    </div>
  `).join('');
}

loadDashboard();
