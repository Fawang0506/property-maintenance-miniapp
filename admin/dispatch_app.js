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

// report rendering reuse
