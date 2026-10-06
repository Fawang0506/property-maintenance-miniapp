# 数据库初始化示例脚本（可在云函数或云控制台运行）

// 注意：在云函数中使用 db.collection('settings').add 或 .set

const initial = async (db) => {
  await db.collection('settings').add({ data: { _id: 'global', admins: [], adminTokens: ['replace-me-with-strong-token'] } });
  // 示例工程师
  await db.collection('engineers').add({ data: { openId: 'eng_openid_1', name: '张师傅', phone: '13900000001', areas: ['1栋','2栋'] } });
};

module.exports = initial;
