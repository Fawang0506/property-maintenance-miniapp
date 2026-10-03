// admin extended app.js
const ADMIN_API_BASE_URL = 'https://your-admin-api.example.com';
let state = {
  token: localStorage.getItem('adminToken') || '',
  page: 1,
  pageSize: 20,
  filter: { status: '', keyword: '' },
  list: []
};

const toListBtn = document.getElementById('toList');
const toEngineersBtn = document.getElementById('toEngineers');
const toReportsBtn = document.getElementById('toReports');
const logoutBtn = document.getElementById('logoutBtn');
const panelList = document.getElementById('panelList');
const panelEngineers = document.getElementById('panelEngineers');
const panelReports = document.getElementById('panelReports');

function showPanel(panel) {
  [panelList, panelEngineers, panelReports].forEach(p => p.classList.add('hidden'));
  panel.classList.remove('hidden');
}

async function api(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload, adminToken: state.token });
  const res = await fetch(ADMIN_API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

toListBtn.onclick = () => showPanel(panelList);
toEngineersBtn.onclick = () => showPanel(panelEngineers);
toReportsBtn.onclick = () => showPanel(panelReports);
logoutBtn.onclick = () => { localStorage.removeItem('adminToken'); location.reload(); };

// Engineers
const engForm = document.getElementById('engForm');
const engOpenId = document.getElementById('engOpenId');
const engName = document.getElementById('engName');
const engPhone = document.getElementById('engPhone');
const engAreas = document.getElementById('engAreas');
const engineerList = document.getElementById('engineerList');

engForm.onsubmit = async (e) => {
  e.preventDefault();
  const payload = { openId: engOpenId.value.trim(), name: engName.value.trim(), phone: engPhone.value.trim(), areas: engAreas.value.split(',').map(s => s.trim()).filter(Boolean) };
  if (!payload.openId || !payload.name) return alert('请填写 openId 与姓名');
  try {
    await api('createEngineer', { payload });
    loadEngineers();
    engForm.reset();
  } catch (err) { alert(err.message || '新增失败'); }
};

async function loadEngineers() {
  try {
    const list = await api('listEngineers');
    engineerList.innerHTML = list.map(e => `<div class="engineer">${e.name} (${e.openId}) - ${e.areas.join(',')}</div>`).join('');
  } catch (err) { engineerList.innerHTML = '加载失败'; }
}

// Reports
async function loadReports() {
  try {
    const data = await api('report');
    const areas = data.areas || [];
    const p = data.byPriority || {};
    document.getElementById('reportArea').innerHTML = `<h4>按区域统计</h4>${areas.map(a => `<div>${a._id || '未分区'}: ${a.count}</div>`).join('')}`;
    document.getElementById('reportPriority').innerHTML = `<h4>按优先级</h4><div>高: ${p.high}</div><div>中: ${p.medium}</div><div>低: ${p.low}</div>`;
  } catch (err) { document.getElementById('reportArea').innerText = '加载报表失败'; }
}

// Initialize
if (!state.token) {
  // redirect to login or simple prompt
  const token = prompt('请输入 admin token：');
  if (!token) alert('未登录');
  state.token = token;
  localStorage.setItem('adminToken', token);
}

showPanel(panelList);
loadEngineers();
loadReports();
