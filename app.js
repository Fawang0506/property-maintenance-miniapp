App({
  onLaunch() {
    // 可在这里做登录检查、初始化缓存等
  },
  globalData: {
    // 如果已有后端，把这里改成你的 API 基地址，如：https://api.example.com
    baseUrl: 'https://api.example.com',
    // 设为 true 时优先使用 mock 数据，方便本地调试；真实环境可设为 false
    mockEnabled: true
  }
});
