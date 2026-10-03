// utils/upload.js
// 封装图片上传到微信云存储，返回 fileID

function uploadImage(tempFilePath) {
  return new Promise((resolve, reject) => {
    const suffix = tempFilePath.match(/\.(jpg|png|jpeg)$/i);
    const ext = suffix ? suffix[0] : '.jpg';
    const cloudPath = `maintenance/${Date.now()}-${Math.floor(Math.random()*10000)}${ext}`;

    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success(res) {
        resolve(res.fileID);
      },
      fail(err) {
        console.error('upload failed', err);
        reject(err);
      }
    });
  });
}

module.exports = { uploadImage };
