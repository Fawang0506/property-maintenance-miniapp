// 统一云函数调用封装：前端所有后端交互走 maintenance 云函数
function callCloud(action, payload = {}) {
  return wx.cloud.callFunction({
    name: 'maintenance',
    data: { action, payload }
  }).then(res => res.result);
}

module.exports = {
  callCloud,
  createMaintenance: (payload) => callCloud('create', payload),
  getMaintenance: (id) => callCloud('get', { id }),
  listMaintenance: (query) => callCloud('list', query || {})
};
