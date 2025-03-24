Component({
  properties: {
    albumTitle: {
      type: String,
      value: ''
    },
    count: {
      type: Number,
      value: 0
    }
  },

  data: {
    countText: ''
  },

  lifetimes: {
    attached() {
      this.updateCountText();
    }
  },

  observers: {
    'count': function(count) {
      this.updateCountText();
    }
  },

  methods: {
    updateCountText() {
      const count = this.data.count || 0;
      let countText = '';
      
      if (count > 0) {
        countText = `${count}张`;
      } else {
        countText = '暂无照片';
      }
      
      this.setData({
        countText
      });
    },
    
    onTap() {
      this.triggerEvent('click');
    }
  }
}) 