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
  const { albumName } = event
  
  // 参数校验
  if (!albumName) {
    return {
      success: false,
      error: '相册名称不能为空'
    }
  }
  
  try {
    // 检查相册名是否已存在
    const existingAlbum = await db.collection('albums')
      .where({
        _openid: openid,
        name: albumName
      })
      .get()
    
    if (existingAlbum.data && existingAlbum.data.length > 0) {
      return {
        success: false,
        error: '相册名称已存在'
      }
    }
    
    // 创建新相册
    const currentTime = db.serverDate()
    const albumResult = await db.collection('albums').add({
      data: {
        _openid: openid,
        name: albumName,
        createTime: currentTime,
        updateTime: currentTime
      }
    })
    
    if (albumResult._id) {
      return {
        success: true,
        albumId: albumResult._id
      }
    } else {
      return {
        success: false,
        error: '创建相册失败'
      }
    }
  } catch (err) {
    console.error('创建相册失败:', err)
    return {
      success: false,
      error: '创建相册失败'
    }
  }
} 