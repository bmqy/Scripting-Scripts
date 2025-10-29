// 在主脚本中清除今日的限号缓存
// 根据官方文档，Storage是全局可用对象，不需要特殊导入
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)
