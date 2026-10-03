const request = require('../../utils/request');

Page({
  data: {
    list: []
  },

  onLoad() {
    this.fetchAssignedTasks();
  },

  onShow() {
    this.fetchAssignedTasks();
  },

  fetchAssignedTasks() {
    wx.showLoading({ title: '加载中...' });
    request.listAssigned()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res && res.list) || [];
        this.setData({ list });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '加载任务失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  },

  acceptTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '接单中...' });
    request.acceptTask(id)
      .then(() => {
        wx.showToast({ title: '已接单' });
        this.fetchAssignedTasks();
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '接单失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  },

  rejectTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '处理中...' });
    request.rejectTask(id)
      .then(() => {
        wx.showToast({ title: '已拒绝' });
        this.fetchAssignedTasks();
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '拒绝失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  },

  completeTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '处理完成...' });
    request.completeTask(id)
      .then(() => {
        wx.showToast({ title: '已完成' });
        this.fetchAssignedTasks();
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '操作失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  }
});
