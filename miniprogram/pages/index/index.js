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
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      refreshing: true
    });
    
    this.loadAlbums()
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
    this.setData({ isLoading: true });
    console.log('开始加载相册列表');

    const db = wx.cloud.database();
    const albumsMap = new Map();
    const that = this;  // 保存this引用供后续使用

    // 先获取自定义相册列表
    return db.collection('albums').get().then(albumsRes => {
      console.log('获取自定义相册成功:', albumsRes.data);
      
      // 将数据库中的相册添加到Map
      albumsRes.data.forEach(album => {
        albumsMap.set(album.title, {
          id: album._id,
          title: album.title,
          count: album.photoCount || 0,
          cover: that.isDefaultCover(album.coverImage) ? '/images/default-album.png' : album.coverImage,
          isEmpty: album.photoCount === 0
        });
      });
      
      // 获取所有照片列表，更新相册信息
      return wx.cloud.callFunction({
        name: 'getPhotoList',
        data: {}
      });
    }).then(res => {
      console.log('获取照片列表成功:', res.result);
      
      if (res.result && res.result.photoList) {
        const photos = res.result.photoList;
        
        // 按标签分组照片
        photos.forEach(photo => {
          const tag = photo.tag || '';
          
          // 只处理有标签的照片
          if (tag) {
            // 如果Map中存在该相册，更新相册信息
            if (albumsMap.has(tag)) {
              const album = albumsMap.get(tag);
              album.count = (album.count || 0) + 1;
              album.isEmpty = false;
              
              // 如果相册没有封面，使用照片的fileID作为封面
              if (!album.cover || album.cover === '/images/default-album.png') {
                album.cover = photo.fileID;
              }
            }
          }
        });
      }
      
      // 转换为数组并按照创建时间排序
      const albumList = Array.from(albumsMap.values()).sort((a, b) => b.createTime - a.createTime);
      
      this.setData({
        albumList,
        isLoading: false,
        isEmpty: albumList.length === 0,
        refreshing: false // 确保刷新状态被重置
      });
      
    }).catch(err => {
      console.error('加载相册失败:', err);
      
      this.setData({
        isLoading: false,
        isEmpty: true,
        refreshing: false // 确保刷新状态被重置
      });
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },
  
  // 强制清除并刷新相册列表
  forceClearAndRefreshAlbums() {
    // 清空当前列表
    this.setData({
      albumList: [],
      isLoading: true
    });

    // 延迟一下再重新加载，确保数据库操作完成
    setTimeout(() => {
      this.loadAlbums();
    }, 500);
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
      title: '正在删除...',
      mask: true
    });

    // 先获取相册中的所有照片
    wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {
        tag: album.title
      }
    }).then(res => {
      console.log('获取相册照片成功:', res.result);
      
      const photos = res.result.photoList || [];
      const fileIDs = photos.map(photo => photo.fileID).filter(id => id);
      const photoIDs = photos.map(photo => photo._id).filter(id => id);
      
      // 准备删除操作的Promise
      let deleteStoragePromise = Promise.resolve();
      let deleteDbPromise = Promise.resolve();
      let albumDeletePromise = Promise.resolve();
      
      // 删除云存储中的文件
      if (fileIDs.length > 0) {
        deleteStoragePromise = wx.cloud.deleteFile({
          fileList: fileIDs
        }).then(storageRes => {
          console.log('删除云存储文件成功', storageRes);
          return storageRes;
        }).catch(storageErr => {
          console.error('删除云存储文件失败', storageErr);
          return Promise.resolve();
        });
      }
      
      // 删除数据库中的照片记录
      const db = wx.cloud.database();
      if (album.id) {
        // 删除相册记录
        albumDeletePromise = db.collection('albums').doc(album.id).remove()
          .then(albumRes => {
            console.log('删除相册记录成功', albumRes);
            return albumRes;
          }).catch(albumErr => {
            console.error('删除相册记录失败', albumErr);
            return Promise.resolve();
          });
          
        // 删除相关照片记录
        deleteDbPromise = db.collection('photos').where({
          albumId: album.id
        }).remove().then(dbRes => {
          console.log('删除照片记录成功', dbRes);
          return dbRes;
        }).catch(dbErr => {
          console.error('删除照片记录失败', dbErr);
          return Promise.resolve();
        });
      }
      
      // 执行所有删除操作
      return Promise.all([deleteStoragePromise, deleteDbPromise, albumDeletePromise]);
    }).then(() => {
      console.log('所有删除操作完成');
      wx.hideLoading();
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      // 强制刷新相册列表
      this.forceClearAndRefreshAlbums();
    }).catch(err => {
      console.error('删除操作失败:', err);
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

  /**
   * 新建或重命名相册确认
   */
  confirmAddAlbum: function () {
    if (!this.data.newAlbumName.trim()) {
      wx.showToast({
        title: '相册名称不能为空',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    // 如果是重命名相册
    if (this.data.isRenaming && this.data.editingAlbum) {
      this.renameAlbum();
      return;
    }

    // 新建相册
    const db = wx.cloud.database();
    db.collection('albums').add({
      data: {
        title: this.data.newAlbumName.trim(),
        photoCount: 0,
        coverImage: '/images/default-album.png',
        createdTime: db.serverDate()
      }
    }).then(res => {
      console.log('新建相册成功', res);

      // 添加到相册列表
      const albumList = this.data.albumList;
      albumList.unshift({
        id: res._id,
        title: this.data.newAlbumName.trim(),
        count: 0,
        cover: '/images/default-album.png',
        isEmpty: true
      });

      // 更新UI
      this.setData({
        albumList,
        showAddAlbumModal: false,
        newAlbumName: '',
        isLoading: false
      });

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });
    }).catch(err => {
      console.error('新建相册失败', err);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '创建失败，请重试',
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
  },

  /**
   * 检查是否使用默认封面
   */
  isDefaultCover: function(cover) {
    return !cover || cover === '/images/default-album.png';
  }
});
