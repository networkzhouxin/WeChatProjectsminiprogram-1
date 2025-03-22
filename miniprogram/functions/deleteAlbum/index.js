// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取请求参数
  const { albumId } = event
  
  // 参数校验
  if (!albumId) {
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
    
    // 检查是否有权限删除该相册
    if (albumRes.data._openid !== openid) {
      return {
        success: false,
        error: '无权限删除该相册'
      }
    }
    
    // 获取相册中所有照片
    const photosList = await getAllPhotos(openid, albumId)
    
    // 删除照片文件和记录
    if (photosList.length > 0) {
      // 1. 删除云存储中的文件
      const fileIDs = photosList.map(photo => photo.fileID).filter(id => id)
      if (fileIDs.length > 0) {
        try {
          await cloud.deleteFile({
            fileList: fileIDs
          })
        } catch (err) {
          console.error('删除云存储文件失败:', err)
          // 继续执行删除相册操作
        }
      }
      
      // 2. 删除照片记录
      await db.collection('photos')
        .where({
          _openid: openid,
          albumId: albumId
        })
        .remove()
    }
    
    // 3. 删除相册
    await db.collection('albums')
      .doc(albumId)
      .remove()
    
    return {
      success: true
    }
  } catch (err) {
    console.error('删除相册失败:', err)
    return {
      success: false,
      error: '删除相册失败'
    }
  }
}

// 获取指定相册中的所有照片
async function getAllPhotos(openid, albumId) {
  const photosList = []
  
  // 获取照片总数
  const countRes = await db.collection('photos')
    .where({
      _openid: openid,
      albumId: albumId
    })
    .count()
  
  const total = countRes.total
  
  // 分批获取所有照片
  const batchTimes = Math.ceil(total / MAX_LIMIT)
  const batchPromises = []
  
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection('photos')
      .where({
        _openid: openid,
        albumId: albumId
      })
      .skip(i * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .get()
    
    batchPromises.push(promise)
  }
  
  // 等待所有查询完成
  const batchResults = await Promise.all(batchPromises)
  
  // 合并查询结果
  batchResults.forEach(result => {
    photosList.push(...result.data)
  })
  
  return photosList
} 