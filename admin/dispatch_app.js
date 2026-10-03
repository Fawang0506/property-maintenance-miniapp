const ADMIN_API_BASE_URL = 'https://your-admin-api.example.com';
const token = localStorage.getItem('adminToken') || prompt('请输入 admin token');

async function api(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload, adminToken: token });
  const res = await fetch(ADMIN_API_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || '请求失败');
  return json.data;
}

document.getElementById('dispatchBtn').onclick = async () => {
  const id = document.getElementById('orderId').value.trim();
  if (!id) return alert('请输入工单 ID');
  try {
    const data = await api('dispatchOrder', { id });
    document.getElementById('dispatchResult').innerText = JSON.stringify(data, null, 2);
  } catch (e) { document.getElementById('dispatchResult').innerText = e.message; }
};

document.getElementById('batchDispatchBtn').onclick = async () => {
  const area = document.getElementById('areaInput').value.trim();
  if (!area) return alert('请输入区域');
  try {
    const data = await api('batchDispatchArea', { area });
    document.getElementById('batchResult').innerText = JSON.stringify(data, null, 2);
  } catch (e) { document.getElementById('batchResult').innerText = e.message; }
};

document.getElementById('reportBtn').onclick = async () => {
  const days = Number(document.getElementById('daysInput').value) || 14;
  try {
    const data = await api('reportDetailed', { days });
    renderChart(data.timeseries || []);
    renderEngineerStats(data.perEngineer || []);
  } catch (e) { alert(e.message || '获取报表失败'); }
};

function renderChart(series) {
  const chart = document.getElementById('chart');
  if (!series.length) { chart.innerText = '无数据'; return; }
  const max = Math.max(...series.map(s=>s.count));
  chart.innerHTML = series.map(s => `<div style="display:flex;align-items:center;margin:6px 0;"><div style="width:140px">${s.date}</div><div style="height:18px;background:#2f80ed;width:${(s.count/max*100)||0}%;min-width:10px;margin-left:8px;border-radius:6px"></div><div style="margin-left:8px">${s.count}</div></div>`).join('');
}

function renderEngineerStats(list) {
  const node = document.getElementById('engineerStats');
  if (!list.length) { node.innerText = '无工程师数据'; return; }
  node.innerHTML = `<h4>工程师近30天工单数</h4>` + list.map(e => `<div>${e.name || e.openId}: ${e.count}</div>`).join('');
}
