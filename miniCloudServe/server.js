const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.use(express.json()); // 解析 JSON 请求体，必须尽早注册

// 创建 uploads 文件夹（根目录）
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 配置，上传文件先放到临时目录，再移动
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const buf = Buffer.from(file.originalname, 'latin1');
    const correctName = buf.toString('utf8');
    cb(null, Date.now() + '-' + correctName);
  },
});
const upload = multer({ storage });

// 托管前端静态文件
app.use(express.static(path.join(__dirname, 'dist')));

// 让上传文件可通过 /uploads 路径访问
app.use('/uploads', express.static(uploadDir));

// 计算 id 的辅助函数，使用相对路径做 hash
function hashId(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// 递归扫描目录，生成文件夹和文件列表，包含 id、parentId、relativePath 等信息
function scanDir(dir, parentId = null, basePath = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];

  for (const item of items) {
    const name = item.name;
    const relativePath = basePath ? `${basePath}/${name}` : name;
    const fullPath = path.join(dir, name);
    const id = hashId(relativePath);

    if (item.isDirectory()) {
      const displayName = name.replace(/^\d+-/, '');
      results.push({
        id,
        name: displayName,
        type: 'folder',
        url: '',
        parentId,
        size: 0,
        ext: '',
        relativePath,
      });
      // 递归子目录
      results = results.concat(scanDir(fullPath, id, relativePath));
    } else {
      const ext = path.extname(name).slice(1);
      const displayName = name.replace(/^\d+-/, '');
      const stat = fs.statSync(fullPath);
      results.push({
        id,
        name: displayName,
        type: ext,
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        parentId,
        size: fs.statSync(fullPath).size,
        ext,
        relativePath,
        uploadTime: stat.mtime.toISOString(),  // 加上修改时间，ISO格式字符串
      });
    }
  }

  return results;
}

// 获取所有文件和文件夹列表（递归）
app.get('/files', (req, res) => {
  try {
    const list = scanDir(uploadDir);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '读取文件失败' });
  }
});

// 创建文件夹接口，支持 parentPath，自动处理重名
app.post('/folders', (req, res) => {
  const { parentPath = '', folderName } = req.body;
  if (!folderName) return res.status(400).json({ error: '缺少 folderName 参数' });

  let nameToUse = folderName;
  let targetPath = path.join(uploadDir, parentPath, nameToUse);
  let counter = 1;

  while (fs.existsSync(targetPath)) {
    nameToUse = `${folderName} (${counter})`;
    targetPath = path.join(uploadDir, parentPath, nameToUse);
    counter++;
  }

  try {
    fs.mkdirSync(targetPath, { recursive: true });
    const relativePath = parentPath ? `${parentPath}/${nameToUse}` : nameToUse;
    const id = hashId(relativePath);
    const parentId = parentPath ? hashId(parentPath) : null;

    res.json({
      status: 'ok',
      folder: {
        id,
        name: nameToUse,
        type: 'folder',
        url: '',
        size: 0,
        parentId,
        relativePath,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '文件夹创建失败' });
  }
});

// 上传文件，支持 query 传 parentPath
app.post('/upload', upload.single('file'), (req, res) => {
  const parentPath = req.query.parentPath || '';
  if (!req.file) return res.status(400).json({ error: '文件缺失' });

  const tempPath = req.file.path;
  const filename = req.file.filename;
  const targetDir = path.join(uploadDir, parentPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, filename);
  fs.rename(tempPath, targetPath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '保存文件失败' });
    }
    const relativePath = parentPath ? `${parentPath}/${filename}` : filename;
    const id = hashId(relativePath);
    const parentId = parentPath ? hashId(parentPath) : null;

    res.json({
      status: 'ok',
      file: {
        id,
        name: filename.replace(/^\d+-/, ''),
        type: path.extname(filename).slice(1),
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        parentId,
        size: fs.statSync(targetPath).size,
        ext: path.extname(filename).slice(1),
        relativePath,
      },
    });
  });
});

// 删除文件或文件夹，传 relativePath
app.delete('/files', (req, res) => {
  const { relativePath } = req.body;
  if (!relativePath) return res.status(400).json({ error: '缺少 relativePath' });

  const targetPath = path.join(uploadDir, relativePath);
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: '目标不存在' });

  fs.rm(targetPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ status: 'ok' });
  });
});

// 重命名文件，保持时间戳前缀，传 oldRelativePath, newName
app.put('/files/rename', (req, res) => {
  const { oldRelativePath, newName } = req.body;
  if (!oldRelativePath || !newName) return res.status(400).json({ error: '参数缺失' });

  const oldPath = path.join(uploadDir, oldRelativePath);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: '原始文件不存在' });

  const dir = path.dirname(oldPath);
  const base = path.basename(oldRelativePath);
  const parts = base.split('-');
  const timestamp = (parts.length > 1 && /^\d+$/.test(parts[0])) ? parts[0] : Date.now();

  const newFilename = `${timestamp}-${newName}`;
  const newPath = path.join(dir, newFilename);

  if (fs.existsSync(newPath)) return res.status(400).json({ error: '已存在同名文件' });

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '重命名失败' });
    }
    const newRelativePath = path.join(path.dirname(oldRelativePath), newFilename).replace(/\\/g, '/');
    res.json({ status: 'ok', newRelativePath });
  });
});

// 移动文件或文件夹，传 oldRelativePath 和 newParentPath
app.put('/files/move', (req, res) => {
  const { oldRelativePath, newParentPath = '' } = req.body;
  if (!oldRelativePath) return res.status(400).json({ error: '参数缺失' });

  const oldPath = path.join(uploadDir, oldRelativePath);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: '源不存在' });

  const baseName = path.basename(oldRelativePath);
  const newDir = path.join(uploadDir, newParentPath);
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

  const newPath = path.join(newDir, baseName);

  if (fs.existsSync(newPath)) return res.status(400).json({ error: '目标已存在同名项' });

  try {
    fs.renameSync(oldPath, newPath);
    const newRelativePath = newParentPath ? `${newParentPath}/${baseName}` : baseName;
    res.json({
      status: 'ok',
      newRelativePath,
      newParentId: newParentPath ? hashId(newParentPath) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '移动失败' });
  }
});

// SPA 前端路由兼容，全部返回 index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🌍 服务已启动: http://localhost:${port}`);
});
