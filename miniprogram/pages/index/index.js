// pages/index/index.js
// 移除静态相册数据
Page({
  data: {
    albumList: [], // 所有相册列表
    refreshing: false, // 下拉刷新状态
    
    // 添加新相册相关
    showAddAlbumModal: false,
    newAlbumName: '',
    isRenaming: false,
    editingAlbum: null,
    isLoading: false,
    isEmpty: false
  },

  onLoad() {
    // 检查是否已经初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true,
      });
      
      // 加载相册列表 - 首次加载使用基本的加载方法
      this.loadAlbums();
    }
  },
  
  // 页面显示时刷新数据
  onShow() {
    // 每次显示页面时都进行深度同步清理
    this.forceClearAndRefreshAlbums();
  },
  
  // 监听页面的tabItem点击事件
  onTabItemTap(item) {
    console.log('点击了相册', item);
    
    // 点击当前页面的底部标签时，刷新相册数据
    if (item.index === 0) { // 相册标签的index为0
      // 重新加载相册分类
      this.forceClearAndRefreshAlbums();
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      refreshing: true
    });
    
    this.loadAlbums()
      .then(() => {
        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('下拉刷新失败:', err);
        wx.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({
          refreshing: false
        });
        
        wx.stopPullDownRefresh();
      });
  },
  
  // 加载相册列表
  loadAlbums() {
    this.setData({
      isLoading: true,
      isEmpty: false
    });
    
    wx.showLoading({
      title: '加载相册...',
    });
    
    // 先从albums集合中加载自定义相册
    const db = wx.cloud.database();
    
    // 加载专门存储的相册信息
    db.collection('albums').get().then(albumsRes => {
      console.log('获取自定义相册成功:', albumsRes.data);
      
      // 使用Map记录相册信息，key为title
      const albumsMap = new Map();
      
      // 将已有albums数据加入Map
      albumsRes.data.forEach(album => {
        albumsMap.set(album.title, {
          id: album._id,
          title: album.title,
          count: album.photoCount || 0,
          cover: album.coverImage || '/images/default-album.png',
          isEmpty: true // 初始设为空，后续会检查是否有对应照片
        });
      });
      
      // 然后使用getPhotoList云函数获取所有照片，更新相册信息
      return wx.cloud.callFunction({
        name: 'getPhotoList',
        data: {}
      }).then(res => {
        console.log('获取照片列表成功:', res.result);
        
        if (res.result && res.result.photoList) {
          const photos = res.result.photoList;
          
          // 按标签分组照片
          photos.forEach(photo => {
            const tag = photo.tag || '';
            
            // 忽略未分类的照片
            if (tag && tag !== '未分类') {
              // 如果Map中存在该相册，更新相册信息
              if (albumsMap.has(tag)) {
                const album = albumsMap.get(tag);
                album.count++;
                album.isEmpty = false;
                
                // 如果相册没有封面，使用照片的fileID作为封面
                if (!album.cover || album.cover === '/images/default-album.png') {
                  album.cover = photo.fileID;
                }
              } 
              // 如果Map中不存在该相册，说明是通过tag创建的相册，添加到Map
              else {
                albumsMap.set(tag, {
                  id: tag, // 使用tag作为id
                  title: tag,
                  count: 1,
                  cover: photo.fileID,
                  isEmpty: false
                });
              }
            }
          });
        }
        
        // 转换为数组
        const albumList = Array.from(albumsMap.values());
        
        // 确保所有相册都有cover属性
        albumList.forEach(album => {
          if (album.isEmpty) {
            album.count = 0;
          }
          
          // 如果没有封面，使用默认封面
          if (!album.cover || album.cover === '') {
            album.cover = '/images/default-album.png';
          }
          
          // 打印相册信息，便于调试
          console.log('相册信息:', album.title, '封面:', album.cover, '数量:', album.count);
        });
        
        wx.hideLoading();
        
        this.setData({
          albumList,
          isLoading: false,
          isEmpty: albumList.length === 0
        });
      });
    }).catch(err => {
      console.error('获取相册列表失败:', err);
      
      wx.hideLoading();
      
      this.setData({
        albumList: [],
        isLoading: false,
        isEmpty: true
      });
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },
  
  // 强制清理和刷新相册列表 - 处理删除后依然显示的问题
  forceClearAndRefreshAlbums() {
    wx.showLoading({
      title: '强制刷新中...',
      mask: true
    });
    
    console.log('开始强制清理和刷新相册');
    
    const db = wx.cloud.database();
    
    // 1. 获取所有实际存在的照片标签
    wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {}
    }).then(photoRes => {
      if (!photoRes.result || !photoRes.result.photoList) {
        console.log('没有获取到照片数据');
        return Promise.resolve([]);
      }
      
      // 提取所有照片的标签
      const validTags = new Set();
      photoRes.result.photoList.forEach(photo => {
        if (photo.tag && photo.tag.trim() !== '' && photo.tag !== '未分类') {
          validTags.add(photo.tag);
        }
      });
      
      console.log('有效照片标签:', Array.from(validTags));
      
      // 2. 获取所有albums集合中的记录
      return db.collection('albums').get().then(albumsRes => {
        const albumsData = albumsRes.data || [];
        console.log('数据库中的相册:', albumsData.map(a => a.title));
        
        // 我们不再删除空相册，因为用户可能创建了相册但还没有上传照片
        // 只删除tags中不存在但在数据库中已标记为删除的相册
        const invalidAlbums = albumsData.filter(album => 
          album.isDeleted === true
        );
        
        console.log('标记为已删除的相册:', invalidAlbums.map(a => a.title));
        
        // 3. 删除那些标记为已删除的相册记录
        const deletePromises = invalidAlbums.map(album => {
          console.log('删除已标记删除的相册:', album.title, album._id);
          return db.collection('albums').doc(album._id).remove()
            .then(res => {
              console.log('成功删除相册记录:', album.title, res);
              return res;
            })
            .catch(err => {
              console.error('删除相册记录失败:', album.title, err);
              return Promise.resolve();
            });
        });
        
        // 执行所有删除操作
        return Promise.all(deletePromises);
      });
    }).then(() => {
      console.log('清理完成，开始重新加载相册');
      
      // 4. 重新加载相册列表
      this.loadAlbums();
      
      // 显示操作成功
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    }).catch(err => {
      console.error('强制刷新失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
      
      // 尝试常规加载
      this.loadAlbums();
    });
  },
  
  // 点击相册进入详情页
  onAlbumTap(e) {
    const album = e.currentTarget.dataset.album;
    
    // 跳转到相册详情页
    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${album.id}&albumTitle=${album.title}`
    });
  },
  
  // 长按相册
  onAlbumLongPress(e) {
    const album = e.currentTarget.dataset.album;
    
    wx.showActionSheet({
      itemList: ['重命名', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 重命名
          this.showRenameAlbum(album);
        } else if (res.tapIndex === 1) {
          // 删除
          this.deleteAlbum(album);
        }
      }
    });
  },
  
  // 显示重命名相册弹窗
  showRenameAlbum(album) {
    this.setData({
      editingAlbum: album,
      newAlbumName: album.title,
      showAddAlbumModal: true,
      isRenaming: true
    });
  },
  
  // 确认删除相册
  deleteAlbum(album) {
    if (!album || !album.title) {
      console.error('相册数据不完整，无法删除');
      return;
    }
    
    wx.showModal({
      title: '删除相册',
      content: `确定要删除「${album.title}」相册？相册内的照片也将被删除。`,
      confirmColor: '#FF0000',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteAlbum(album);
        }
      }
    });
  },
  
  // 执行删除相册的操作
  doDeleteAlbum(album) {
    wx.showLoading({
      title: '删除中...',
      mask: true
    });
    
    console.log('开始删除相册:', album);
    
    // 先查询该相册下的所有照片
    wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {
        tag: album.title
      }
    }).then(res => {
      console.log('获取相册照片成功:', res.result);
      
      // 数据库操作
      const db = wx.cloud.database();
      
      // 先处理albums集合中的相册记录
      let albumDeletePromise;
      
      // 检查是否是MongoDB ObjectId格式
      if (album.id && typeof album.id === 'string' && album.id.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('通过_id删除相册记录:', album.id);
        
        // 标记为已删除，而不是直接删除
        albumDeletePromise = db.collection('albums').doc(album.id).update({
          data: {
            isDeleted: true,
            deleteTime: db.serverDate()
          }
        }).then(res => {
          console.log('标记相册为已删除成功:', res);
          return res;
        }).catch(err => {
          console.error('标记相册为已删除失败:', err);
          return Promise.reject(err);
        });
      } else {
        // 按title查询并标记删除
        console.log('通过title标记删除相册记录:', album.title);
        albumDeletePromise = db.collection('albums').where({
          title: album.title
        }).update({
          data: {
            isDeleted: true,
            deleteTime: db.serverDate()
          }
        }).then(res => {
          console.log('通过title标记相册为已删除成功:', res);
          return res;
        }).catch(err => {
          console.error('通过title标记相册为已删除失败:', err);
          
          // 如果标记失败，不阻止继续执行
          return Promise.resolve();
        });
      }
      
      // 获取所有照片的fileID和ID
      const photoList = res.result.photoList || [];
      const fileIDs = photoList
        .filter(photo => photo.fileID && photo.fileID.trim() !== '')
        .map(photo => photo.fileID);
      
      // 提取照片ID用于删除数据库记录
      const photoIDs = photoList
        .filter(photo => photo.id || photo._id)
        .map(photo => photo.id || photo._id);
      
      console.log('需要删除的文件数:', fileIDs.length, '照片记录数:', photoIDs.length);
      
      // 如果没有照片，只更新相册状态
      if (fileIDs.length === 0 && photoIDs.length === 0) {
        return albumDeletePromise.then(() => {
          console.log('相册中没有照片，只标记相册为已删除');
          
          // 刷新相册列表
          this.forceClearAndRefreshAlbums();
          
          wx.hideLoading();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        });
      }
      
      // 删除云存储中的文件
      let deleteStoragePromise;
      if (fileIDs.length > 0) {
        deleteStoragePromise = wx.cloud.deleteFile({
          fileList: fileIDs
        }).then(result => {
          console.log('删除云存储文件成功', result);
          return result;
        }).catch(err => {
          console.error('删除云存储文件失败', err);
          // 继续执行，不中断流程
          return Promise.resolve();
        });
      } else {
        deleteStoragePromise = Promise.resolve();
      }
      
      // 删除云数据库中的照片记录
      let deleteDbPromise;
      if (photoIDs.length > 0) {
        // 由于小程序端不支持批量删除文档，所以使用云函数或循环删除
        // 这里使用where条件删除所有匹配的照片
        deleteDbPromise = db.collection('photos').where({
          tag: album.title
        }).remove().then(dbRes => {
          console.log('通过tag删除照片记录成功', dbRes);
          return dbRes;
        }).catch(dbErr => {
          console.error('通过tag删除照片记录失败', dbErr);
          // 继续执行，不中断流程
          return Promise.resolve();
        });
      } else {
        deleteDbPromise = Promise.resolve();
      }
      
      // 执行所有删除操作
      Promise.all([deleteStoragePromise, deleteDbPromise, albumDeletePromise])
        .then(() => {
          console.log('所有删除操作完成');
          wx.hideLoading();
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          
          // 强制刷新相册列表以确保UI更新
          this.forceClearAndRefreshAlbums();
        })
        .catch(err => {
          console.error('删除操作过程中发生错误', err);
          wx.hideLoading();
          
          wx.showToast({
            title: '删除未完全成功',
            icon: 'none'
          });
          
          // 即使有错误也刷新列表
          this.forceClearAndRefreshAlbums();
        });
    }).catch(err => {
      console.error('获取相册照片失败:', err);
      
      wx.hideLoading();
      
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },
  
  // 显示新建相册弹窗
  addNewAlbum() {
    this.setData({
      showAddAlbumModal: true,
      newAlbumName: '',
      isRenaming: false,
      editingAlbum: null
    });
  },
  
  // 关闭新建相册弹窗
  closeAddAlbumModal() {
    this.setData({
      showAddAlbumModal: false,
      newAlbumName: '',
      isRenaming: false,
      editingAlbum: null
    });
  },
  
  // 监听新相册名称输入
  onNewAlbumNameInput(e) {
    this.setData({
      newAlbumName: e.detail.value
    });
  },
  
  // 确认新建/重命名相册
  confirmAddAlbum() {
    const { newAlbumName, isRenaming, editingAlbum } = this.data;
    
    if (!newAlbumName.trim()) {
      wx.showToast({
        title: '请输入相册名称',
        icon: 'none'
      });
      return;
    }
    
    if (isRenaming) {
      // 重命名相册
      this.renameAlbum(editingAlbum, newAlbumName);
    } else {
      // 创建新相册
      this.createNewAlbum(newAlbumName);
    }
  },
  
  // 创建新相册
  createNewAlbum(albumName) {
    // 关闭弹窗
    this.setData({
      showAddAlbumModal: false
    });
    
    // 显示加载提示
    wx.showLoading({
      title: '创建相册...',
      mask: true
    });
    
    // 在数据库中创建相册记录
    const db = wx.cloud.database();
    db.collection('albums').add({
      data: {
        title: albumName,
        createTime: db.serverDate(),
        coverImage: '', // 默认没有封面
        photoCount: 0 // 初始照片数为0
      }
    }).then(res => {
      console.log('创建相册成功:', res);
      
      // 创建新的相册对象
      const newAlbum = {
        id: res._id, // 使用数据库返回的ID
        title: albumName,
        count: 0,
        cover: '/images/default-album.png', // 使用默认封面
        isEmpty: true
      };
      
      // 添加到相册列表
      const albumList = [...this.data.albumList, newAlbum];
      
      this.setData({
        albumList
      });
      
      wx.hideLoading();
      
      // 显示成功提示
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });
      
      // 跳转到新相册详情页
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/album-detail/index?albumId=${newAlbum.id}&albumTitle=${newAlbum.title}`
        });
      }, 500);
    }).catch(err => {
      console.error('创建相册失败:', err);
      
      wx.hideLoading();
      
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    });
  },
  
  // 重命名相册
  renameAlbum(album, newName) {
    wx.showLoading({
      title: '正在重命名...',
      mask: true
    });
    
    const db = wx.cloud.database();
    let albumUpdatePromise;
    
    // 如果相册ID是MongoDB ObjectId格式，则是存储在albums集合中的
    if (typeof album.id === 'string' && album.id.length === 24) {
      // 更新albums集合中的记录
      albumUpdatePromise = db.collection('albums').doc(album.id).update({
        data: {
          title: newName
        }
      });
    } else {
      // 否则是通过tag生成的相册，需要创建一个新的albums记录
      albumUpdatePromise = db.collection('albums').add({
        data: {
          title: newName,
          createTime: db.serverDate(),
          coverImage: album.cover || '',
          count: album.count || 0
        }
      });
    }
    
    // 获取相册中的所有照片
    wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {
        tag: album.title
      }
    }).then(res => {
      console.log('获取相册照片成功:', res);
      
      // 如果没有照片，直接更新本地状态和albums集合
      if (!res.result || !res.result.photoList || res.result.photoList.length === 0) {
        return albumUpdatePromise.then(albumRes => {
          console.log('更新/创建相册记录成功:', albumRes);
          
          // 获取新的相册ID（如果是新创建的）
          let newAlbumId = album.id;
          if (albumRes._id) {
            newAlbumId = albumRes._id;
          }
          
          // 更新本地相册列表
          const albumList = this.data.albumList.map(item => {
            if (item.id === album.id) {
              return {
                ...item,
                id: newAlbumId,
                title: newName
              };
            }
            return item;
          });
          
          this.setData({
            albumList,
            showAddAlbumModal: false
          });
          
          wx.hideLoading();
          
          wx.showToast({
            title: '重命名成功',
            icon: 'success'
          });
        }).catch(err => {
          console.error('更新/创建相册记录失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '重命名失败',
            icon: 'none'
          });
          this.setData({
            showAddAlbumModal: false
          });
        });
      }
      
      // 更新所有照片的tag字段
      const _ = db.command;
      
      // 先完成albums集合的操作
      return albumUpdatePromise.then(albumRes => {
        console.log('更新/创建相册记录成功:', albumRes);
        
        // 获取新的相册ID（如果是新创建的）
        let newAlbumId = album.id;
        if (albumRes._id) {
          newAlbumId = albumRes._id;
        }
        
        // 云数据库中有修改次数限制，可能需要分批修改
        return db.collection('photos').where({
          tag: album.title
        }).update({
          data: {
            tag: newName
          }
        }).then(dbRes => {
          console.log('更新照片标签成功', dbRes);
          
          // 更新本地相册列表
          const albumList = this.data.albumList.map(item => {
            if (item.id === album.id) {
              return {
                ...item,
                id: newAlbumId,
                title: newName
              };
            }
            return item;
          });
          
          this.setData({
            albumList,
            showAddAlbumModal: false
          });
          
          wx.hideLoading();
          
          wx.showToast({
            title: '重命名成功',
            icon: 'success'
          });
        });
      }).catch(err => {
        console.error('重命名过程失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '重命名失败',
          icon: 'none'
        });
        this.setData({
          showAddAlbumModal: false
        });
      });
    }).catch(err => {
      console.error('获取相册照片失败:', err);
      
      wx.hideLoading();
      
      wx.showToast({
        title: '重命名失败',
        icon: 'none'
      });
      
      this.setData({
        showAddAlbumModal: false
      });
    });
  }
});
