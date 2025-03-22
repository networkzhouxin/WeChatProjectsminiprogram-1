Page({
  data: {
    tempFilePaths: [], // 临时文件路径数组，用于多图片
    photoDesc: '', // 照片描述
    albumId: '', // 当前相册ID
    albumTitle: '', // 当前相册标题
    isSubmitting: false, // 是否正在提交
    compressed: false // 默认不压缩照片
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
        title: `上传到 ${options.albumTitle}`
      });
    } else {
      // 默认导航栏标题
      wx.setNavigationBarTitle({
        title: '上传照片'
      });
    }
  },

  // 选择照片 - 修改为支持多张照片
  choosePhoto() {
    const currentCount = this.data.tempFilePaths.length;
    const remainCount = 9 - currentCount;
    
    if (remainCount <= 0) {
      wx.showToast({
        title: '最多只能选择9张照片',
        icon: 'none'
      });
      return;
    }
    
    wx.chooseImage({
      count: remainCount, // 最多可选剩余数量
      sizeType: this.data.compressed ? ['compressed'] : ['original'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择照片成功:', res.tempFilePaths);
        // 将新选择的照片添加到已有照片数组
        const newPaths = [...this.data.tempFilePaths, ...res.tempFilePaths];
        this.setData({
          tempFilePaths: newPaths
        }, () => {
          console.log('更新后的照片数组:', this.data.tempFilePaths);
        });
      },
      fail: (err) => {
        console.error('选择照片失败:', err);
      }
    });
  },

  // 删除已选择的照片
  deletePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const tempFilePaths = [...this.data.tempFilePaths];
    tempFilePaths.splice(index, 1);
    this.setData({
      tempFilePaths
    });
  },

  // 压缩选项改变
  onCompressedChange(e) {
    this.setData({
      compressed: e.detail.value
    });
  },

  // 照片描述输入
  onPhotoDescInput(e) {
    this.setData({
      photoDesc: e.detail.value
    });
  },

  // 提交表单 - 修改为支持多张照片上传
  submitPhoto() {
    const { tempFilePaths, photoDesc, albumTitle } = this.data;

    if (tempFilePaths.length === 0) {
      wx.showToast({
        title: '请先选择照片',
        icon: 'none'
      });
      return;
    }

    // 设置提交状态
    this.setData({
      isSubmitting: true
    });

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
      // 获取文件扩展名
      const ext = filePath.split('.').pop();
      
      // 生成云存储路径
      const cloudPath = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${index}.${ext}`;

      // 上传到云存储
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          console.log(`上传文件成功 ${index + 1}/${totalCount}`, res);
          
          // 获取文件ID
          const fileID = res.fileID;
          
          // 保存照片记录到数据库
          this.savePhotoToDatabase(fileID, index, totalCount);
          successCount++;
          
          // 检查是否全部完成
          this.checkUploadComplete(successCount, failCount, totalCount);
        },
        fail: (err) => {
          console.error(`上传文件失败 ${index + 1}/${totalCount}`, err);
          failCount++;
          
          // 检查是否全部完成
          this.checkUploadComplete(successCount, failCount, totalCount);
        }
      });
    });
  },

  // 检查上传是否全部完成
  checkUploadComplete(successCount, failCount, totalCount) {
    if (successCount + failCount === totalCount) {
      wx.hideLoading();
      
      if (successCount > 0) {
        wx.showToast({
          title: `成功上传${successCount}张照片`,
          icon: 'success'
        });
        
        // 重置表单
        this.setData({
          tempFilePaths: [],
          photoDesc: '',
          isSubmitting: false
        });
        
        // 如果全部成功，延迟返回上一页
        if (successCount === totalCount) {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      } else {
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        
        this.setData({
          isSubmitting: false
        });
      }
    }
  },

  // 保存照片记录到数据库
  savePhotoToDatabase(fileID, index, totalCount) {
    const { photoDesc, albumTitle, albumId } = this.data;

    // 调用现有的云函数添加照片
    wx.cloud.callFunction({
      name: 'addPhoto',
      data: {
        fileID,
        tag: albumTitle, // 使用当前相册标题作为标签
        albumId: albumId, // 添加相册ID
        desc: photoDesc
      }
    }).then(res => {
      console.log(`照片 ${index + 1}/${totalCount} 保存到数据库成功`, res);
    }).catch(err => {
      console.error(`照片 ${index + 1}/${totalCount} 保存到数据库失败:`, err);
    });
  }
}); 