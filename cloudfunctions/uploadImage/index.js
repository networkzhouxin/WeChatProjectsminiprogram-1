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
  const { fileID, tag, desc } = event
  
  try {
    // 直接将图片信息存储到云数据库，不需要获取临时访问链接
    const dbResult = await db.collection('photos').add({
      data: {
        _openid: openid,
        fileID: fileID,  // 只保存文件ID，需要访问时再获取临时链接
        tag: tag || '未分类',
        desc: desc || '',
        uploadTime: db.serverDate(),
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      fileID: fileID,
      dbID: dbResult._id
    }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error
    }
  }
} 