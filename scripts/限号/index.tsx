// 在主脚本中清除今日的限号缓存
import { Storage } from 'scripting'
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)