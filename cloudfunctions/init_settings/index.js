// 初始化 settings/global 的辅助脚本（供手动运行）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function init() {
  const doc = {
    admins: [],
    adminTokens: ['CHANGE_ME_ADMIN_TOKEN'],
    dispatch: {
      acceptTimeoutHours: 1,
      weights: {
        load: 10,
        priorityHigh: 0,
        priorityMed: 5,
        priorityLow: 10,
        skillMismatch: 20,
        areaMismatch: 5
      }
    }
  };

  try {
    const r = await db.collection('settings').doc('global').set({ data: doc });
    console.log('settings/global initialized', r);
  } catch (e) {
    console.error('init settings error', e);
  }
}

init();
