// 提供对babel运行时关键函数的实现

// arrayWithoutHoles实现
function arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}

function arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return arrayLikeToArray(arr);
}

// 将这些函数绑定到全局对象
if (typeof window !== 'undefined') {
  window.arrayWithoutHoles = arrayWithoutHoles;
  window.arrayLikeToArray = arrayLikeToArray;
} else if (typeof global !== 'undefined') {
  global.arrayWithoutHoles = arrayWithoutHoles;
  global.arrayLikeToArray = arrayLikeToArray;
}

// 在小程序环境中提供全局对象
if (typeof wx !== 'undefined') {
  if (!wx.__babelPolyfill) {
    wx.__babelPolyfill = true;
    wx.arrayWithoutHoles = arrayWithoutHoles;
    wx.arrayLikeToArray = arrayLikeToArray;
  }
}

module.exports = {
  arrayWithoutHoles,
  arrayLikeToArray
}; 