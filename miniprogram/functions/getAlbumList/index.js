// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = _.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      success: false,
      error: '用户未登录'
    }
  }
  
  try {
    // 查询用户的所有相册
    const albumsRes = await db.collection('albums')
      .where({
        _openid: openid
      })
      .orderBy('createTime', 'desc')
      .get()
    
    const albums = albumsRes.data
    
    if (!albums || albums.length === 0) {
      return {
        success: true,
        albumList: []
      }
    }
    
    // 获取相册列表并处理每个相册的照片数量和预览图
    const albumList = await Promise.all(albums.map(async (album) => {
      // 获取相册中照片数量
      const countRes = await db.collection('photos')
        .where({
          _openid: openid,
          albumId: album._id
        })
        .count()
      
      const count = countRes.total || 0
      
      // 获取相册预览图（取最新的一张照片）
      let preview = ''
      if (count > 0) {
        const photoRes = await db.collection('photos')
          .where({
            _openid: openid,
            albumId: album._id
          })
          .orderBy('uploadTime', 'desc')
          .limit(1)
          .get()
        
        if (photoRes.data && photoRes.data.length > 0) {
          const photo = photoRes.data[0]
          
          // 生成临时文件URL
          try {
            const tempFileRes = await cloud.getTempFileURL({
              fileList: [photo.fileID]
            })
            
            if (tempFileRes.fileList && tempFileRes.fileList.length > 0) {
              preview = tempFileRes.fileList[0].tempFileURL
            }
          } catch (err) {
            console.error('获取临时文件链接失败:', err)
          }
        }
      }
      
      // 返回相册信息
      return {
        id: album._id,
        title: album.name,
        count: count,
        preview: preview,
        createTime: album.createTime
      }
    }))
    
    return {
      success: true,
      albumList
    }
  } catch (err) {
    console.error('获取相册列表失败:', err)
    return {
      success: false,
      error: '获取相册列表失败'
    }
  }
} 