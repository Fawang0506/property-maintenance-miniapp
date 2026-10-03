const request = require('../../utils/request');
const uploadUtil = require('../../utils/upload');

Page({
  data: {
    title: '',
    category: '一般维修',
    location: '',
    contact: '',
    description: '',
    categories: ['一般维修', '水电维修', '门窗维修', '消防', '清洁保洁', '其他'],
    images: [] // 本地临时路径数组
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onCategoryChange(e) { this.setData({ category: this.data.categories[e.detail.value] }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  onContactInput(e) { this.setData({ contact: e.detail.value }); },
  onDescriptionInput(e) { this.setData({ description: e.detail.value }); },

  chooseImage() {
    const that = this;
    wx.chooseImage({
      count: 6 - this.data.images.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const selected = res.tempFilePaths || [];
        that.setData({ images: that.data.images.concat(selected) });
      }
    });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = this.data.images.slice();
    images.splice(idx, 1);
    this.setData({ images });
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index;
    wx.previewImage({ urls: this.data.images, current: this.data.images[idx] });
  },

  async submit() {
    const { title, category, location, contact, description, images } = this.data;
    if (!title) { wx.showToast({ title: '请输入报修标题', icon: 'none' }); return; }

    wx.showLoading({ title: '提交中...' });

    try {
      // 先上传图片到云存储，得到 fileIDs
      const fileIDs = [];
      for (let i = 0; i < images.length; i++) {
        // uploadFile 返回 fileID
        // uploadUtil.uploadImage 支持 wx.cloud.uploadFile
        const fid = await uploadUtil.uploadImage(images[i]);
        fileIDs.push(fid);
      }

      await request.createMaintenance({
        title, category, location, contact, description, images: fileIDs, status: '待处理'
      });

      wx.hideLoading();
      wx.showToast({ title: '报修提交成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
