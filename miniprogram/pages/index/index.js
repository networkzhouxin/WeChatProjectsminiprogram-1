// pages/index/index.js
// 相册数据
const albumData = [
  {
    id: 1,
    title: '风景',
    images: [
      { id: 101, src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', width: 800, height: 1200, desc: '山水瀑布', date: '2023-05-15' },
      { id: 102, src: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=800&q=80', width: 800, height: 600, desc: '湖光山色', date: '2023-05-15' },
      { id: 103, src: 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=800&q=80', width: 800, height: 800, desc: '星空银河', date: '2023-05-20' },
      { id: 104, src: 'https://images.unsplash.com/photo-1546514355-7fdc90ccbd03?w=800&q=80', width: 800, height: 1000, desc: '雪山风光', date: '2023-05-20' },
      { id: 105, src: 'https://images.unsplash.com/photo-1433477155337-9aea4e790195?w=800&q=80', width: 800, height: 750, desc: '海岸日落', date: '2023-06-10' },
      { id: 106, src: 'https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=800&q=80', width: 800, height: 900, desc: '绿色山谷', date: '2023-06-10' }
    ]
  },
  {
    id: 2,
    title: '人物',
    images: [
      { id: 201, src: 'https://images.unsplash.com/photo-1530785602389-07594beb8b73?w=800&q=80', width: 800, height: 1000, desc: '人像摄影', date: '2023-06-05' },
      { id: 202, src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80', width: 800, height: 1200, desc: '微笑女孩', date: '2023-06-05' },
      { id: 203, src: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=800&q=80', width: 800, height: 800, desc: '黑白人像', date: '2023-06-20' },
      { id: 204, src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80', width: 800, height: 600, desc: '商务人士', date: '2023-06-20' }
    ]
  },
  {
    id: 3,
    title: '城市',
    images: [
      { id: 301, src: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=800&q=80', width: 800, height: 900, desc: '城市天际线', date: '2023-07-01' },
      { id: 302, src: 'https://images.unsplash.com/photo-1502899576159-f224dc2349fa?w=800&q=80', width: 800, height: 1000, desc: '繁华都市', date: '2023-07-01' },
      { id: 303, src: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80', width: 800, height: 800, desc: '城市夜景', date: '2023-07-15' },
      { id: 304, src: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80', width: 800, height: 1200, desc: '古典建筑', date: '2023-07-15' },
      { id: 305, src: 'https://images.unsplash.com/photo-1471039497385-b6d6ba609f9c?w=800&q=80', width: 800, height: 750, desc: '城市街道', date: '2023-07-20' }
    ]
  },
  {
    id: 4,
    title: '美食',
    images: [
      { id: 401, src: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80', width: 800, height: 900, desc: '精致甜点', date: '2023-08-01' },
      { id: 402, src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', width: 800, height: 1000, desc: '美味佳肴', date: '2023-08-01' },
      { id: 403, src: 'https://images.unsplash.com/photo-1484980972926-edee96e0960d?w=800&q=80', width: 800, height: 800, desc: '健康沙拉', date: '2023-08-10' },
      { id: 404, src: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=800&q=80', width: 800, height: 1200, desc: '咖啡艺术', date: '2023-08-10' },
      { id: 405, src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', width: 800, height: 750, desc: '缤纷蔬果', date: '2023-08-15' }
    ]
  }
];

Page({
  data: {
    albumList: albumData,
    currentTab: 0,
    currentImages: [],
    groupedImages: [],
    isLoading: false,
    hasMore: false,
    page: 1,
    uploadedImagesByTab: [[], [], [], []], // 每个tab栏对应的上传图片数组
    isEditingTab: false,
    editingTabIndex: -1,
    editingTabName: '',
    showTabActions: false,
    tabActionIndex: -1,
    showAddTagModal: false,
    newTagName: '',
    scrollIntoView: '' // 用于控制滚动到指定标签
  },

  onLoad() {
    this.setInitialImages();
  },

  // 设置初始图片列表
  setInitialImages() {
    if (this.data.albumList && this.data.albumList.length > 0) {
      const currentTab = this.data.currentTab;
      const currentAlbumImages = [...this.data.albumList[currentTab].images];
      const currentTabUploadedImages = this.data.uploadedImagesByTab[currentTab] || [];
      
      // 将当前tab栏上传的图片与原有图片合并显示
      const currentImages = [...currentTabUploadedImages, ...currentAlbumImages];
      
      this.setData({
        currentImages
      }, () => {
        this.groupImagesByDate();
      });
    }
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
      this.setInitialImages();
      
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
      const imageUrls = currentImages.map(item => item.src);
      wx.previewImage({
        current: imageUrls[imageIndex],
        urls: imageUrls
      });
    }
  },

  // 上传图片
  uploadImage() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 上传成功后，将选择的图片添加到当前标签页的上传列表
        const tempFiles = res.tempFiles;
        const currentTab = this.data.currentTab;
        const currentDate = this.formatDate(new Date());
        
        const uploadedImages = tempFiles.map((file, index) => {
          const timestamp = new Date().getTime();
          return {
            id: `upload_${currentTab}_${timestamp}_${index}`,
            src: file.tempFilePath,
            width: file.width || 800,
            height: file.height || 800,
            desc: `${this.data.albumList[currentTab].title}相册`,
            date: currentDate
          };
        });

        // 获取当前tab栏的上传图片数组
        const uploadedImagesByTab = [...this.data.uploadedImagesByTab];
        uploadedImagesByTab[currentTab] = [...(uploadedImagesByTab[currentTab] || []), ...uploadedImages];
        
        this.setData({
          uploadedImagesByTab
        }, () => {
          // 更新当前显示的图片
          const currentImages = [...uploadedImages, ...this.data.currentImages];
          
          this.setData({ 
            currentImages 
          }, () => {
            // 重新按日期分组
            this.groupImagesByDate();
          });
          
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
        wx.showToast({
          title: '上传失败',
          icon: 'error'
        });
      }
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
});
