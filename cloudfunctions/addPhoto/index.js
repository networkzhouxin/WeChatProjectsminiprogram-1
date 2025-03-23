// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { fileID, tag, albumId, desc } = event
  
  console.log('接收到的参数:', { fileID, tag, albumId, desc })
  
  // 参数校验
  if (!fileID || typeof fileID !== 'string' || fileID.trim() === '') {
    console.error('无效的fileID:', fileID)
    return {
      success: false,
      error: 'Invalid fileID'
    }
  }
  
  try {
    // 检查图片是否已存在
    const existingPhoto = await db.collection('photos')
      .where({
        fileID: fileID
      })
      .get()
      
    if (existingPhoto && existingPhoto.data && existingPhoto.data.length > 0) {
      console.log('照片已存在，fileID:', fileID)
      const photo = existingPhoto.data[0]
      return {
        success: true,
        _id: photo._id,
        existing: true,
        photo: photo
      }
    }
    
    // 保存照片信息到数据库
    const result = await db.collection('photos').add({
      data: {
        fileID,
        tag: tag || '',
        albumId: albumId || '',
        desc: desc || '',
        createTime: db.serverDate(),
        openid: wxContext.OPENID
      }
    })
    
    console.log('照片保存成功:', result)
    
    // 更新相册信息
    if (tag) {
      try {
        // 查找是否存在同名相册
        const albumRes = await db.collection('albums')
          .where({
            title: tag
          })
          .get()
        
        if (albumRes.data.length === 0) {
          // 不存在同名相册，创建新相册
          const newAlbum = await db.collection('albums').add({
            data: {
              title: tag,
              photoCount: 1,
              coverImage: fileID,
              createTime: db.serverDate(),
              updateTime: db.serverDate(),
              openid: wxContext.OPENID
            }
          })
          
          console.log('创建新相册成功:', newAlbum._id)
          
          // 更新照片的albumId
          await db.collection('photos').doc(result._id).update({
            data: {
              albumId: newAlbum._id
            }
          })
        } else {
          // 存在相册，更新相册信息
          const existingAlbum = albumRes.data[0]
          await db.collection('albums').doc(existingAlbum._id).update({
            data: {
              photoCount: _.inc(1),
              updateTime: db.serverDate(),
              coverImage: existingAlbum.coverImage || fileID
            }
          })
          
          // 更新照片的albumId
          await db.collection('photos').doc(result._id).update({
            data: {
              albumId: existingAlbum._id
            }
          })
          
          console.log('更新已存在相册:', existingAlbum._id)
        }
      } catch (error) {
        console.error('处理相册信息失败:', error)
      }
    }
    
    return {
      success: true,
      _id: result._id
    }
  } catch (err) {
    console.error('添加照片失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
} 