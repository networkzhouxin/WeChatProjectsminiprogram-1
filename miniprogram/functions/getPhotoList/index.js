// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

// 云函数入口函数
// 根据参数获取照片列表，支持按albumId过滤
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取查询参数
  const { albumId } = event
  
  try {
    // 构建查询条件
    const queryCondition = {
      _openid: openid
    }
    
    // 如果提供了albumId，则进行过滤
    if (albumId) {
      queryCondition.albumId = albumId
    }
    
    // 获取照片总数
    const countRes = await db.collection('photos')
      .where(queryCondition)
      .count()
    
    const total = countRes.total
    
    // 如果没有照片，直接返回空数组
    if (total === 0) {
      return {
        success: true,
        photoList: []
      }
    }
    
    // 分批获取所有照片
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('photos')
        .where(queryCondition)
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .orderBy('uploadTime', 'desc')
        .get()
      
      tasks.push(promise)
    }
    
    // 等待所有查询完成
    const results = await Promise.all(tasks)
    
    // 合并查询结果
    let photos = []
    results.forEach((result) => {
      photos = photos.concat(result.data)
    })
    
    // 获取照片的临时访问链接
    const fileList = photos.map(photo => photo.fileID)
    
    // 获取临时文件URL
    const fileRes = await cloud.getTempFileURL({
      fileList
    })
    
    // 将临时链接信息添加到照片对象中
    const photoList = photos.map((photo, index) => {
      return {
        id: photo._id,
        fileID: photo.fileID,
        albumId: photo.albumId,
        desc: photo.desc || '',
        uploadTime: photo.uploadTime,
        tempFileURL: fileRes.fileList[index].tempFileURL
      }
    })
    
    return {
      success: true,
      photoList
    }
  } catch (err) {
    console.error('获取照片列表失败:', err)
    return {
      success: false,
      error: '获取照片列表失败'
    }
  }
} 