const fileHelper = require('../../utils/fileHelper');

Page({
  data: {
    albumId: '', // 相册ID
    albumTitle: '', // 相册标题
    albumTag: '', // 相册标签
    photoList: [], // 照片列表
    isLoading: false, // 是否正在加载
    isEmpty: false, // 是否为空相册
    
    showActionSheet: false, // 是否显示底部操作菜单
    currentPhoto: null, // 当前选中的照片
    isRefreshing: false, // 是否正在下拉刷新
    __debug: false, // 调试模式
    validPhotoCount: 0 // 有效照片数量
  },

  onLoad(options) {
    // 处理页面参数
    if (options.albumId) {
      this.setData({
        albumId: options.albumId,
        albumTitle: options.albumTitle || '相册详情',
        albumTag: options.albumTitle || '' // 将相册标题保存为tag
      });

      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: this.data.albumTitle
      });

      // 加载照片列表
      this.loadPhotoList();
    } else {
      wx.showToast({
        title: '相册参数错误',
        icon: 'none'
      });

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 页面显示时刷新数据
  onShow() {
    // 确保在有相册ID的情况下才加载数据
    if (this.data.albumId) {
      console.log('页面显示，刷新相册数据:', this.data.albumTitle);
      
      // 显示轻提示，避免用户等待
      wx.showToast({
        title: '刷新数据...',
        icon: 'loading',
        duration: 500
      });
      
      // 延迟执行，避免页面闪烁
      setTimeout(() => {
        this.loadPhotoList();
      }, 300);
    }
  },

  // 监听页面下拉刷新
  onPullDownRefresh() {
    this.setData({
      isRefreshing: true
    });
    
    this.loadPhotoList().finally(() => {
      this.setData({
        isRefreshing: false
      });
      wx.stopPullDownRefresh();
    });
  },

  // 加载照片列表
  loadPhotoList() {
    const that = this;
    const { albumTitle } = this.data;
    
    this.setData({
      isLoading: true,
      isEmpty: false
    });
    
    wx.showLoading({
      title: '加载照片...',
    });
    
    console.log('开始加载相册照片：', albumTitle);
    
    // 使用getPhotoList云函数
    return wx.cloud.callFunction({
      name: 'getPhotoList',
      data: {
        tag: albumTitle
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('获取照片列表成功:', res.result);
      
      if (res.result && res.result.photoList) {
        const photoList = res.result.photoList || [];
        
        console.log('原始照片列表数量:', photoList.length);
        
        // 处理照片数据 - 确保所有照片都被包含进来
        const processedPhotoList = photoList.map(photo => {
          // 使用fileHelper处理照片数据
          return fileHelper.ensurePhotoTempURL(photo);
        });
        
        console.log('处理后的照片列表数量:', processedPhotoList.length);
        
        // 检查是否有空的fileID照片
        const invalidPhotos = processedPhotoList.filter(photo => !photo.fileID || photo.fileID.trim() === '');
        if (invalidPhotos.length > 0) {
          console.warn('发现无效fileID的照片:', invalidPhotos.length, '个');
        }
        
        // 计算有效照片数量
        const validPhotoCount = processedPhotoList.filter(photo => photo.fileID && photo.fileID.trim() !== '').length;
        
        // 设置照片列表和状态
        this.setData({
          photoList: processedPhotoList,
          isEmpty: processedPhotoList.length === 0,
          isLoading: false,
          validPhotoCount: validPhotoCount
        }, () => {
          // 在UI更新后，再尝试刷新临时链接
          this.refreshTempFileURLs();
        });
      } else {
        console.log('没有获取到照片数据');
        this.setData({
          photoList: [],
          isEmpty: true,
          isLoading: false,
          validPhotoCount: 0
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取照片列表失败:', err);
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      
      this.setData({
        photoList: [],
        isEmpty: true,
        isLoading: false,
        validPhotoCount: 0
      });
    });
  },
  
  // 刷新临时链接
  refreshTempFileURLs() {
    const { photoList } = this.data;
    if (!photoList || photoList.length === 0) return;
    
    // 收集需要处理的fileID
    const fileIDs = photoList
      .filter(photo => photo.fileID && photo.fileID.trim() !== '')
      .map(photo => photo.fileID);
    
    if (fileIDs.length === 0) {
      console.warn('没有有效的fileID，无法刷新临时链接');
      return;
    }
    
    console.log('准备刷新照片临时链接，有效fileID数量:', fileIDs.length);
    
    // 使用fileHelper批量获取临时链接
    fileHelper.batchGetTempFileURL(fileIDs)
      .then(urlMap => {
        // 更新照片列表的临时链接
        const updatedPhotoList = [...photoList];
        let hasUpdates = false;
        
        updatedPhotoList.forEach((photo, index) => {
          if (photo.fileID && urlMap[photo.fileID]) {
            // 只有当新的临时链接与原来不同时才更新
            if (photo.tempFileURL !== urlMap[photo.fileID]) {
              updatedPhotoList[index].tempFileURL = urlMap[photo.fileID];
              hasUpdates = true;
              console.log(`更新照片[${index}]临时链接成功`);
            }
          } else if (photo.fileID) {
            console.warn(`照片[${index}]的fileID[${photo.fileID}]未获取到临时链接`);
          }
        });
        
        // 只有在有更新时才重新渲染
        if (hasUpdates) {
          console.log('照片临时链接已更新，刷新界面');
          this.setData({ photoList: updatedPhotoList });
        } else {
          console.log('没有照片需要更新临时链接');
        }
      })
      .catch(err => {
        console.error('刷新临时链接失败:', err);
      });
  },

  // 预览照片
  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photoList;
    
    // 获取所有图片的临时链接或fileID
    const urls = photos.map(photo => photo.tempFileURL || photo.fileID || '');
    
    // 过滤掉空链接
    const validUrls = urls.filter(url => url && url.trim() !== '');
    
    // 确保当前图片URL有效
    const currentUrl = urls[index];
    
    if (validUrls.length > 0 && currentUrl && currentUrl.trim() !== '') {
      console.log('预览图片:', currentUrl);
      wx.previewImage({
        current: currentUrl,
        urls: validUrls
      });
    } else {
      wx.showToast({
        title: '无法预览图片',
        icon: 'none'
      });
    }
  },

  // 长按照片显示操作菜单
  onPhotoLongPress(e) {
    const index = e.currentTarget.dataset.index;
    const photo = this.data.photoList[index];
    
    this.setData({
      currentPhoto: photo
    });
    
    wx.showActionSheet({
      itemList: ['查看详情', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 查看详情
          this.viewPhotoDetail(photo);
        } else if (res.tapIndex === 1) {
          // 删除照片
          this.confirmDeletePhoto(photo);
        }
      }
    });
  },

  // 查看照片详情
  viewPhotoDetail(photo) {
    wx.navigateTo({
      url: `/pages/photo-detail/index?id=${photo.id}`
    });
  },

  // 确认删除照片
  confirmDeletePhoto(photo) {
    wx.showModal({
      title: '删除照片',
      content: '确定要删除这张照片吗？此操作不可恢复',
      confirmColor: '#FF4949',
      success: (res) => {
        if (res.confirm) {
          this.deletePhoto(photo);
        }
      }
    });
  },

  // 删除照片
  deletePhoto(photo) {
    wx.showLoading({
      title: '正在删除...',
      mask: true
    });
    
    // 调用云函数删除照片
    wx.cloud.callFunction({
      name: 'deletePhoto',
      data: {
        id: photo.id
      }
    }).then(res => {
      console.log('删除照片成功:', res);
      
      if (res.result && res.result.success) {
        wx.hideLoading();
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 从列表中移除已删除的照片
        const photoList = this.data.photoList.filter(item => item.id !== photo.id);
        
        this.setData({
          photoList,
          isEmpty: photoList.length === 0
        });
      } else {
        wx.hideLoading();
        
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('删除照片失败:', err);
      
      wx.hideLoading();
      
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },

  // 处理图片加载错误
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const photoId = e.currentTarget.dataset.id;
    const photoList = this.data.photoList;
    
    console.error('图片加载错误:', 'index:', index, 'id:', photoId);
    
    if (index >= 0 && index < photoList.length) {
      const photo = photoList[index];
      console.log('图片加载失败:', photo.id, '尝试使用fileID');
      
      // 尝试直接使用fileID
      if (photo.fileID && photo.fileID.trim() !== '') {
        // 创建新的数组以触发视图更新
        const newPhotoList = [...photoList];
        newPhotoList[index] = {
          ...photo,
          tempFileURL: photo.fileID, // 将临时URL设置为fileID
          _retryCount: (photo._retryCount || 0) + 1
        };
        
        // 如果已经重试了两次还是失败，尝试重新生成临时URL
        if (newPhotoList[index]._retryCount > 2) {
          console.log('多次重试失败，尝试重新获取临时链接');
          
          // 使用fileHelper获取新的临时链接
          fileHelper.getTempFileURL(photo.fileID)
            .then(tempUrl => {
              console.log('重新获取临时链接成功:', tempUrl);
              
              // 更新临时链接
              const updatedPhotoList = [...this.data.photoList];
              if (updatedPhotoList[index]) {
                updatedPhotoList[index].tempFileURL = tempUrl;
                updatedPhotoList[index]._retryCount = 0;
                
                this.setData({
                  photoList: updatedPhotoList
                });
              }
            })
            .catch(err => {
              console.error('重新获取临时链接失败:', err);
              // 直接设回fileID
              this.setData({
                photoList: newPhotoList
              });
            });
        } else {
          // 普通重试
          this.setData({
            photoList: newPhotoList
          });
        }
      } else {
        console.error('照片没有有效的fileID，无法显示');
      }
    }
  },

  // 添加新照片
  addNewPhoto() {
    const { albumId, albumTitle } = this.data;
    
    // 跳转到上传页面，并传递相册信息
    wx.navigateTo({
      url: `/pages/upload/index?albumId=${albumId}&albumTitle=${albumTitle}`
    });
  },

  // 切换调试模式
  toggleDebugMode() {
    this.setData({
      __debug: !this.data.__debug
    });
    
    wx.showToast({
      title: this.data.__debug ? '调试模式开启' : '调试模式关闭',
      icon: 'none'
    });
  }
}); 