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
    validPhotoCount: 0, // 有效照片数量
    
    // 新增: 分组后的照片列表
    groupedPhotoList: [],
    // 今天、昨天、以前的日期
    today: '',
    yesterday: '',
    needRefresh: false // 是否需要刷新数据
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

      // 设置今天和昨天的日期
      this.setTodayAndYesterday();
      
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
  
  // 设置今天和昨天的日期
  setTodayAndYesterday() {
    const now = new Date();
    
    // 格式化今天的日期 YYYY/MM/DD
    const today = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    
    // 计算昨天
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;
    
    this.setData({
      today,
      yesterday: yesterdayStr
    });
    
    console.log('设置今天和昨天:', today, yesterdayStr);
  },

  // 页面显示时刷新数据
  onShow() {
    // 只有在需要刷新时才重新加载数据
    if (this.data.needRefresh) {
      console.log('需要刷新相册数据:', this.data.albumTitle);
      this.loadPhotoList().then(() => {
        this.setData({ needRefresh: false });
      });
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

  // 根据日期对照片进行分组
  groupPhotosByDate(photoList) {
    // 确保照片列表存在
    if (!photoList || photoList.length === 0) {
      return [];
    }

    const { today, yesterday } = this.data;
    const groupMap = new Map();

    // 遍历照片并按日期分组
    photoList.forEach(photo => {
      // 确保每个照片有创建时间
      let dateStr = '未知时间';
      let sortDate = new Date(0); // 默认时间戳为0的日期
      
      // 从createTime提取日期 - 支持多种格式
      if (photo.createTime) {
        let createDate;
        
        // 尝试解析照片创建时间
        if (typeof photo.createTime === 'string') {
          // 如果是字符串，尝试解析
          createDate = new Date(photo.createTime);
        } else if (photo.createTime instanceof Date) {
          // 如果已经是Date对象
          createDate = photo.createTime;
        } else if (photo.createTime._seconds) {
          // Firestore时间戳
          createDate = new Date(photo.createTime._seconds * 1000);
        }
        
        // 如果成功解析了日期
        if (createDate && !isNaN(createDate.getTime())) {
          sortDate = createDate;
          
          // 格式化为 YYYY/MM/DD
          dateStr = `${createDate.getFullYear()}/${String(createDate.getMonth() + 1).padStart(2, '0')}/${String(createDate.getDate()).padStart(2, '0')}`;
          
          // 替换为"今天"或"昨天"
          if (dateStr === today) {
            dateStr = '今天';
          } else if (dateStr === yesterday) {
            dateStr = '昨天';
          }
        }
      }
      
      // 将照片添加到对应日期组
      if (!groupMap.has(dateStr)) {
        groupMap.set(dateStr, {
          title: dateStr,
          sortDate: sortDate, // 用于排序
          items: []
        });
      }
      
      groupMap.get(dateStr).items.push(photo);
    });
    
    // 将Map转换为数组
    let groupArray = Array.from(groupMap.values());
    
    // 按日期从新到旧排序
    groupArray.sort((a, b) => b.sortDate - a.sortDate);
    
    // 每个组内的照片也按创建时间从新到旧排序
    groupArray.forEach(group => {
      group.items.sort((a, b) => {
        const timeA = a.createTime ? (a.createTime._seconds ? a.createTime._seconds * 1000 : new Date(a.createTime).getTime()) : 0;
        const timeB = b.createTime ? (b.createTime._seconds ? b.createTime._seconds * 1000 : new Date(b.createTime).getTime()) : 0;
        return timeB - timeA;
      });
    });
    
    return groupArray;
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
        
        // 按照上传时间对照片进行分组
        const groupedPhotoList = this.groupPhotosByDate(processedPhotoList);
        
        // 设置照片列表和状态
        this.setData({
          photoList: processedPhotoList,
          groupedPhotoList: groupedPhotoList,
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
          groupedPhotoList: [],
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
        groupedPhotoList: [],
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
    const dateGroup = e.currentTarget.dataset.dateGroup;
    
    // 在对应的日期组中查找照片
    const group = this.data.groupedPhotoList.find(g => g.title === dateGroup);
    if (!group) {
      console.error('找不到对应的日期组:', dateGroup);
      return;
    }
    
    const photo = group.items[index];
    if (!photo) {
      console.error('找不到对应的照片:', index);
      return;
    }
    
    // 找到当前组中所有照片的URL
    const urls = group.items.map(photo => photo.tempFileURL || photo.fileID || '');
    
    // 过滤掉空链接
    const validUrls = urls.filter(url => url && url.trim() !== '');
    
    // 确保当前图片URL有效
    const currentUrl = photo.tempFileURL || photo.fileID || '';
    
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
    const dateGroup = e.currentTarget.dataset.dateGroup;
    
    // 在对应的日期组中查找照片
    const group = this.data.groupedPhotoList.find(g => g.title === dateGroup);
    if (!group) {
      console.error('找不到对应的日期组:', dateGroup);
      return;
    }
    
    const photo = group.items[index];
    if (!photo) {
      console.error('找不到对应的照片:', index);
      return;
    }
    
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
        
        // 重新生成分组数据
        const groupedPhotoList = this.groupPhotosByDate(photoList);
        
        this.setData({
          photoList,
          groupedPhotoList,
          isEmpty: photoList.length === 0,
          needRefresh: false // 已经更新了数据，不需要刷新
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
    const dateGroup = e.currentTarget.dataset.dateGroup;
    
    // 在对应的日期组中查找照片
    const groupIndex = this.data.groupedPhotoList.findIndex(g => g.title === dateGroup);
    if (groupIndex < 0) {
      console.error('找不到对应的日期组:', dateGroup);
      return;
    }
    
    const photo = this.data.groupedPhotoList[groupIndex].items[index];
    if (!photo) {
      console.error('找不到对应的照片:', index);
      return;
    }
    
    const photoId = photo.id || photo._id;
    console.error('图片加载错误:', 'group:', dateGroup, 'index:', index, 'id:', photoId);
    
    if (photo.fileID && photo.fileID.trim() !== '') {
      console.log('图片加载失败:', photoId, '尝试使用fileID');
      
      // 创建新的数组以触发视图更新
      const newGroupedPhotoList = [...this.data.groupedPhotoList];
      const newPhoto = {
        ...photo,
        tempFileURL: photo.fileID, // 将临时URL设置为fileID
        _retryCount: (photo._retryCount || 0) + 1
      };
      
      // 更新照片
      newGroupedPhotoList[groupIndex].items[index] = newPhoto;
      
      // 如果已经重试了两次还是失败，尝试重新生成临时URL
      if (newPhoto._retryCount > 2) {
        console.log('多次重试失败，尝试重新获取临时链接');
        
        // 使用fileHelper获取新的临时链接
        fileHelper.getTempFileURL(photo.fileID)
          .then(tempUrl => {
            console.log('重新获取临时链接成功:', tempUrl);
            
            // 更新临时链接
            const updatedGroupedPhotoList = [...this.data.groupedPhotoList];
            if (updatedGroupedPhotoList[groupIndex].items[index]) {
              updatedGroupedPhotoList[groupIndex].items[index].tempFileURL = tempUrl;
              updatedGroupedPhotoList[groupIndex].items[index]._retryCount = 0;
              
              this.setData({
                groupedPhotoList: updatedGroupedPhotoList
              });
            }
          })
          .catch(err => {
            console.error('重新获取临时链接失败:', err);
            // 直接设回fileID
            this.setData({
              groupedPhotoList: newGroupedPhotoList
            });
          });
      } else {
        // 普通重试
        this.setData({
          groupedPhotoList: newGroupedPhotoList
        });
      }
    } else {
      console.error('照片没有有效的fileID，无法显示');
    }
  },

  // 添加新照片
  addNewPhoto() {
    const { albumId, albumTitle } = this.data;
    
    // 跳转到上传页面，并传递相册信息
    wx.navigateTo({
      url: `/pages/upload/index?albumId=${albumId}&albumTitle=${albumTitle}`
    });
    
    // 设置需要刷新标记
    this.setData({ needRefresh: true });
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