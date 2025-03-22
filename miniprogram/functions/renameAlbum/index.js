// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取请求参数
  const { albumId, newName } = event
  
  // 参数校验
  if (!albumId || !newName) {
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
    
    // 检查是否有权限修改该相册
    if (albumRes.data._openid !== openid) {
      return {
        success: false,
        error: '无权限修改该相册'
      }
    }
    
    // 检查新名称是否已存在
    const existingAlbum = await db.collection('albums')
      .where({
        _openid: openid,
        name: newName,
        _id: _.neq(albumId)
      })
      .get()
    
    if (existingAlbum.data && existingAlbum.data.length > 0) {
      return {
        success: false,
        error: '相册名称已存在'
      }
    }
    
    // 更新相册名称
    await db.collection('albums')
      .doc(albumId)
      .update({
        data: {
          name: newName,
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true
    }
  } catch (err) {
    console.error('重命名相册失败:', err)
    return {
      success: false,
      error: '重命名相册失败'
    }
  }
} 