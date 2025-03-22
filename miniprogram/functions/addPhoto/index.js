// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取请求参数
  const { fileID, albumId, desc } = event
  
  // 参数校验
  if (!fileID || !albumId) {
    return {
      success: false,
      error: '参数不完整'
    }
  }
  
  try {
    // 查询相册是否存在
    const albumRes = await db.collection('albums')
      .doc(albumId)
      .get()
    
    if (!albumRes.data) {
      return {
        success: false,
        error: '相册不存在'
      }
    }
    
    // 检查是否有权限上传到该相册
    if (albumRes.data._openid !== openid) {
      return {
        success: false,
        error: '无权限上传到该相册'
      }
    }
    
    // 保存照片记录
    const result = await db.collection('photos').add({
      data: {
        _openid: openid,
        fileID: fileID,
        albumId: albumId,
        desc: desc || '',
        uploadTime: db.serverDate()
      }
    })
    
    // 更新相册的最后更新时间
    await db.collection('albums')
      .doc(albumId)
      .update({
        data: {
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      photoId: result._id
    }
  } catch (err) {
    console.error('添加照片失败:', err)
    return {
      success: false,
      error: '添加照片失败'
    }
  }
} 