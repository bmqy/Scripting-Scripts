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
