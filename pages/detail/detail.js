const request = require('../../utils/request');

Page({
  data: {
    id: null,
    item: {},
    statusIndex: 0,
    isAdmin: false,
    statusOptions: ['待处理', '处理中', '已完成', '已取消']
  },

  onLoad(options) {
    const id = options.id;
    this.setData({ id });
    this.fetchDetail(id);
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });

    request.getMaintenance(id)
      .then((res) => {
        const status = res && res.status ? res.status : '待处理';
        this.setData({
          item: res || {},
          statusIndex: this.data.statusOptions.indexOf(status)
        });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '加载详情失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  onStatusChange(e) {
    this.setData({ statusIndex: e.detail.value });
  },

  saveStatus() {
    const status = this.data.statusOptions[this.data.statusIndex];
    wx.showLoading({ title: '保存中...' });

    request.updateMaintenance(this.data.id, { status })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '状态已更新', icon: 'success' });
        this.fetchDetail(this.data.id);
      })
      .catch((err) => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
  }
});
