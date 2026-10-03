const ADMIN_API_BASE_URL = 'https://your-admin-api.example.com';
const token = localStorage.getItem('adminToken') || prompt('请输入 admin token');
const rangeSelect = document.getElementById('rangeSelect');
const exportBtn = document.getElementById('exportBtn');

async function api(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload, adminToken: token });
  const res = await fetch(ADMIN_API_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || '请求失败');
  return json.data;
}

async function loadDashboard() {
  try {
    const days = Number(rangeSelect.value || 7);
    const data = await api('dashboard', { days });
    const cards = [
      { label: '总工单', value: data.totals.total },
      { label: '已完成率', value: `${data.completionRate || 0}%` },
      { label: '待处理', value: data.totals.pending },
      { label: '超时单', value: data.totals.overdue },
      { label: '平均处理时长', value: `${data.avgCompletionHours || 0} 小时` },
      { label: '新增工单', value: data.newCount || 0 }
    ];

    document.getElementById('dashboardCards').innerHTML = cards.map(c => `
      <div class="card">
        <div class="tiny">${c.label}</div>
        <div class="value">${c.value}</div>
      </div>
    `).join('');

    renderTrend(data.trend || []);
    renderList('areaChart', data.byArea || []);
    renderList('priorityChart', data.byPriority || []);
    renderAlerts(data.alerts || []);
    await loadRoleSummary();
    await loadSlaSummary();
    await loadPerformance();
  } catch (err) {
    alert(err.message || '加载运营大盘失败');
  }
}

async function loadRoleSummary() {
  try {
    const data = await api('getRoleSummary');
    const roles = data.roles || [];
    document.getElementById('roleSummary').innerHTML = roles.map(role => `
      <div class="tiny" style="margin:8px 0;">${role}</div>
    `).join('');
  } catch (err) {
    document.getElementById('roleSummary').innerHTML = '<div class="tiny">角色配置加载失败</div>';
  }
}

async function loadSlaSummary() {
  try {
    const data = await api('getSla');
    document.getElementById('slaSummary').innerHTML = `
      <div class="tiny" style="margin:8px 0;">预警阈值：${data.warnHours || 8} 小时</div>
      <div class="tiny" style="margin:8px 0;">严重阈值：${data.criticalHours || 24} 小时</div>
      <div class="tiny" style="margin:8px 0;">支持配置化管理</div>
    `;
  } catch (err) {
    document.getElementById('slaSummary').innerHTML = '<div class="tiny">SLA 配置不可用</div>';
  }
}

async function loadPerformance() {
  try {
    const data = await api('performance');
    const list = data.engineers || [];
    const table = `
      <table>
        <thead>
          <tr><th>工程师</th><th>总工单</th><th>完成</th><th>完成率</th><th>超时</th><th>平均时长</th></tr>
        </thead>
        <tbody>
          ${list.map(e => `
            <tr>
              <td>${e.name}</td>
              <td>${e.total}</td>
              <td>${e.completed}</td>
              <td>${e.completionRate}%</td>
              <td>${e.overTime}</td>
              <td>${e.avgHours || 0}h</td>
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

function renderTrend(series) {
  const el = document.getElementById('trendChart');
  if (!series.length) { el.innerHTML = '<div class="tiny">暂无趋势数据</div>'; return; }
  const max = Math.max(...series.map(x => x.total || 0), 1);
  el.innerHTML = series.map(item => `
    <div class="bar-day">
      <div class="bar-fill" style="height:${Math.max(20, ((item.total || 0) / max) * 100)}%"></div>
      <div class="day-label">${item.date}</div>
    </div>
  `).join('');
}

function renderList(id, list) {
  const el = document.getElementById(id);
  if (!list.length) { el.innerHTML = '<div class="tiny">无数据</div>'; return; }
  const max = Math.max(...list.map(x => x.count || 0), 1);
  el.innerHTML = list.map(item => `
    <div class="bar-wrap">
      <span style="width:120px;display:inline-block;color:#dfeaff;">${item.name || item.openId || '未知'}</span>
      <span class="bar" style="width:${Math.max(12, ((item.count || 0) / max) * 100)}%"></span>
      <span class="tiny">${item.count}</span>
    </div>
  `).join('');
}

function renderAlerts(alerts) {
  const el = document.getElementById('alertList');
  if (!alerts.length) {
    el.innerHTML = '<div class="tiny">暂无超时预警</div>';
    return;
  }

  el.innerHTML = alerts.map(item => `
    <div class="alert-item">
      <div class="alert-meta">
        <strong>${item.title}</strong>
        <span class="tiny">区域：${item.area} · 工程师：${item.assignee}</span>
        <span class="tiny">创建时间：${new Date(item.createdAt).toLocaleString()}</span>
      </div>
      <span class="badge ${item.level === 'critical' ? 'critical' : 'warning'}">${item.level === 'critical' ? '严重超时' : '超时'} ${item.overdueHours}h</span>
    </div>
  `).join('');
}

async function exportDashboardCsv() {
  try {
    const days = Number(rangeSelect.value || 7);
    const data = await api('export', { days, filter: {} });
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'maintenance-export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message || '导出失败');
  }
}

rangeSelect.addEventListener('change', loadDashboard);
exportBtn.addEventListener('click', exportDashboardCsv);
loadDashboard();
