const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 项目根目录
const rootDir = process.cwd();
// scripts目录
const scriptsDir = path.join(rootDir, 'scripts');
// dist目录
const distDir = path.join(rootDir, 'dist');
// 缓存文件，用于记录上次打包的哈希值
const cacheFile = path.join(rootDir, '.build-cache.json');

// 确保dist目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 读取缓存
let cache = {};
if (fs.existsSync(cacheFile)) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (error) {
    console.warn('Failed to read cache file, starting fresh:', error.message);
    cache = {};
  }
}

// dev 分支的 RSS 阅读包需要与正式包并存，因此使用独立的包文件名。
function isDevBranch() {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME === 'dev';

  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim() === 'dev';
  } catch (error) {
    console.warn('Failed to detect current branch:', error.message);
    return false;
  }
}

const devBranch = isDevBranch();

function getArtifactName(scriptName) {
  return devBranch && scriptName === 'RSS阅读' ? `${scriptName}-dev` : scriptName;
}

// 计算目录的哈希值
function calculateDirHash(dirPath) {
  const files = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(scriptsDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const stat = fs.statSync(fullPath);
        files.push({
          path: relativePath,
          content: content,
          mtime: stat.mtimeMs
        });
      }
    }
  }
  
  walk(dirPath);
  // 按路径排序以确保一致性
  files.sort((a, b) => a.path.localeCompare(b.path));
  
  const hash = crypto.createHash('md5');
  for (const file of files) {
    hash.update(`${file.path}:${file.content}:${file.mtime}`);
  }
  
  return hash.digest('hex');
}

