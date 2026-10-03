const app = getApp();

function callCloud(action, payload = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'maintenance',
      data: { action, ...payload }
    })
      .then((res) => {
        const result = res && res.result;
        if (result && result.code && result.code !== 0) {
          reject(result);
          return;
        }

        resolve(result && result.data !== undefined ? result.data : result);
      })
      .catch((err) => {
        console.error('cloud call failed:', err);
        reject(err);
      });
  });
}

function listMaintenance() {
  return callCloud('list');
}

function getMaintenance(id) {
  return callCloud('get', { id });
}

function createMaintenance(payload) {
  return callCloud('create', { payload });
}

function updateMaintenance(id, payload) {
  return callCloud('update', { id, payload });
}

module.exports = {
  callCloud,
  listMaintenance,
  getMaintenance,
  createMaintenance,
  updateMaintenance
};
