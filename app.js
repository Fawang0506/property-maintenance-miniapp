App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请先开启微信云开发能力');
      return;
    }

    // 设置云开发环境（你需要在微信开发者工具中绑定真实环境）
    wx.cloud.init({
      env: 'your-cloud-env-id' // 例如：property-maintenance-abc123
    });

    // 可在此处判断登录状态和是否管理员
    // this.globalData.userInfo = ...
    // this.globalData.isAdmin = ...
  },
  globalData: {
    userInfo: null,
    isAdmin: false,
    cloudEnv: 'your-cloud-env-id'
  }
});
