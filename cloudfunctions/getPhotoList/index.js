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
  
  // 构建查询条件
  const condition = {}
  if (tag) {
    condition.tag = tag
  }
  
  // 计算集合总数
  const countResult = await db.collection('photos')
    .where(condition)
    .count()
  const total = countResult.total
  
  // 计算需要分几次取
  const batchTimes = Math.ceil(total / MAX_LIMIT)
  
  // 承载所有读操作的 promise 的数组
  const tasks = []
  
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection('photos')
      .where(condition)
      .skip(i * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .orderBy('uploadTime', 'desc')
      .get()
      
    tasks.push(promise)
  }
  
  // 等待所有数据取完
  const photoList = (await Promise.all(tasks)).reduce((acc, cur) => ({
    data: acc.data.concat(cur.data),
    errMsg: cur.errMsg
  }), { data: [], errMsg: '' })
  
  // 如果有照片数据，则获取临时访问链接
  if (photoList.data && photoList.data.length > 0) {
    // 提取所有fileID
    const fileIDs = photoList.data.map(photo => photo.fileID)
    
    // 获取临时链接
    const tempFileResult = await cloud.getTempFileURL({
      fileList: fileIDs
    })
    
    // 构建fileID到fileURL的映射
    const fileURLMap = {}
    tempFileResult.fileList.forEach(item => {
      fileURLMap[item.fileID] = item.tempFileURL
    })
    
    // 为每个照片添加临时访问链接
    photoList.data.forEach(photo => {
      photo.tempFileURL = fileURLMap[photo.fileID] || ''
    })
  }
  
  return {
    success: true,
    photoList: photoList.data,
    openid: wxContext.OPENID
  }
} 