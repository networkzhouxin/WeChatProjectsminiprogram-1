// pages/index/index.js
// 移除静态相册数据
Page({
  data: {
    albumList: [], // 改为空数组，从云端加载
    currentTab: 0,
    currentImages: [],
    groupedImages: [],
    isLoading: false,
    hasMore: false,
    page: 1,
    uploadedImagesByTab: [], // 每个tab栏对应的上传图片数组
    isEditingTab: false,
    editingTabIndex: -1,
    editingTabName: '',
    showTabActions: false,
    tabActionIndex: -1,
    showAddTagModal: false,
    newTagName: '',
    scrollIntoView: '', // 用于控制滚动到指定标签
    
    // 上传相关数据
    showUploadForm: false,
    tempImageFiles: [],
    uploadDesc: '',
    
    // 下拉刷新状态
    refreshing: false
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
      
      // 先加载标签分类数据
      this.loadAlbumCategories();
    }
  },
  
  // 页面显示时刷新数据
  onShow() {
    // 如果已经加载过相册分类，则直接刷新图片数据
    if (this.data.albumList && this.data.albumList.length > 0) {
      this.loadCloudImages();
    }
  },
  
  // 从云函数获取标签分类数据
  loadAlbumCategories() {
    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '加载相册...',
      });
      
      // 从云数据库获取所有照片的标签信息，统计分类
      const db = wx.cloud.database();
      
      // 先查询所有照片，获取标签信息
      wx.cloud.callFunction({
        name: 'getPhotoList',
        data: {}
      }).then(res => {
        console.log('获取照片列表成功:', res);
        
        if (res.result && res.result.photoList) {
          const photos = res.result.photoList;
          
          // 统计标签分类
          const tagMap = new Map();
          
          // 为每个标签创建一个分类
          photos.forEach(photo => {
            const tag = photo.tag || '未分类';
            if (!tagMap.has(tag)) {
              tagMap.set(tag, {
                id: tagMap.size + 1,
                title: tag,
                images: []
              });
            }
          });
          
          // 如果没有任何分类，创建一个默认分类
          if (tagMap.size === 0) {
            tagMap.set('未分类', {
              id: 1,
              title: '未分类',
              images: []
            });
          }
          
          // 将Map转为数组
          const albumList = Array.from(tagMap.values());
          
          // 初始化uploadedImagesByTab数组，长度与albumList一致
          const uploadedImagesByTab = new Array(albumList.length).fill().map(() => []);
          
          this.setData({
            albumList,
            uploadedImagesByTab
          }, () => {
            // 加载云端的图片数据
            this.loadCloudImages().then(() => {
              wx.hideLoading();
              resolve();
            }).catch(err => {
              wx.hideLoading();
              reject(err);
            });
          });
        } else {
          // 没有照片数据，创建默认分类
          const defaultAlbumList = [{
            id: 1,
            title: '未分类',
            images: []
          }];
          
          this.setData({
            albumList: defaultAlbumList,
            uploadedImagesByTab: [[]]
          });
          
          wx.hideLoading();
          resolve();
        }
      }).catch(err => {
        console.error('获取照片列表失败:', err);
        
        // 出错时创建默认分类
        const defaultAlbumList = [{
          id: 1,
          title: '未分类',
          images: []
        }];
        
        this.setData({
          albumList: defaultAlbumList,
          uploadedImagesByTab: [[]]
        });
        
        wx.hideLoading();
        
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        
        reject(err);
      });
    });
  },
  
  // 从云数据库加载图片
  loadCloudImages() {
    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '加载图片...',
      });
      
      // 调用云函数获取所有照片
      wx.cloud.callFunction({
        name: 'getPhotoList',
        data: {}
      }).then(res => {
        console.log('获取照片列表成功:', res);
        
        if (res.result && res.result.photoList && res.result.photoList.length > 0) {
          const photos = res.result.photoList;
          
          // 按标签分组照片
          const uploadedByTag = new Array(this.data.albumList.length).fill().map(() => []);
          
          photos.forEach(photo => {
            // 根据tag将图片分配到对应标签
            let tabIndex = 0; // 默认放在第一个标签
            
            // 查找图片标签对应的相册索引
            for (let i = 0; i < this.data.albumList.length; i++) {
              if (this.data.albumList[i].title === photo.tag) {
                tabIndex = i;
                break;
              }
            }
            
            // 构建图片对象
            const imageObj = {
              id: 'upload_' + tabIndex + '_' + photo._id, // 生成唯一ID
              src: photo.tempFileURL || '', // 使用云函数返回的临时链接
              width: 800, // 假设宽度
              height: 800, // 假设高度
              desc: photo.desc || '',
              date: this.formatDate(new Date(photo.uploadTime)),
              cloudID: photo._id,
              fileID: photo.fileID
            };
            
            // 添加到对应标签的上传图片数组
            uploadedByTag[tabIndex].push(imageObj);
          });
          
          this.setData({
            uploadedImagesByTab: uploadedByTag
          }, () => {
            // 更新当前显示的图片
            this.setInitialImages();
            wx.hideLoading();
            resolve();
          });
        } else {
          this.setInitialImages();
          wx.hideLoading();
          resolve();
        }
      }).catch(err => {
        console.error('加载云图片失败:', err);
        wx.hideLoading();
        
        // 确保初始化当前图片
        this.setInitialImages();
        
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        
        reject(err);
      });
    });
  },

  // 设置初始图片列表
  setInitialImages() {
    if (this.data.albumList && this.data.albumList.length > 0) {
      const currentTab = this.data.currentTab;
      // 不再使用本地mock数据
      const currentAlbumImages = [];
      const currentTabUploadedImages = this.data.uploadedImagesByTab[currentTab] || [];
      
      // 使用从云端加载的图片
      const currentImages = [...currentTabUploadedImages];
      
      this.setData({
        currentImages
      }, () => {
        this.groupImagesByDate();
      });
    }
  },

  // 监听页面的tabItem点击事件
  onTabItemTap(item) {
    console.log('点击了相册', item);
    
    // 点击当前页面的底部标签时，刷新相册数据
    if (item.index === 0) { // 相册标签的index为0
      // 重新加载相册分类和图片
      this.loadAlbumCategories();
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }
  },
  
  // 检查集合是否存在
  checkCollectionExists() {
    const db = wx.cloud.database();
    
    // 获取所有集合名称
    wx.cloud.callFunction({
      name: 'getCollections',
      data: {}
    }).then(res => {
      console.log('数据库中的集合:', res.result);
    }).catch(err => {
      console.error('获取集合列表失败:', err);
      console.log('请确保云函数已创建并上传');
    });
  },
  
  // 创建测试数据
  createTestPhotoRecord() {
    const db = wx.cloud.database();
    
    // 尝试添加一条测试数据
    db.collection('photos').add({
      data: {
        title: '测试相片',
        url: 'https://example.com/test.jpg',
        createTime: db.serverDate()
      }
    }).then(res => {
      console.log('成功创建测试数据:', res);
    }).catch(err => {
      console.error('创建测试数据失败:', err);
    });
  },

  // 按日期对图片进行分组
  groupImagesByDate() {
    const currentImages = this.data.currentImages;
    const groupedObj = {};
    
    // 对图片按日期分组
    currentImages.forEach(image => {
      // 为上传图片添加日期（如果没有）
      const date = image.date || this.formatDate(new Date());
      
      if (!groupedObj[date]) {
        groupedObj[date] = [];
      }
      groupedObj[date].push(image);
    });
    
    // 将对象转换为数组，并按日期倒序排列
    const groupedArray = Object.keys(groupedObj).map(date => {
      return {
        date: date,
        formattedDate: this.formatDisplayDate(date),
        images: groupedObj[date]
      };
    }).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    this.setData({
      groupedImages: groupedArray,
      hasMore: false
    });
  },
  
  // 格式化日期
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // 格式化显示的日期
  formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 获取今天、昨天的日期
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const todayStr = this.formatDate(today);
    const yesterdayStr = this.formatDate(yesterday);
    
    // 严格比较字符串
    if (String(dateStr).trim() === String(todayStr).trim()) {
      return '今天';
    } else if (String(dateStr).trim() === String(yesterdayStr).trim()) {
      return '昨天';
    } else {
      return `${year}年${month}月${day}日`;
    }
  },

  // 标签页切换事件
  onTabChange(e) {
    // 如果正在编辑标签，则不进行切换
    if (this.data.isEditingTab) {
      return;
    }
    
    const currentTab = e.currentTarget.dataset.index;
    this.setData({
      currentTab,
      page: 1,
      isLoading: false,
      showTabActions: false,
      // 先清空滚动定位
      scrollIntoView: ''
    }, () => {
      // 切换标签时刷新云端数据
      this.loadCloudImages();
      
      // 使用nextTick确保DOM更新后再滚动
      wx.nextTick(() => {
        setTimeout(() => {
          this.setData({
            scrollIntoView: `tab-${currentTab}`
          });
        }, 80);
      });
    });
  },

  // 长按标签显示操作菜单
  onTabLongPress(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      showTabActions: true,
      tabActionIndex: index
    });
  },

  // 关闭标签操作菜单
  closeTabActions() {
    this.setData({
      showTabActions: false,
      tabActionIndex: -1
    });
  },

  // 开始编辑标签名
  startEditTab() {
    const index = this.data.tabActionIndex;
    const tabName = this.data.albumList[index].title;
    
    this.setData({
      isEditingTab: true,
      editingTabIndex: index,
      editingTabName: tabName,
      showTabActions: false
    });
  },

  // 输入标签名
  onTabNameInput(e) {
    console.log('输入标签名:', e.detail.value); // 调试输出
    this.setData({
      editingTabName: e.detail.value
    });
  },

  // 确认标签名修改
  confirmTabEdit() {
    const { editingTabIndex, editingTabName } = this.data;
    console.log('确认修改标签名:', editingTabIndex, editingTabName); // 调试输出
    
    if (editingTabName.trim() === '') {
      wx.showToast({
        title: '标签名不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 更新标签名
    const albumList = [...this.data.albumList];
    albumList[editingTabIndex].title = editingTabName;
    
    this.setData({
      albumList,
      isEditingTab: false,
      editingTabIndex: -1,
      editingTabName: '',
      // 先清空滚动定位
      scrollIntoView: ''
    }, () => {
      // 使用nextTick和延迟使滚动更平滑
      wx.nextTick(() => {
        setTimeout(() => {
          this.setData({
            scrollIntoView: `tab-${editingTabIndex}`
          });
        }, 100);
      });
      
      wx.showToast({
        title: '标签已重命名',
        icon: 'success'
      });
    });
  },

  // 取消标签编辑
  cancelTabEdit() {
    console.log('取消编辑标签'); // 调试输出
    // 保留此函数但不再使用模糊事件调用它
    this.setData({
      isEditingTab: false,
      editingTabIndex: -1,
      editingTabName: ''
    });
  },

  // 删除标签
  deleteTab() {
    const index = this.data.tabActionIndex;
    
    wx.showModal({
      title: '删除标签',
      content: `确定要删除"${this.data.albumList[index].title}"标签及其下的所有图片吗？`,
      success: (res) => {
        if (res.confirm) {
          // 删除标签及其图片
          const albumList = [...this.data.albumList];
          const uploadedImagesByTab = [...this.data.uploadedImagesByTab];
          
          albumList.splice(index, 1);
          uploadedImagesByTab.splice(index, 1);
          
          // 调整当前选中的标签
          let currentTab = this.data.currentTab;
          if (currentTab >= albumList.length) {
            currentTab = Math.max(0, albumList.length - 1);
          } else if (currentTab === index) {
            currentTab = Math.max(0, index - 1);
          } else if (currentTab > index) {
            currentTab = currentTab - 1;
          }
          
          this.setData({
            albumList,
            uploadedImagesByTab: [...uploadedImagesByTab, []],
            currentTab,
            showTabActions: false,
            tabActionIndex: -1,
            // 先清空滚动定位
            scrollIntoView: ''
          }, () => {
            this.setInitialImages();
            
            // 使用nextTick和延迟使滚动更平滑
            wx.nextTick(() => {
              setTimeout(() => {
                this.setData({
                  scrollIntoView: `tab-${currentTab}`
                });
              }, 150);
            });
            
            wx.showToast({
              title: '标签已删除',
              icon: 'success'
            });
          });
        } else {
          this.closeTabActions();
        }
      }
    });
  },

  // 添加新标签 - 显示弹窗
  addNewTab() {
    this.setData({
      showAddTagModal: true,
      newTagName: ''
    });
  },

  // 关闭添加标签弹窗
  closeAddTagModal() {
    this.setData({
      showAddTagModal: false,
      newTagName: ''
    });
  },

  // 新标签名输入
  onNewTagNameInput(e) {
    this.setData({
      newTagName: e.detail.value
    });
  },

  // 确认添加新标签
  confirmAddTag() {
    const { newTagName } = this.data;
    
    if (newTagName.trim() === '') {
      wx.showToast({
        title: '标签名不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 创建新的相册标签
    const albumList = [...this.data.albumList];
    const uploadedImagesByTab = [...this.data.uploadedImagesByTab];
    
    // 生成新的ID
    const maxId = Math.max(...albumList.map(album => album.id), 0);
    
    // 添加新标签
    albumList.push({
      id: maxId + 1,
      title: newTagName.trim(),
      images: []
    });
    
    // 为新标签添加上传图片数组
    uploadedImagesByTab.push([]);
    
    const newTabIndex = albumList.length - 1;
    
    this.setData({
      albumList,
      uploadedImagesByTab,
      currentTab: newTabIndex,
      showAddTagModal: false,
      newTagName: '',
      // 先清空滚动定位，避免立即跳转
      scrollIntoView: ''
    }, () => {
      this.setInitialImages();
      
      // 让界面先渲染完成，分两步执行滚动，体验更平滑
      wx.nextTick(() => {
        // 先短暂延迟，等待DOM渲染和动画准备
        setTimeout(() => {
          this.setData({
            scrollIntoView: `tab-${newTabIndex}`
          });
        }, 150);
      });
      
      wx.showToast({
        title: '标签已创建',
        icon: 'success'
      });
    });
  },

  // 图片点击事件
  onImageTap(e) {
    const { id } = e.currentTarget.dataset;
    const currentImages = this.data.currentImages;
    const imageIndex = currentImages.findIndex(item => item.id === id);
    
    if (imageIndex >= 0) {
      // 查找需要预览的图片
      const selectedImage = currentImages[imageIndex];
      
      // 如果是云存储图片（以upload_开头的ID）
      if (String(id).startsWith('upload_')) {
        // 获取所有需要预览的图片fileID
        const fileIDList = currentImages
          .filter(img => String(img.id).startsWith('upload_'))
          .map(img => img.fileID);
        
        // 获取最新的临时访问链接
        wx.cloud.getTempFileURL({
          fileList: fileIDList,
          success: res => {
            // 构建fileID到URL的映射
            const urlMap = {};
            res.fileList.forEach(file => {
              urlMap[file.fileID] = file.tempFileURL;
            });
            
            // 构建预览图片URL数组
            const previewUrls = currentImages.map(img => {
              if (String(img.id).startsWith('upload_') && img.fileID) {
                // 云存储图片使用最新临时链接
                return urlMap[img.fileID] || img.src;
              } else {
                // 本地图片直接使用src
                return img.src;
              }
            });
            
            // 使用预览图片API
            wx.previewImage({
              current: previewUrls[imageIndex],
              urls: previewUrls
            });
          },
          fail: err => {
            console.error('获取预览链接失败:', err);
            // 退回到原来的方式，直接使用现有链接
            const imageUrls = currentImages.map(item => item.src);
            wx.previewImage({
              current: imageUrls[imageIndex],
              urls: imageUrls
            });
          }
        });
      } else {
        // 非云存储图片，直接使用现有链接
        const imageUrls = currentImages.map(item => item.src);
        wx.previewImage({
          current: imageUrls[imageIndex],
          urls: imageUrls
        });
      }
    }
  },

  // 显示上传表单
  uploadImage() {
    this.setData({
      showUploadForm: true,
      tempImageFiles: [],
      uploadDesc: ''
    });
  },
  
  // 关闭上传表单
  closeUploadForm() {
    this.setData({
      showUploadForm: false,
      tempImageFiles: []
    });
  },
  
  // 选择图片
  chooseImages() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: res => {
        console.log('选择图片成功:', res);
        this.setData({
          tempImageFiles: res.tempFiles
        });
      }
    });
  },
  
  // 添加更多图片
  addMoreImages() {
    const currentCount = this.data.tempImageFiles.length;
    
    wx.chooseMedia({
      count: 9 - currentCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: res => {
        console.log('选择更多图片成功:', res);
        this.setData({
          tempImageFiles: [...this.data.tempImageFiles, ...res.tempFiles]
        });
      }
    });
  },
  
  // 移除临时图片
  removeTempImage(e) {
    const { index } = e.currentTarget.dataset;
    const tempImageFiles = [...this.data.tempImageFiles];
    tempImageFiles.splice(index, 1);
    
    this.setData({
      tempImageFiles
    });
  },
  
  // 输入上传描述
  onUploadDescInput(e) {
    this.setData({
      uploadDesc: e.detail.value
    });
  },
  
  // 确认上传图片
  confirmUpload() {
    const { tempImageFiles, uploadDesc, currentTab } = this.data;
    const tag = this.data.albumList[currentTab].title;
    
    if (tempImageFiles.length === 0) {
      wx.showToast({
        title: '请选择图片',
        icon: 'none'
      });
      return;
    }
    
    // 显示上传进度
    wx.showLoading({
      title: '上传中...',
    });
    
    // 依次上传每张图片
    const uploadTasks = tempImageFiles.map((file, index) => {
      return this.uploadSingleImage(file, tag, uploadDesc, index, tempImageFiles.length);
    });
    
    // 所有图片上传完成后
    Promise.all(uploadTasks)
      .then(results => {
        console.log('所有图片上传完成:', results);
        
        wx.hideLoading();
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
        
        // 关闭上传表单
        this.setData({
          showUploadForm: false,
          tempImageFiles: []
        });
        
        // 重新加载云图片
        this.loadCloudImages();
      })
      .catch(err => {
        console.error('图片上传失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      });
  },
  
  // 上传单张图片
  uploadSingleImage(file, tag, desc, index, total) {
    return new Promise((resolve, reject) => {
      const cloudPath = `photos/${Date.now()}_${index}.${file.tempFilePath.match(/\.(\w+)$/)[1]}`;
      
      // 1. 上传文件到云存储
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: file.tempFilePath,
        success: res => {
          console.log('上传到云存储成功:', res);
          const fileID = res.fileID;
          
          // 2. 调用云函数，保存图片信息到数据库
          wx.cloud.callFunction({
            name: 'uploadImage',
            data: {
              fileID: fileID,
              tag: tag,
              desc: desc || ''
            },
            success: result => {
              console.log('保存图片信息成功:', result);
              resolve(result);
            },
            fail: err => {
              console.error('调用云函数失败:', err);
              reject(err);
            }
          });
        },
        fail: err => {
          console.error('上传到云存储失败:', err);
          reject(err);
        }
      });
    });
  },

  // 图片描述修改事件
  onDescChange(e) {
    const { id } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    // 更新当前显示的图片描述
    const currentImages = this.data.currentImages.map(item => {
      if (item.id === id) {
        return { ...item, desc: value };
      }
      return item;
    });

    this.setData({ 
      currentImages 
    }, () => {
      // 更新分组后的图片描述
      this.updateGroupedImageDesc(id, value);
    });
  },
  
  // 更新分组后的图片描述
  updateGroupedImageDesc(id, value) {
    const groupedImages = this.data.groupedImages.map(group => {
      const updatedImages = group.images.map(img => {
        if (img.id === id) {
          return { ...img, desc: value };
        }
        return img;
      });
      return { ...group, images: updatedImages };
    });
    
    this.setData({ groupedImages });
  },

  // 图片描述确认修改（失去焦点或点击完成）
  onDescConfirm(e) {
    const { id } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    // 更新上传图片的描述（如果是上传的图片）
    if (id.toString().startsWith('upload_')) {
      // 解析ID获取tab索引
      const parts = id.split('_');
      const tabIndex = parseInt(parts[1]);
      
      // 更新对应tab的上传图片数组
      const uploadedImagesByTab = [...this.data.uploadedImagesByTab];
      
      if (uploadedImagesByTab[tabIndex]) {
        uploadedImagesByTab[tabIndex] = uploadedImagesByTab[tabIndex].map(item => {
          if (item.id === id) {
            return { ...item, desc: value };
          }
          return item;
        });
        
        this.setData({ uploadedImagesByTab });
      }
    } else {
      // 更新相册中原有图片的描述
      const albumList = this.data.albumList.map(album => {
        const images = album.images.map(img => {
          if (img.id === id) {
            return { ...img, desc: value };
          }
          return img;
        });
        return { ...album, images };
      });
      
      this.setData({ albumList });
    }
    
    wx.showToast({
      title: '修改成功',
      icon: 'success',
      duration: 1000
    });
  },

  // 点击编辑图标事件
  onEditDesc(e) {
    const { id } = e.currentTarget.dataset;
    // 获取该图片对应的输入框并聚焦
    const query = wx.createSelectorQuery();
    query.select(`.image-desc[data-id="${id}"]`).fields({
      node: true,
      size: true,
    }, function(res) {
      res.node && res.node.focus();
    }).exec();
  },

  // 触底加载更多 (模拟)
  onReachBottom() {
    if (this.data.isLoading || !this.data.hasMore) return;
    
    this.setData({ isLoading: true });
    
    // 模拟加载更多数据
    setTimeout(() => {
      this.setData({
        isLoading: false,
        hasMore: false
      });
    }, 1000);
  },

  copyCode(e) {
    const code = e.target?.dataset?.code || '';
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '已复制',
        })
      },
      fail: (err) => {
        console.error('复制失败-----', err);
      }
    })
  },

  discoverCloud() {
    wx.switchTab({
      url: '/pages/examples/index',
    })
  },

  gotoGoodsListPage() {
    wx.navigateTo({
      url: '/pages/goods-list/index',
    })
  },

  // 开启下拉刷新
  onPullDownRefresh() {
    // 设置刷新状态
    this.setData({
      refreshing: true
    });
    
    // 重新加载相册分类和图片
    this.loadAlbumCategories().then(() => {
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
      
      this.setData({
        refreshing: false
      });
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }).catch(err => {
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
      
      this.setData({
        refreshing: false
      });
      
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1000
      });
    });
  },
});
