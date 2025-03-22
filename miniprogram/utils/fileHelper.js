// 文件处理工具函数

/**
 * 获取文件临时访问链接
 * @param {string} fileID 云存储文件ID
 * @returns {Promise<string>} 临时访问链接
 */
function getTempFileURL(fileID) {
  return new Promise((resolve, reject) => {
    if (!fileID || typeof fileID !== 'string' || fileID.trim() === '') {
      console.error('无效的fileID:', fileID);
      reject(new Error('无效的fileID'));
      return;
    }
    
    console.log('请求临时文件链接:', fileID);
    
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: res => {
        console.log('临时文件链接结果:', res);
        if (res.fileList && res.fileList.length > 0) {
          const tempURL = res.fileList[0].tempFileURL;
          console.log('获取临时链接成功:', tempURL);
          resolve(tempURL);
        } else {
          console.error('获取临时链接失败: 空结果');
          reject(new Error('获取临时链接失败: 空结果'));
        }
      },
      fail: err => {
        console.error('获取临时链接失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 批量获取文件的临时访问链接
 * @param {Array<string>} fileIDs 云存储文件ID数组
 * @returns {Promise<Object>} 文件ID到临时链接的映射对象
 */
function batchGetTempFileURL(fileIDs) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(fileIDs) || fileIDs.length === 0) {
      console.error('无效的fileIDs参数:', fileIDs);
      reject(new Error('无效的fileIDs参数'));
      return;
    }
    
    // 过滤掉无效的fileID
    const validFileIDs = fileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '');
    
    if (validFileIDs.length === 0) {
      console.error('没有有效的fileID');
      reject(new Error('没有有效的fileID'));
      return;
    }
    
    console.log('批量请求临时文件链接, 数量:', validFileIDs.length);
    
    wx.cloud.getTempFileURL({
      fileList: validFileIDs,
      success: res => {
        if (res.fileList && res.fileList.length > 0) {
          // 构建fileID到URL的映射
          const urlMap = {};
          res.fileList.forEach(item => {
            urlMap[item.fileID] = item.tempFileURL;
          });
          
          console.log('批量获取临时链接成功, 数量:', res.fileList.length);
          resolve(urlMap);
        } else {
          console.error('批量获取临时链接失败: 空结果');
          reject(new Error('批量获取临时链接失败: 空结果'));
        }
      },
      fail: err => {
        console.error('批量获取临时链接失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 验证并修复照片对象的临时链接
 * @param {Object} photo 照片对象
 * @returns {Object} 修复后的照片对象
 */
function ensurePhotoTempURL(photo) {
  // 先进行深拷贝，避免修改原对象
  const fixedPhoto = JSON.parse(JSON.stringify(photo));
  
  // 确保id字段存在
  if (!fixedPhoto.id && fixedPhoto._id) {
    fixedPhoto.id = fixedPhoto._id;
  }
  
  // 处理tempFileURL
  if (!fixedPhoto.tempFileURL || fixedPhoto.tempFileURL.trim() === '') {
    fixedPhoto.tempFileURL = fixedPhoto.fileID || '';
  }
  
  return fixedPhoto;
}

module.exports = {
  getTempFileURL,
  batchGetTempFileURL,
  ensurePhotoTempURL
}; 