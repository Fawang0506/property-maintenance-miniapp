const app = getApp();

function request(path, method = 'GET', data = {}) {
  const baseUrl = app && app.globalData && app.globalData.baseUrl;
  const mockEnabled = app && app.globalData && app.globalData.mockEnabled;

  if (mockEnabled) {
    const fakeApi = require('./fakeApi');
    return fakeApi.dispatch(path, method, data);
  }

  const url = `${baseUrl}${path}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

function listMaintenance() {
  return request('/maintenance', 'GET');
}

function getMaintenance(id) {
  return request(`/maintenance/${id}`, 'GET');
}

function createMaintenance(payload) {
  return request('/maintenance', 'POST', payload);
}

function updateMaintenance(id, payload) {
  return request(`/maintenance/${id}`, 'PUT', payload);
}

module.exports = {
  request,
  listMaintenance,
  getMaintenance,
  createMaintenance,
  updateMaintenance
};
