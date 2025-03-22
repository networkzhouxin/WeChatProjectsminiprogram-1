// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
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
  
  // 默认值处理
  const albumTitle = tag || '默认相册'
  
  try {
    // 检查图片是否已存在
    const existingPhoto = await db.collection('photos')
      .where({
        fileID: fileID
      })
      .get();
      
    if (existingPhoto && existingPhoto.data && existingPhoto.data.length > 0) {
      console.log('照片已存在，fileID:', fileID);
      const photo = existingPhoto.data[0];
      return {
        success: true,
        _id: photo._id,
        existing: true,
        photo: photo,
        openid: wxContext.OPENID
      };
    }
    
    // 保存照片信息到数据库
    const result = await db.collection('photos').add({
      data: {
        fileID,
        tag: albumTitle,
        albumId: albumId || null,
        desc: desc || '',
        createTime: db.serverDate(),
        openid: wxContext.OPENID
      }
    })
    
    console.log('照片保存成功:', result)
    
    // 更新相册照片数量
    if (albumId && /^[a-f\d]{24}$/i.test(albumId)) {
      try {
        // 获取相册信息
        const albumRes = await db.collection('albums').doc(albumId).get();
        const album = albumRes.data;
        
        // 更新字段
        const updateData = {
          photoCount: _.inc(1),
          updateTime: db.serverDate()
        };
        
        // 如果相册没有封面，使用当前照片作为封面
        if (!album.coverImage || album.coverImage.trim() === '') {
          updateData.coverImage = fileID;
          console.log('为相册设置封面:', fileID);
        }
        
        // 更新相册
        await db.collection('albums').doc(albumId).update({
          data: updateData
        });
        
        console.log('更新相册成功:', albumId);
      } catch (albumError) {
        console.error('更新相册失败:', albumError)
        // 不因为更新相册失败而影响整个函数的返回结果
      }
    } else if (albumTitle && albumTitle !== '默认相册') {
      // 如果没有相册ID但有标签名，检查是否存在同名相册
      try {
        const albumRes = await db.collection('albums')
          .where({
            title: albumTitle
          })
          .get();
          
        if (albumRes.data.length === 0) {
          // 不存在同名相册，创建一个
          const newAlbum = await db.collection('albums').add({
            data: {
              title: albumTitle,
              photoCount: 1,
              coverImage: fileID,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
          
          console.log('创建新相册成功:', newAlbum._id);
          
          // 更新照片的albumId字段
          await db.collection('photos').doc(result._id).update({
            data: {
              albumId: newAlbum._id
            }
          });
        } else {
          // 存在相册，更新照片数量
          const existingAlbum = albumRes.data[0];
          await db.collection('albums').doc(existingAlbum._id).update({
            data: {
              photoCount: _.inc(1),
              updateTime: db.serverDate(),
              coverImage: existingAlbum.coverImage || fileID
            }
          });
          
          // 更新照片的albumId字段
          await db.collection('photos').doc(result._id).update({
            data: {
              albumId: existingAlbum._id
            }
          });
          
          console.log('更新已存在相册:', existingAlbum._id);
        }
      } catch (error) {
        console.error('处理相册信息失败:', error);
      }
    }
    
    return {
      success: true,
      _id: result._id,
      openid: wxContext.OPENID
    }
  } catch (error) {
    console.error('添加照片失败：', error)
    return {
      success: false,
      error: error.message || error
    }
  }
} 