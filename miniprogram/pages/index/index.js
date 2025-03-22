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
      
      // 加载相册列表
      this.loadAlbums();
    }
  },
  
  // 页面显示时刷新数据
  onShow() {
    this.loadAlbums();
  },
  
  // 监听页面的tabItem点击事件
  onTabItemTap(item) {
    console.log('点击了相册', item);
    
    // 点击当前页面的底部标签时，刷新相册数据
    if (item.index === 0) { // 相册标签的index为0
      // 重新加载相册分类
      this.loadAlbums();
      
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
          cover: album.coverImage || null,
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
                if (!album.cover) {
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
          this.confirmDeleteAlbum(album);
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
  confirmDeleteAlbum(album) {
    wx.showModal({
      title: '删除相册',
      content: `确定删除"${album.title}"相册？该操作会删除相册下的所有照片，且无法恢复`,
      confirmColor: '#FF4949',
      success: (res) => {
        if (res.confirm) {
          this.deleteAlbum(album);
        }
      }
    });
  },
  
  // 删除相册及其下所有照片
  deleteAlbum(album) {
    wx.showLoading({
      title: '正在删除...',
      mask: true
    });
    
    // 先获取相册中的所有照片
    wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {
        tag: album.title // 使用相册标题作为tag
      }
    }).then(res => {
      console.log('获取相册照片成功:', res);
      
      // 删除albums集合中的相册记录
      const db = wx.cloud.database();
      let albumDeletePromise;
      
      // 如果相册ID是MongoDB ObjectId格式，则是存储在albums集合中的
      if (typeof album.id === 'string' && album.id.length === 24) {
        albumDeletePromise = db.collection('albums').doc(album.id).remove();
      } else {
        // 否则是通过tag生成的相册，不需要从albums集合中删除
        albumDeletePromise = Promise.resolve();
      }
      
      // 如果没有照片，直接删除相册记录并提示成功
      if (!res.result || !res.result.photoList || res.result.photoList.length === 0) {
        return albumDeletePromise.then(() => {
          wx.hideLoading();
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          
          // 刷新相册列表
          this.loadAlbums();
        }).catch(err => {
          console.error('删除相册记录失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        });
      }
      
      // 获取所有照片的fileID
      const fileIDs = res.result.photoList.map(photo => photo.fileID);
      
      // 删除云存储中的文件
      wx.cloud.deleteFile({
        fileList: fileIDs,
        success: (result) => {
          console.log('删除云存储文件成功', result);
          
          // 删除云数据库中的照片记录
          db.collection('photos').where({
            tag: album.title
          }).remove().then(dbRes => {
            console.log('删除照片记录成功', dbRes);
            
            // 删除albums集合中的相册记录
            return albumDeletePromise;
          }).then(() => {
            console.log('删除相册记录成功');
            wx.hideLoading();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            
            // 刷新相册列表
            this.loadAlbums();
          }).catch(dbErr => {
            console.error('删除照片或相册记录失败', dbErr);
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          });
        },
        fail: (err) => {
          console.error('删除云存储文件失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
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
        count: 0 // 初始照片数为0
      }
    }).then(res => {
      console.log('创建相册成功:', res);
      
      // 创建新的相册对象
      const newAlbum = {
        id: res._id, // 使用数据库返回的ID
        title: albumName,
        count: 0,
        cover: ''
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
