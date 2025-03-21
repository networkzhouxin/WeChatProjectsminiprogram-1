// pages/index/index.js
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
      
      console.log('当前日期:', currentDate);
      
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
        
        console.log('添加了新图片:', uploadedImages);
        
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

// 修改日期比较方式
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
  
  console.log('比较日期:', dateStr, '今天:', todayStr, '是否相等:', dateStr === todayStr);
  
  // 严格比较字符串
  if (String(dateStr).trim() === String(todayStr).trim()) {
    return '今天';
  } else if (String(dateStr).trim() === String(yesterdayStr).trim()) {
    return '昨天';
  } else {
    return `${year}年${month}月${day}日`;
  }
}, 