const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const {
    action,
    openId,
    templateId,
    page,
    data = {},
    title,
    status,
    location,
    contact
  } = event;

  try {
    switch (action) {
      case 'sendStatusNotice': {
        if (!openId || !templateId) {
          return { code: 1, message: '缺少 openId 或 templateId' };
        }

        const payload = {
          thing1: { value: title || '物业报修通知' },
          thing2: { value: status || '状态已更新' },
          thing3: { value: location || '请查看详情' },
          thing4: { value: contact || '物业客服' }
        };

        const result = await cloud.openapi.subscribeMessage.send({
          touser: openId,
          templateId,
          page: page || 'pages/index/index',
          data: { ...payload, ...data },
          miniprogramState: 'formal'
        });

        return { code: 0, data: result };
      }

      default:
        return { code: 1, message: '未知通知动作' };
    }
  } catch (err) {
    console.error('notify cloud function error:', err);
    return {
      code: 1,
      message: err && err.message ? err.message : '订阅消息发送失败'
    };
  }
};
