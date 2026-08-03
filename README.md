# Scripting App 小组件集合

一个使用Scripting App开发的iOS小组件仓库，包含多个实用的小组件。

## 现有小组件

### 限行小组件

显示所在城市当天的机动车限行尾号信息。

#### 功能特点
- 使用定位功能获取当前城市限行信息
- 每天自动刷新数据

#### 支持的尺寸
- 小号：紧凑显示限行信息
- 中号：更详细的布局，包含更多视觉元素

#### 图片预览
- 锁屏
![锁屏小组件](https://image.bmqy.net/upload/2026-07/微信图片_20260717100834_108_131.jpg)
- 小号
![小号](https://image.bmqy.net/upload/2026-07/微信图片_20260717100836_110_131.jpg)
- 中号 & 大号
![中号 & 大号](https://image.bmqy.net/upload/2026-07/微信图片_20260717100835_109_131.jpg)

### RSS 阅读小组件

显示 Google Reader compatible API 中的未读文章数和最新未读文章，支持 FreshRSS 等自建 RSS 服务，也支持从本地或线上 OPML 文件直接读取 RSS/Atom 订阅源。

#### 功能特点
- 使用 Google Reader 兼容的 `ClientLogin`、`unread-count` 和 `stream/contents` 接口
- 可在设置页选择 API 账号或 OPML 订阅方式；OPML 支持从 Files App 选择本地文件，或填写线上 URL
- OPML 模式直接读取订阅源最新文章，不提供 API 账号模式的未读数和标记已读功能
- 账号凭据优先保存到 Scripting App 的 Keychain；若钥匙串暂时不可用，会保存到当前脚本的私有本地存储，并在设置页面明确提示
- 小号显示未读总数和一篇最新文章；中号显示三篇；大号显示五篇及摘要
- 可选择显示绝对时间或相对时间；默认为绝对时间
- 可在组件配置中选择显示全部未读或某个已订阅的 RSS 源
- 可选择 1 分钟、3 分钟、5 分钟、15 分钟、30 分钟、1 小时或 2 小时的刷新频率；默认 30 分钟
- 网络失败时显示最近一次成功缓存；实际刷新时间由 iOS 系统调度，可能晚于所选频率

#### FreshRSS 配置

1. 在 FreshRSS 的“认证”设置中开启 API 访问，并在“个人资料”设置 API 密码。
2. 在 Scripting App 中运行“RSS 阅读”脚本，输入 FreshRSS 页面提供的 API 地址，例如 `https://rss.example.com/api/greader.php`、用户名和 API 密码。
3. 将 Scripting App 的“RSS 阅读”小组件添加到主屏幕，选择小号、中号或大号。
4. 在脚本设置页的“组件配置”中选择要显示的 RSS 源；选择“全部未读”可恢复默认聚合视图。

其他服务只要提供可拼接 `/accounts/ClientLogin` 和 `/reader/api/0/...` 路径的 Google Reader compatible API 根地址，也可以使用该组件。

#### OPML 配置

在脚本设置页的“订阅方式”中选择“OPML”，再选择“线上 URL”或“本地文件”。线上 URL 会在组件刷新时读取 OPML 并获取当前源文章；本地文件会在导入时解析并保存订阅源清单。OPML 文件需要包含带有 `xmlUrl` 属性的 `<outline>` 节点。



## 开发环境设置

### 前提条件

- **Node.js**：需要版本18或更高
- **Scripting App**：必须在iOS设备上安装
- **scripting-cli**：用于远程开发调试的命令行工具

## 开发流程

### 安装依赖

```bash
npm install
```

### 远程开发调试

此项目支持使用`scripting-cli`进行远程开发调试，步骤如下：

1. 在项目目录中，运行以下命令启动本地开发服务：
   ```bash
   npx scripting-cli start
   ```
   默认情况下，服务将在端口`3000`上启动。如需指定其他端口，请使用`--port`选项：
   ```bash
   npx scripting-cli start --port=4000
   ```
   要启用Bonjour支持，使Scripting App自动检测本地服务，请添加`--bonjour`标志：
   ```bash
   npx scripting-cli start --bonjour
   ```

2. 在iOS设备上打开Scripting App，连接到本地开发服务

3. 在桌面编辑器（如VSCode）中编辑代码

4. 保存文件后，更改将自动同步到Scripting App并执行

### 构建与打包

要构建所有小组件并生成可导入的`.scripting`文件：

```bash
npm run build
```

构建后的文件将位于`dist/`目录下。

## 添加新组件

要在仓库中添加新的Scripting App小组件，请遵循以下步骤：

1. 在`scripts/`目录下创建一个新的子目录，命名为您的组件名称
2. 在该目录中创建必要的文件（至少包含`index.tsx`, `widget.tsx`和`script.json`）
3. 按照Scripting App的开发规范编写组件代码
4. 运行`npm run build`命令，系统会自动打包您的新组件

## 使用方法

### 导入单个组件

1. 确保您的设备已安装Scripting App
2. 导入`dist/`目录下对应组件的`.scripting`文件到Scripting App
3. 在iOS主屏幕上添加小组件
4. 选择"Scripting App"小组件
5. 选择合适的尺寸
6. 选择您导入的小组件

## 注意事项

- 小组件仅供参考，具体功能实现请以实际使用为准
- 部分小组件可能需要特定权限（如定位权限）
- 小组件数据更新频率取决于Scripting App的刷新机制

## 故障排除

如果遇到远程开发调试问题，请确保：
- 使用的是Node.js版本18或更高
- Scripting App已正确连接到本地服务
- 所选端口未被其他进程占用
- 始终使用`npx scripting-cli <command>`运行工具，并确保软件包是最新的

## 贡献

欢迎贡献新的小组件或改进现有功能！请遵循项目的开发规范和提交指南。
