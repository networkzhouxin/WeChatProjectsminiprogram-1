// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { fileID, tag, desc } = event

  try {
    // 将照片信息保存到photos集合
    const result = await db.collection('photos').add({
      data: {
        _openid: wxContext.OPENID, // 添加用户openid
        fileID: fileID,
        createTime: db.serverDate(),
        tag: tag || '', // 不再使用默认的"未分类"
        desc: desc || ''
      }
    })

    return {
      success: true,
      fileID: fileID,
      _id: result._id
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err.message
    }
  }
} 