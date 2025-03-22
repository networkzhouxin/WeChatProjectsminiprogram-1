// app.js
// 添加polyfill支持
require('./utils/babel-polyfill.js');

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true,
      });
      
      // 初始化云环境后，检查并创建必要的集合
      this.initCloudCollection();
    }

    this.globalData = {};
  },
  
  // 检查并创建必要的集合
  initCloudCollection: function() {
    const db = wx.cloud.database();
    
    // 检查photos集合是否存在，如果不存在则创建
    db.collection('photos').count()
      .then(res => {
        console.log('photos集合已存在', res);
      })
      .catch(err => {
        console.error('检查photos集合失败', err);
        
        // 创建一条测试数据，集合将被自动创建
        if (err.errCode === -100) {
          console.log('尝试创建photos集合');
          db.collection('photos').add({
            data: {
              test: true,
              createdTime: db.serverDate()
            }
          }).then(res => {
            console.log('成功创建photos集合', res);
          }).catch(err => {
            console.error('创建photos集合失败', err);
          });
        }
      });
  }
});