// 打包单个脚本
function buildScript(scriptName, scriptPath) {
  console.log(`Building script: ${scriptName}`);
  
  try {
    // 创建临时目录
    const tempDir = path.join(rootDir, '.temp', scriptName);
    console.log(`Creating temp directory: ${tempDir}`);
    
    if (fs.existsSync(tempDir)) {
      console.log(`Removing existing temp directory`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    console.log(`Creating new temp directory structure`);
    // 确保.temp目录存在
    const tempRootDir = path.join(rootDir, '.temp');
    if (!fs.existsSync(tempRootDir)) {
      fs.mkdirSync(tempRootDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`Temp directory created successfully`);
    
    // 检查目录权限
    const stats = fs.statSync(tempDir);
    console.log(`Temp directory stats: ${JSON.stringify(stats, null, 2)}`);
  
  // 复制脚本目录中的所有文件到临时目录
  try {
    console.log(`Copying files from ${scriptPath} to ${tempDir}`);
    const scriptFiles = fs.readdirSync(scriptPath, { withFileTypes: true });
    console.log(`Found ${scriptFiles.length} files/directories to copy`);
    
    for (const file of scriptFiles) {
      const sourcePath = path.join(scriptPath, file.name);
      const targetPath = path.join(tempDir, file.name);
      console.log(`Copying: ${file.name} (${file.isDirectory() ? 'directory' : 'file'})`);
      
      if (file.isDirectory()) {
        console.log(`Copying directory: ${sourcePath} -> ${targetPath}`);
        try {
          // 确保目标目录存在
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }
          // 手动递归复制目录内容，而不是使用cpSync，避免潜在问题
          const dirContents = fs.readdirSync(sourcePath, { withFileTypes: true });
          console.log(`Directory ${file.name} contains ${dirContents.length} items`);
          
          for (const item of dirContents) {
            const itemSource = path.join(sourcePath, item.name);
            const itemTarget = path.join(targetPath, item.name);
            console.log(`Processing ${item.name} in ${file.name}`);
            
            if (item.isDirectory()) {
              // 递归创建子目录
              fs.mkdirSync(itemTarget, { recursive: true });
            } else {
              // 复制文件
              fs.copyFileSync(itemSource, itemTarget);
            }
          }
          console.log(`Directory copied successfully: ${file.name}`);
        } catch (dirCopyError) {
          console.error(`Failed to copy directory ${file.name}:`, dirCopyError);
          throw new Error(`Directory copying failed: ${dirCopyError.message}`);
        }
      } else {
        console.log(`Copying file: ${sourcePath} -> ${targetPath}`);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`File copied successfully: ${file.name}`);
      }
    }
    console.log(`All files copied successfully`);
  } catch (copyError) {
    console.error('Error during file copying:', copyError);
    throw new Error(`File copying failed: ${copyError.message}`);
  }
  
  // 创建zip文件
  const artifactName = getArtifactName(scriptName);
  const outputZip = path.join(distDir, `${artifactName}.zip`);
  const outputScripting = path.join(distDir, `${artifactName}.scripting`);
  console.log(`Output targets: ${outputZip}, ${outputScripting}`);
  
  // 根据操作系统使用不同的命令压缩文件
  try {
    console.log(`Attempting to compress files from ${tempDir}`);
    if (process.platform === 'win32') {
      // PowerShell压缩，确保直接包含临时目录下的文件而不是临时目录本身
      console.log(`Running PowerShell compression command`);
      // 使用更可靠的路径处理，避免路径中有空格等特殊字符导致的问题
      const tempDirEscaped = tempDir.replace(/\\/g, '\\\\');
      const outputZipEscaped = outputZip.replace(/\\/g, '\\\\');
      execSync(`powershell -Command "Get-ChildItem -LiteralPath \"${tempDirEscaped}\" | Compress-Archive -DestinationPath \"${outputZipEscaped}\" -Force"`, {
        stdio: 'inherit'
      });
    } else {
      // Linux/Mac压缩，直接在临时目录内执行命令
      execSync(`zip -r ${outputZip} .`, {
        cwd: tempDir,
        stdio: 'inherit'
      });
    }
    
    if (!fs.existsSync(outputZip)) {
      throw new Error(`Failed to create zip file at ${outputZip}`);
    }
    
    console.log(`Successfully created zip file: ${outputZip}`);
  } catch (compressError) {
    console.error('Error during file compression:', compressError);
    throw new Error(`Compression failed: ${compressError.message}`);
  }
  
  // 重命名为.scripting文件
  try {
    if (fs.existsSync(outputScripting)) {
      console.log(`Removing existing scripting file: ${outputScripting}`);
      fs.unlinkSync(outputScripting);
    }
    
    console.log(`Renaming ${outputZip} to ${outputScripting}`);
    fs.renameSync(outputZip, outputScripting);
    
    // 验证文件是否成功创建
    if (fs.existsSync(outputScripting)) {
      console.log(`Successfully built ${outputScripting}`);
    } else {
      throw new Error(`Failed to create scripting file: ${outputScripting}`);
    }
    
    // 清理临时目录
    console.log(`Cleaning up temp directory: ${tempDir}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (renameError) {
    console.error('Error during file renaming:', renameError);
    throw new Error(`Renaming failed: ${renameError.message}`);
  }
  } catch (error) {
    console.error('Error in buildScript function:', error);
    throw error;
  }
}

// 主函数
function main() {
  try {
    // 检查scripts目录下的所有子目录
    const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
    const scriptDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({ name: entry.name, path: path.join(scriptsDir, entry.name) }));
    
    if (scriptDirs.length === 0) {
      console.log('No scripts found in the scripts directory.');
      return;
    }
    
    let hasUpdates = false;
    
    // 检查每个脚本目录是否有更新
    for (const { name, path: scriptPath } of scriptDirs) {
      const currentHash = calculateDirHash(scriptPath);
      const cachedHash = cache[name];
      
      // 如果没有缓存或者哈希值不匹配，说明有更新
      if (!cachedHash || cachedHash !== currentHash) {
        buildScript(name, scriptPath);
        cache[name] = currentHash;
        hasUpdates = true;
      } else {
        console.log(`No changes detected for script: ${name}`);
      }
    }
    
    // 保存缓存
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    
    if (!hasUpdates) {
        console.log('No scripts need to be updated.');
      }
      
      // Git提交操作已移至GitHub Actions工作流中
      // 详见 .github/workflows/build.yml 文件
    
    console.log('\nBuild process completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
