const request = require('../../utils/request');

function callCloudGem(action, payload = {}) {
  return request.callCloud(action, payload);
}

module.exports = {
  callCloudGem,
  ...request
};
