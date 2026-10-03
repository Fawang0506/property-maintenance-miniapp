const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    id: null,
    item: {},
    statusIndex: 0,
    isAdmin: false,
    statusOptions: ['待处理', '处理中', '已完成', '已取消'],
    records: []
  },

  onLoad(options) {
    const id = options.id;
    this.setData({ id });
    this.fetchDetail(id);

    // 通过 whoami 获取当前用户并判断是否 admin
    request.callCloud('whoami').then(user => {
      this.setData({ isAdmin: user && user.role === 'admin' });
    }).catch(()=>{});
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });
    request.getMaintenance(id)
      .then((res) => {
        this.setData({ item: res || {}, statusIndex: this.data.statusOptions.indexOf((res && res.status) || '待处理'), records: (res && res.records) || [] });
      })
      .catch((err) => {
        console.error(err);
        wx.showToast({ title: '加载详情失败', icon: 'none' });
      })
      .finally(() => wx.hideLoading());
  },

  onStatusChange(e) { this.setData({ statusIndex: e.detail.value }); },

  async saveStatus() {
    const status = this.data.statusOptions[this.data.statusIndex];
    wx.showLoading({ title: '保存中...' });
    try {
      await request.callCloud('update', { id: this.data.id, payload: { status } });
      wx.showToast({ title: '状态已更新' });
      this.fetchDetail(this.data.id);
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    } finally { wx.hideLoading(); }
  },

  // 管理员指派示例（简化）
  assignTo(e) {
    const assigneeOpenId = e.detail.value || '';
    if (!assigneeOpenId) { wx.showToast({ title: '请输入 assigneeOpenId', icon: 'none' }); return; }
    wx.showLoading({ title: '指派中...' });
    request.callCloud('assign', { id: this.data.id, assigneeOpenId })
      .then(()=>{ wx.showToast({ title:'已指派' }); this.fetchDetail(this.data.id); })
      .catch(()=>{ wx.showToast({ title:'指派失败', icon:'none' }); })
      .finally(()=>wx.hideLoading());
  }
});
