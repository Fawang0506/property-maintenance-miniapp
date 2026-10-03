const ADMIN_API_BASE_URL = 'https://your-admin-api.example.com';
let state = {
  token: localStorage.getItem('adminToken') || '',
  page: 1,
  pageSize: 20,
  filter: { status: '', keyword: '' },
  list: []
};

const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const tokenInput = document.getElementById('tokenInput');
const statusFilter = document.getElementById('statusFilter');
const keywordInput = document.getElementById('keywordInput');
const tableBody = document.getElementById('tableBody');
const stats = document.getElementById('stats');
const pagination = document.getElementById('pagination');

function showDashboard() {
  loginPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
}

function showLogin() {
  dashboard.classList.add('hidden');
  loginPanel.classList.remove('hidden');
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

async function login(token) {
  state.token = token;
  localStorage.setItem('adminToken', token);
  try {
    await api('login', { adminToken: token });
    showDashboard();
    await loadList();
  } catch (err) {
    alert(err.message || '登录失败');
    showLogin();
  }
}

async function loadList() {
  try {
    const data = await api('list', {
      page: state.page,
      pageSize: state.pageSize,
      filter: state.filter
    });

    state.list = data.list || [];
    renderStats(data.total || state.list.length);
    renderTable();
    renderPagination(data.total || state.list.length, state.page, state.pageSize);
  } catch (err) {
    alert(err.message || '加载工单失败');
  }
}

function renderStats(total) {
  const pending = state.list.filter(item => item.status === '待处理').length;
  const processing = state.list.filter(item => item.status === '处理中').length;
  const completed = state.list.filter(item => item.status === '已完成').length;

  stats.innerHTML = `
    <div class="stat"><span>总数</span><strong>${total}</strong></div>
    <div class="stat"><span>待处理</span><strong>${pending}</strong></div>
    <div class="stat"><span>处理中</span><strong>${processing}</strong></div>
    <div class="stat"><span>已完成</span><strong>${completed}</strong></div>
  `;
}

function renderTable() {
  if (!state.list.length) {
    tableBody.innerHTML = '<tr><td colspan="6">暂无工单</td></tr>';
    return;
  }

  tableBody.innerHTML = state.list.map(item => `
    <tr>
      <td>
        <div class="title">${escapeHtml(item.title || '未命名工单')}</div>
        <small>${item._id || item.id || ''}</small>
      </td>
      <td><span class="badge ${statusClass(item.status)}">${item.status || '待处理'}</span></td>
      <td>${escapeHtml(item.category || '一般维修')}</td>
      <td>${escapeHtml(item.location || '未填写')}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td>
        <button class="small" data-id="${item._id || item.id}" data-action="assign">指派</button>
        <button class="small" data-id="${item._id || item.id}" data-action="status">更新状态</button>
      </td>
    </tr>
  `).join('');

  tableBody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'assign') {
        const assignee = prompt('请输入被指派人 openId：');
        if (!assignee) return;
        await api('assign', { id, assigneeOpenId: assignee });
        await loadList();
      }
      if (action === 'status') {
        const status = prompt('请输入新状态（待处理 / 处理中 / 已完成 / 已取消）:', '处理中');
        if (!status) return;
        await api('update', { id, payload: { status } });
        await loadList();
      }
    };
  });
}

function renderPagination(total, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    pages.push(`<button class="page ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`);
  }
  pagination.innerHTML = pages.join('');
  pagination.querySelectorAll('.page').forEach(btn => {
    btn.onclick = () => {
      state.page = Number(btn.dataset.page);
      loadList();
    };
  });
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN');
}

function statusClass(status) {
  switch (status) {
    case '待处理': return 'pending';
    case '处理中': return 'processing';
    case '已完成': return 'done';
    case '已取消': return 'cancel';
    default: return 'pending';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) return alert('请输入 token');
  login(token);
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  state.token = '';
  showLogin();
});

document.getElementById('searchBtn').addEventListener('click', () => {
  state.page = 1;
  state.filter.status = statusFilter.value;
  state.filter.keyword = keywordInput.value.trim();
  loadList();
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const data = await api('export', { page: state.page, pageSize: 500, filter: state.filter });
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'maintenance-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message || '导出失败');
  }
});

if (state.token) {
  showDashboard();
  loadList();
} else {
  showLogin();
}
