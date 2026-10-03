const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { action = 'sendStatusNotice', openId, templateId, page, formId, data = {} } = event;

  try {
    switch (action) {
      case 'sendStatusNotice': {
        if (!openId || !templateId) {
          return { code: 1, message: '缺少 openId 或 templateId' };
        }

        const result = await cloud.openapi.subscribeMessage.send({
          touser: openId,
          templateId,
          page,
          data,
          miniprogramState: 'formal'
        });

        return { code: 0, data: result };
      }

      default:
        return { code: 1, message: '未知 notify action' };
    }
  } catch (err) {
    console.error('notify cloud function error:', err);
    return { code: 1, message: err && err.message ? err.message : '通知发送失败' };
  }
};
