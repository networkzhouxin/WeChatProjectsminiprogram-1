// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { fileID, tag, desc, albumId } = event;
  
  try {
    // 添加照片记录到数据库
    const result = await db.collection('photos').add({
      data: {
        fileID: fileID,
        createTime: db.serverDate(),
        tag: tag || '', // 不再使用默认的"未分类"
        desc: desc || '',
        albumId: albumId || '' // 添加相册ID字段
      }
    });
    
    // 如果有相册ID，更新相册中的照片计数
    if (albumId) {
      try {
        // 查询相册信息
        const albumRef = db.collection('albums').doc(albumId);
        const album = await albumRef.get();
        
        // 更新相册照片计数
        if (album && album.data) {
          const currentCount = album.data.count || 0;
          await albumRef.update({
            data: {
              count: currentCount + 1,
              updateTime: db.serverDate(),
              // 如果是相册的第一张照片，将其设置为封面
              preview: album.data.preview ? album.data.preview : fileID
            }
          });
        }
      } catch (albumErr) {
        console.error('更新相册信息失败:', albumErr);
      }
    }
    
    return {
      success: true,
      fileID: fileID
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err.message
    };
  }
} 