const request = require('../utils/request');

Page({
  data: {
    list: [],
    loading: false
  },

  onLoad() {
    this.fetchList();
  },

  onShow() {
    this.fetchList();
  },

  fetchList() {
    this.setData({ loading: true });

    request.listMaintenance()
      .then((res) => {
        this.setData({ list: Array.isArray(res) ? res : [] });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({
          title: '获取报修列表失败',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
