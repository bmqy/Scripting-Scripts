// 在主脚本中清除今日的限号缓存
try {
  // 检查scripting模块是否可用
  const scripting = require('scripting');
  if (scripting && scripting.Storage) {
    scripting.Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`);
    console.log('缓存清除成功');
  } else {
    console.log('scripting模块可用，但Storage不可用');
  }
} catch (error) {
  console.log('scripting模块导入错误:', error.message);
}
