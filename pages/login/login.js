const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    user: null
  },

  onLoad() {
    const user = app.globalData.userInfo || null;
    this.setData({ user });
  },

  onLogin() {
    wx.showLoading({ title: '登录中...' });
    request.callCloud('whoami')
      .then((res) => {
        // res 为 user 数据
        app.globalData.userInfo = res;
        this.setData({ user: res });
        wx.showToast({ title: '登录成功' });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '登录失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  }
});
