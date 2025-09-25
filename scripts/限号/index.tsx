// 在主脚本中清除今日的限号缓存
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)