// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { tag } = event
  
  console.log('接收到getPhotoList请求，参数:', event);
  
  // 构建查询条件
  const condition = {}
  if (tag) {
    condition.tag = tag
    console.log('按相册标签查询:', tag);
  } else {
    console.log('未指定标签，查询所有照片');
  }
  
  // 打印查询条件对象
  console.log('数据库查询条件:', JSON.stringify(condition));
  
  try {
    // 先检查albums集合中是否存在该相册
    if (tag) {
      console.log('检查albums集合中是否存在相册:', tag);
      const albumQueryResult = await db.collection('albums').where({
        title: tag
      }).get();
      
      console.log('albums集合查询结果:', JSON.stringify(albumQueryResult.data));
    }
    
    // 计算集合总数
    const countResult = await db.collection('photos')
      .where(condition)
      .count()
    const total = countResult.total
    
    console.log('照片总数:', total);
    
    // 如果没有数据，直接返回空结果
    if (total === 0) {
      console.log('没有找到符合条件的照片');
      return {
        success: true,
        photoList: [],
        openid: wxContext.OPENID,
        total: 0
      }
    }
    
    // 计算需要分几次取
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    console.log('需要分', batchTimes, '次获取数据');
    
    // 承载所有读操作的 promise 的数组
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('photos')
        .where(condition)
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .orderBy('createTime', 'desc')
        .get()
        
      tasks.push(promise)
    }
    
    // 等待所有数据取完
    const photoList = (await Promise.all(tasks)).reduce((acc, cur) => ({
      data: acc.data.concat(cur.data),
      errMsg: cur.errMsg
    }), { data: [], errMsg: '' })
    
    console.log('成功获取照片数据，数量:', photoList.data.length);
    
    // 如果有照片数据，则获取临时访问链接
    if (photoList.data && photoList.data.length > 0) {
      try {
        // 提取所有fileID
        const fileIDs = photoList.data.map(photo => photo.fileID).filter(id => id && id.trim() !== '')
        
        console.log('准备获取临时链接，有效文件数量:', fileIDs.length, '，总文件数:', photoList.data.length);
        
        if (fileIDs.length > 0) {
          // 获取临时链接
          const tempFileResult = await cloud.getTempFileURL({
            fileList: fileIDs
          })
          
          console.log('获取临时链接成功，结果数量:', tempFileResult.fileList.length);
          
          // 构建fileID到fileURL的映射
          const fileURLMap = {}
          tempFileResult.fileList.forEach(item => {
            fileURLMap[item.fileID] = item.tempFileURL
          })
          
          // 为每个照片添加临时访问链接和ID字段
          photoList.data.forEach(photo => {
            // 确保照片有id字段，如果没有则使用_id
            if (!photo.id && photo._id) {
              photo.id = photo._id
            }
            
            if (photo.fileID && photo.fileID.trim() !== '') {
              photo.tempFileURL = fileURLMap[photo.fileID] || photo.fileID
              // 简化日志输出，避免过长
              console.log('照片ID:', photo.id || photo._id, '已设置临时链接');
            } else {
              photo.tempFileURL = ''
              console.log('照片ID:', photo.id || photo._id, '无有效fileID');
            }
          })
        } else {
          console.log('没有有效的fileID，跳过获取临时链接')
          
          // 确保每个照片都有id字段
          photoList.data.forEach(photo => {
            if (!photo.id && photo._id) {
              photo.id = photo._id
            }
            photo.tempFileURL = photo.fileID || ''
          })
        }
      } catch (error) {
        console.error('获取临时链接失败:', error)
        
        // 发生错误时，将fileID作为临时URL
        photoList.data.forEach(photo => {
          // 确保照片有id字段
          if (!photo.id && photo._id) {
            photo.id = photo._id
          }
          photo.tempFileURL = photo.fileID || ''
        })
      }
    }
    
    const result = {
      success: true,
      photoList: photoList.data,
      openid: wxContext.OPENID,
      total: photoList.data.length
    }
    
    console.log('getPhotoList返回结果 - 照片数量:', result.total);
    
    return result
  } catch (error) {
    console.error('getPhotoList执行失败:', error);
    return {
      success: false,
      error: error.message,
      openid: wxContext.OPENID
    }
  }
} 