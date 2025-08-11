export const typeMap = {
  folder: '文件夹',
  png: '图片',
  jpg: '图片',
  jpeg: '图片',
  gif: '图片',
  bmp: '图片',
  svg: '图片',
  webp: '图片',
  txt: '文本',
  json: '文本',
  log: '文本',
  csv: '文本',
  md: '文本',
  mp4: '视频',
  mov: '视频',
  avi: '视频',
  doc: '文档',
  docx: '文档',
  xls: '表格',
  xlsx: '表格',
  pdf: '文档',
  zip: '压缩包',
  rar: '压缩包',
  '7z': '压缩包',
  tar: '压缩包',
  gz: '压缩包',
};

export const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];

export const zipExts = ['zip', 'rar', '7z', 'tar', 'gz'];

export const movieExts = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'mpeg', 'mpg', 'm4v', '3gp'];


export const allowedExts = [
  'jpg', 'jpeg', 'png', 'gif',       // 图片
  'mp4', 'mov',                      // 视频
  'txt', 'log', 'json', 'csv', 'md', // 文本类
  'doc', 'docx', 'xls', 'xlsx', 'pdf', // 文档
  'zip', 'rar', '7z', 'tar', 'gz'    // 压缩包
];

export const menuData = [
  { index: 'all', label: '全部' },
  { index: 'image', label: '图片' },
  { index: 'video', label: '视频' },
  { index: 'doc', label: '文档' },
  { index: 'zip', label: '压缩包' },
];