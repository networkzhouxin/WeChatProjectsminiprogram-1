Page({
  data: {
    tempFilePaths: [], // 临时文件路径数组，用于多图片
    photoDesc: '', // 照片描述
    albumId: '', // 当前相册ID
    albumTitle: '', // 当前相册标题
    isSubmitting: false, // 是否正在提交
    currentPhotoIndex: 0 // 当前显示的照片索引
  },

  onLoad(options) {
    console.log('上传页面加载参数:', options);
    // 从页面参数获取相册信息
    if (options && options.albumTitle) {
      this.setData({
        albumId: options.albumId || '',
        albumTitle: options.albumTitle || ''
      });
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: `上传到${options.albumTitle}`
      });
    } else {
      // 默认导航栏标题
      wx.setNavigationBarTitle({
        title: '上传照片'
      });
    }
  },

  // 处理照片拖动
  onDragPhoto(e) {
    const { index } = e.currentTarget.dataset;
    const { source, x, y } = e.detail;
    
    // 只处理拖动结束的事件
    if (source === 'touch-out') {
      // 计算新的位置索引
      const newIndex = this.calculateNewIndex(x, y);
      if (newIndex !== index && newIndex >= 0 && newIndex < this.data.tempFilePaths.length) {
        // 更新照片顺序
        const tempFilePaths = [...this.data.tempFilePaths];
        const [movedItem] = tempFilePaths.splice(index, 1);
        tempFilePaths.splice(newIndex, 0, movedItem);
        
        this.setData({
          tempFilePaths,
          currentPhotoIndex: newIndex
        });
      }
    }
  },

  // 计算新的位置索引
  calculateNewIndex(x, y) {
    const itemWidth = wx.getSystemInfoSync().windowWidth / 3;
    const itemHeight = 220; // rpx转px，约等于110px
    const row = Math.floor(y / itemHeight);
    const col = Math.floor(x / itemWidth);
    return row * 3 + col;
  },

  // 选择照片
  choosePhoto() {
    wx.chooseImage({
      count: 9 - this.data.tempFilePaths.length,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPaths = res.tempFilePaths;
        this.setData({
          tempFilePaths: [...this.data.tempFilePaths, ...newPaths]
        });
      }
    });
  },

  // 删除照片
  deletePhoto(e) {
    const { index } = e.currentTarget.dataset;
    const tempFilePaths = [...this.data.tempFilePaths];
    tempFilePaths.splice(index, 1);
    this.setData({ tempFilePaths });
  },

  // 切换当前显示的照片
  switchPhoto(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentPhotoIndex: index
    });
  },

  // 更新照片描述
  onPhotoDescInput(e) {
    this.setData({
      photoDesc: e.detail.value
    });
  },

  // 取消上传
  cancelUpload() {
    if (this.data.tempFilePaths.length > 0) {
      // 有照片时显示确认弹窗
      wx.showModal({
        title: '提示',
        content: '确定要取消上传吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      // 没有照片时直接返回
      wx.navigateBack();
    }
  },

  // 提交照片
  submitPhoto() {
    const { tempFilePaths, photoDesc, albumId, albumTitle } = this.data;

    if (tempFilePaths.length === 0) {
      wx.showToast({
        title: '请选择至少一张照片',
        icon: 'none'
      });
      return;
    }

    if (!albumTitle) {
      wx.showToast({
        title: '相册信息缺失',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    // 上传照片计数
    let successCount = 0;
    let failCount = 0;
    const totalCount = tempFilePaths.length;

    // 遍历上传每一张照片
    tempFilePaths.forEach((filePath, index) => {
      const ext = filePath.split('.').pop();
      const cloudPath = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${index}.${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          console.log(`上传文件成功 ${index + 1}/${totalCount}`, res);
          
          // 调用云函数保存照片记录
          wx.cloud.callFunction({
            name: 'addPhoto',
            data: {
              fileID: res.fileID,
              tag: albumTitle,
              albumId: albumId,
              desc: photoDesc
            }
          }).then(dbRes => {
            console.log(`照片记录保存成功 ${index + 1}/${totalCount}:`, dbRes);
            successCount++;
            this.checkUploadComplete(successCount, failCount, totalCount);
          }).catch(err => {
            console.error(`照片记录保存失败 ${index + 1}/${totalCount}:`, err);
            failCount++;
            this.checkUploadComplete(successCount, failCount, totalCount);
          });
        },
        fail: (err) => {
          console.error(`上传文件失败 ${index + 1}/${totalCount}`, err);
          failCount++;
          this.checkUploadComplete(successCount, failCount, totalCount);
        }
      });
    });
  },

  // 检查上传是否完成
  checkUploadComplete(successCount, failCount, totalCount) {
    if (successCount + failCount === totalCount) {
      this.setData({ isSubmitting: false });
      wx.hideLoading();

      if (failCount > 0) {
        wx.showToast({
          title: `${successCount}张上传成功，${failCount}张失败`,
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 2000
        });
      }

      // 延迟返回，让用户看到提示
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  }
}); 