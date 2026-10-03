const request = require('../../utils/request');
const uploadUtil = require('../../utils/upload');

Page({
  data: {
    list: [],
    uploading: false
  },

  onLoad() {
    this.fetchAssignedTasks();
  },

  onShow() {
    this.fetchAssignedTasks();
  },

  fetchAssignedTasks() {
    wx.showLoading({ title: '加载中...' });
    request.callCloud('listAssigned')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res && res) || [];
        this.setData({ list });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '加载任务失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  },

  async acceptTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '接单中...' });
    try {
      await request.callCloud('acceptTask', { id });
      wx.showToast({ title: '已接单' });
      this.fetchAssignedTasks();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '接单失败', icon: 'none' });
    } finally { wx.hideLoading(); }
  },

  async rejectTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '拒单中...' });
    try {
      await request.callCloud('rejectTask', { id });
      wx.showToast({ title: '已拒绝' });
      this.fetchAssignedTasks();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '拒单失败', icon: 'none' });
    } finally { wx.hideLoading(); }
  },

  async completeTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '完成中...' });
    try {
      await request.callCloud('completeTask', { id });
      wx.showToast({ title: '已完成' });
      this.fetchAssignedTasks();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally { wx.hideLoading(); }
  },

  async checkIn(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '签到中...' });
    try {
      // get location
      const loc = await new Promise((resolve, reject) => {
        wx.getLocation({ type: 'wgs84', success: res => resolve(res), fail: err => resolve(null) });
      });
      const payload = { latitude: loc ? loc.latitude : null, longitude: loc ? loc.longitude : null };
      await request.callCloud('checkin', { id, payload });
      wx.showToast({ title: '签到成功' });
      this.fetchAssignedTasks();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '签到失败', icon: 'none' });
    } finally { wx.hideLoading(); }
  },

  async addRecordWithPhotos(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.chooseImage({ count: 6, success: async (res) => {
      const paths = res.tempFilePaths || [];
      if (!paths.length) return;
      wx.showLoading({ title: '上传图片...' });
      try {
        that.setData({ uploading: true });
        const fileIDs = [];
        for (const p of paths) {
          const fid = await uploadUtil.uploadImage(p);
          fileIDs.push(fid);
        }
        await request.callCloud('addRecord', { id, payload: { text: '现场图片上传', images: fileIDs } });
        wx.showToast({ title: '上传成功' });
        that.fetchAssignedTasks();
      } catch (err) {
        console.error(err);
        wx.showToast({ title: err.message || '上传失败', icon: 'none' });
      } finally {
        that.setData({ uploading: false });
        wx.hideLoading();
      }
    } });
  }
});
