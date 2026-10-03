const request = require('../../utils/request');

Page({
  data: {
    title: '',
    category: '一般维修',
    location: '',
    contact: '',
    description: '',
    categories: ['一般维修', '水电维修', '门窗维修', '消防', '清洁保洁', '其他']
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ category: this.data.categories[e.detail.value] });
  },

  onLocationInput(e) {
    this.setData({ location: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  submit() {
    const { title, category, location, contact, description } = this.data;

    if (!title) {
      wx.showToast({ title: '请输入报修标题', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    request.createMaintenance({
      title,
      category,
      location,
      contact,
      description,
      status: '待处理'
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '报修提交成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 800);
      })
      .catch((err) => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        });
      });
  }
});
