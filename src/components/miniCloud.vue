  <template>
    <!-- 修改 -->
    <div class="file-manager" ref="gridArea">
      <el-container>
        <!-- 左侧菜单 -->
        <el-aside width="200px">
          <el-menu @select="handleCategorySelect" :default-active="activeCategory">
            <el-menu-item v-for="item in menuData" :key="item.index" :index="item.index">
              {{ item.label }}
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-main>
          <!-- 搜索框 -->
          <div style="position: absolute; top: 10px; right: 20px; width: 240px; z-index: 10;">
            <el-input v-model="searchKeyword" ref="searchInput" size="small" placeholder="搜索文件" clearable
              prefix-icon="el-icon-search" />
          </div>


          <!-- 工具栏 -->
          <div class="toolbar">
            <el-button type="primary" icon="el-icon-upload" @click="showUploadDialog = true">上传文件</el-button>
            <el-button type="success" icon="el-icon-download" :disabled="selectedFileIds.length < 2"
              @click="batchDownload">批量下载</el-button>
            <el-button type="danger" icon="el-icon-delete" :disabled="selectedFileIds.length < 2"
              @click="batchDelete">批量删除</el-button>
            <el-button icon="el-icon-folder-add" @click="createFolder">新建文件夹</el-button>
            <el-button :icon="viewMode == 'grid' ? 'el-icon-menu' : 'el-icon-film'" @click="toggleViewMode">{{
              viewMode == 'grid' ? '网格展示' : '列表展示'
            }}</el-button>
            <el-button icon="el-icon-back" @click="goBackFolder" :disabled="!currentFolderId">返回上一级</el-button>
          </div>

          <!-- 面包屑导航栏 -->
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item @click.native="navigateTo(null)" style="cursor: pointer;">全部文件</el-breadcrumb-item>
            <el-breadcrumb-item v-for="crumb in breadcrumb" :key="crumb.id" @click.native="navigateTo(crumb.id)"
              style="cursor: pointer;">
              {{ crumb.name }}
            </el-breadcrumb-item>
          </el-breadcrumb>

          <!-- 全选 -->
          <div class="selectBar" v-if="filteredFiles.length">
            <span class="select-toggle" @click="toggleSelectAll">
              {{ isAllSelected ? '取消全选' : '全选' }}
            </span>
            <span v-show="selectedFileIds.length > 0">已选中 {{ selectedFileIds.length }} 个文件/文件夹</span>
          </div>

          <!-- 列表视图 -->
          <el-table v-if="viewMode === 'list'" :data="filteredFiles" border @selection-change="handleSelectionChange"
            ref="listTable" row-key="id">
            <el-table-column type="selection" width="55" />
            <el-table-column label="名称">
              <template v-slot="scope">
                <span draggable="true" @dragstart="onDragStart(scope.row)"
                  @contextmenu.prevent="showContextMenu($event, scope.row)"
                  style="display: flex; align-items: center; max-width: 100%;">
                  <i :class="getIcon(scope.row.type)" style="margin-right: 6px; flex-shrink: 0;"></i>
                  <span @click="handleOpen(scope.row)"
                    style="cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1;"
                    title="scope.row.name">
                    {{ scope.row.name }}
                  </span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="100">
              <template slot-scope="scope">{{ formatSize(scope.row.size) }}</template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                {{ translateType(row.type) }}
              </template>
            </el-table-column>
            <el-table-column label="上传时间" width="200">
              <template slot-scope="scope">{{ formatDate(scope.row.uploadTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="250">
              <template v-slot="scope">
                <el-button size="mini" v-if="isImage(scope.row.type)"
                  @click.stop.prevent="openImageViewer(scope.row)">预览</el-button>
                <el-button size="mini" v-else-if="scope.row.type === 'folder'"
                  @click.stop.prevent="handleOpen(scope.row)">打开</el-button>
                <el-button size="mini" v-else-if="isZip(scope.row.type)"
                  @click.stop.prevent="downloadFile(scope.row)">下载</el-button>
                <el-button size="mini" v-else @click.stop.prevent="handlePreview(scope.row)">预览</el-button> <el-button
                  size="mini" @click="openRenameDialog(scope.row)">重命名</el-button>
                <el-button size="mini" type="danger" @click="deleteFile(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>


          <!-- 图标视图 -->
          <div class="grid-view" v-else ref="gridView">
            <div class="selection-rect" v-show="selectionBox.visible" :style="{
              left: selectionBox.left + 'px',
              top: selectionBox.top + 'px',
              width: selectionBox.width + 'px',
              height: selectionBox.height + 'px'
            }"></div>
            <div v-for="file in filteredFiles" :key="file.id" class="file-card"
              :class="{ folder: file.type === 'folder', selected: selectedFileIds.includes(file.id) }" draggable="true"
              @dragstart="onDragStart(file)" @dragover.prevent @drop="onDrop(file)" @click="handleOpen(file)"
              @contextmenu.prevent="showContextMenu($event, file)">

              <!-- 悬浮操作按钮 -->
              <div class="file-actions" @click.stop>
                <el-dropdown trigger="click">
                  <span class="el-dropdown-link"><i class="el-icon-more"></i></span>
                  <el-dropdown-menu slot="dropdown">
                    <!-- 如果是文件夹，显示“打开” -->
                    <el-dropdown-item v-if="file.type === 'folder'" @click.native.stop.prevent="handleOpen(file)">
                      打开
                    </el-dropdown-item>

                    <!-- 如果是图片，调用图片预览 -->
                    <el-dropdown-item v-else-if="isImage(file.type)" @click.native.stop.prevent="openImageViewer(file)">
                      预览
                    </el-dropdown-item>

                    <!-- 其他文件统一预览 -->
                    <el-dropdown-item v-else @click.native.stop.prevent="handlePreview(file)">
                      预览
                    </el-dropdown-item>

                    <!-- 其他操作 -->
                    <el-dropdown-item @click.native.stop.prevent="openRenameDialog(file)">重命名</el-dropdown-item>
                    <el-dropdown-item divided @click.native.stop.prevent="deleteFile(file)">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>

              </div>

              <input type="checkbox" class="select-checkbox" :checked="selectedFileIds.includes(file.id)"
                @click.stop="toggleSelection(file)" />

              <!-- 缩略图 -->
              <template v-if="isImage(file.type)">
                <el-image style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                  :src="file.url" :preview-src-list="imageUrls" @click.stop.prevent />
              </template>
              <template v-else-if="file.type === 'video'">
                <video style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                  :src="file.url" @click.stop.prevent="handlePreview(file)" muted preload="metadata" />
              </template>
              <template v-else-if="file.type === 'folder'">
                <i :class="getIcon(file.ext || file.type)" class="file-icon" @click.stop.prevent="handleOpen(file)"
                  style="cursor: pointer;"></i>
              </template>
              <template v-else>
                <i :class="getIcon(file.ext || file.type)" class="file-icon" @click.stop.prevent="handlePreview(file)"
                  style="cursor: pointer;"></i>
              </template>
              <el-tooltip placement="top-start" effect="dark" popper-class="custom-tooltip">
                <template #content>
                  <div style="white-space: pre-line;">
                    名称: {{ file.name }}<br>
                    大小: {{ formatSize(file.size) }}<br>
                    类型: {{ file.type }}<br>
                    上传时间：{{ formatDate(file.uploadTime) }}
                  </div>
                </template>
                <span class="dataInfo"><i class="el-icon-info"></i></span>
              </el-tooltip>
              <div class="file-name" :title="file.name">{{ file.name }}</div>
            </div>
          </div>
        </el-main>
      </el-container>

      <!-- 预览文件对话框（视频/文档） -->
      <el-dialog :title="`预览 - ${previewDialog.file.name || ''}`" :visible.sync="previewDialog.visible" width="70%">
        <template v-if="previewDialog.file.type === 'video'">
          <video controls :src="previewDialog.file.url" class="preview-video"></video>
        </template>
        <template v-else>
          <iframe :src="previewDialog.file.previewUrl" class="preview-iframe"></iframe>
        </template>
      </el-dialog>

      <!-- 重命名对话框 -->
      <el-dialog title="重命名" :visible.sync="showRenameDialog" width="400px">
        <el-form>
          <el-form-item label="文件名">
            <el-input v-model="renameForm.name" />
          </el-form-item>
        </el-form>
        <span slot="footer" class="dialog-footer">
          <el-button @click="showRenameDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确定</el-button>
        </span>
      </el-dialog>

      <!-- 上传对话框 -->
      <el-dialog title="上传文件" :visible.sync="showUploadDialog" width="400px">
        <div class="upload-center">
          <el-upload drag :auto-upload="false" :file-list="uploadList" :before-upload="beforeUpload"
            :on-change="handleUploadChange" action="">
            <i class="el-icon-upload"></i>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
          </el-upload>
        </div>
        <span slot="footer">
          <el-button @click="showUploadDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmUpload">上传</el-button>
        </span>
      </el-dialog>

      <el-dialog title="移动文件" :visible.sync="moveDialog.visible" width="600px">
        <!-- 返回 + 面包屑（同一行） -->
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <!-- 返回图标 -->
          <el-button type="text" @click="goBackMoveFolder" style="margin-right: 10px;">
            <i class="el-icon-back"></i>
          </el-button>

          <!-- 面包屑 -->
          <el-breadcrumb separator="/">
            <el-breadcrumb-item @click.native="navigateMoveTo(null)" style="cursor: pointer;">
              根目录
            </el-breadcrumb-item>
            <el-breadcrumb-item v-for="(crumb) in moveDialog.breadcrumb" :key="crumb.id"
              @click.native="navigateMoveTo(crumb.id)" style="cursor: pointer;">
              {{ crumb.name }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 文件夹列表（点击进入） -->
        <el-table :data="moveDialog.folders" :empty-text="getMoveEmptyText" @row-click="navigateMoveToRow"
          highlight-current-row>
          <el-table-column label="文件夹名">
            <template v-slot="scope">
              <span class="folder-name">
                {{ scope.row.name }}
              </span>
            </template>
          </el-table-column>
        </el-table>


        <!-- 底部按钮 -->
        <span slot="footer">
          <el-button @click="moveDialog.visible = false">取消</el-button>
          <el-button type="primary" @click="confirmMove">移动到此</el-button>
        </span>
      </el-dialog>


      <!-- 隐藏的 el-image，负责图片预览弹窗 -->
      <el-image ref="hiddenImage" style="width:0;height:0;opacity:0;" :src="imageUrls[imagePreviewIndex]"
        :preview-src-list="imageUrls" />

      <!-- 右键菜单 -->
      <div v-if="contextMenu.visible" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        class="context-menu" @click.stop>
        <ul>
          <li v-if="contextMenu.file.type === 'folder'" @click="handleOpen(contextMenu.file)">打开</li>
          <li v-else-if="isImage(contextMenu.file.type)" @click="openImageViewer(contextMenu.file)">预览</li>
          <li v-else-if="isMovie(contextMenu.file.type)" @click="handlePreview(contextMenu.file)">预览</li>
          <li v-else-if="!isZip(contextMenu.file.type)" @click="handlePreview(contextMenu.file)">打开</li>
          <li v-if="contextMenu.file.type !== 'folder'" @click="downloadFile(contextMenu.file)">下载</li>
          <li @click="openRenameDialog(contextMenu.file)">重命名</li>
          <li @click="openMoveDialog(contextMenu.file)">移动到...</li>
          <li @click="deleteFile(contextMenu.file)">删除</li>
        </ul>
      </div>
      <div class="selection-rect" v-show="selectionBox.visible && isSelecting && viewMode !== 'list'" :style="{
        left: selectionBox.left + 'px',
        top: selectionBox.top + 'px',
        width: selectionBox.width + 'px',
        height: selectionBox.height + 'px'
      }"></div>

    </div>

  </template>

<script>
import axios from 'axios';
import { typeMap, imageExts, zipExts, movieExts, allowedExts, menuData } from '@/mapData';

export default {

  data() {
    return {
      selectFile: null,
      menuData,
      isSelecting: false, // 是否处于框选模式
      selectionBox: {
        visible: false,
        startX: 0,
        startY: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0
      },
      currentNotification: null,
      moveDialog: {
        visible: false,
        fileToMove: null,
        folders: [], // 当前显示的文件夹列表
        breadcrumb: [],
        parentId: null,
        selectedFolder: null
      },
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        file: null,
      },
      searchKeyword: '',  // 新增，搜索框绑定的关键词
      viewMode: 'grid',
      activeCategory: 'all',
      currentFolderId: null,
      dragFile: null,
      files: [{
        "id": "dd18bf3a8e0a2a3e53e2661c7fb53534",
        "name": "test.txt",
        "type": "txt",
        "url": "/uploads/test.txt",
        "parentId": null,
        "size": 0,
        "ext": "txt",
        "relativePath": "test.txt",
        "uploadTime": "2025-08-11T09:34:04.244Z"
      }],
      showUploadDialog: false,
      uploadList: [],
      showRenameDialog: false,
      renameForm: { id: null, name: '' },
      previewDialog: { visible: false, file: {} },
      selectedFileIds: [],
      imageViewer: {
        visible: false,
        urls: [],
        startIndex: 0,
      },
      imagePreviewVisible: false,
      imagePreviewIndex: 0,
    }
  },
  computed: {

    isAllSelected() {
      return this.selectedFileIds.length === this.filteredFiles.length && this.filteredFiles.length > 0;
    },
    getMoveEmptyText() {
      const crumbs = this.moveDialog.breadcrumb;
      if (crumbs.length === 0) return '移动到根目录';
      const currentFolder = crumbs[crumbs.length - 1];
      return `移动到 "${currentFolder.name}" 文件夹`;
    },


    filteredFiles() {
      const keyword = this.searchKeyword.trim().toLowerCase();
      // 辅助函数：根据文件扩展名返回类别
      const getCategoryByExt = (ext) => {
        const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
        const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
        const docTypes = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
        const otherTypes = ['zip', 'rar', '7z', 'tar', 'gz'];

        if (imageTypes.includes(ext)) return 'image';
        if (videoTypes.includes(ext)) return 'video';
        if (docTypes.includes(ext)) return 'doc';
        if (otherTypes.includes(ext)) return 'zip';
        return 'other';
      };

      return this.files.filter(f => {
        const inCurrentFolder = f.parentId === this.currentFolderId;
        const fileCategory = getCategoryByExt(f.ext.toLowerCase());
        const typeMatch = this.activeCategory === 'all' || fileCategory === this.activeCategory;
        const nameMatch = f.name.toLowerCase().includes(keyword);
        return inCurrentFolder && typeMatch && nameMatch;
      });
    },

    breadcrumb() {
      let path = []
      let current = this.currentFolderId
      while (current) {
        const folder = this.files.find(f => f.id === current)
        if (!folder) break
        path.unshift(folder)
        current = folder.parentId
      }
      return path
    },
    imageUrls() {
      return this.filteredFiles
        .filter(f => this.isImage(f.type))
        .map(f => f.url)
    }
  },
  watch: {
    viewMode(newMode) {
      if (newMode === 'list') {
        this.$nextTick(() => {
          const table = this.$refs.listTable;
          if (!table) return;

          table.clearSelection();

          const rowsToSelect = table.store.states.data.filter(row =>
            this.selectedFileIds.includes(row.id)
          );

          // 暂时禁用 selection-change 回调里的重置逻辑
          this.ignoreSelectionChange = true;
          rowsToSelect.forEach(row => {
            table.toggleRowSelection(row, true);
          });
          this.ignoreSelectionChange = false;
        });
      }
    }
  },
  methods: {
    handleKeyDownSearch(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault(); // 禁用浏览器默认查找
        this.$refs.searchInput.focus(); // 聚焦你的输入框
      }
    },
    handleKeyDownDelete(event) {
      if (event.key === 'Delete' || event.keyCode === 46) {
        if (this.selectedFileIds.length == 0) return
        if (this.selectedFileIds.length < 2) {
          this.deleteFile(this.selectFile)
        } else {
          this.batchDelete()
        }
      }
    },
    translateType(type) {
      if (typeof type !== 'string') return '';
      return typeMap[type.toLowerCase()] || type;
    },

    formatDate(isoString) {
      if (!isoString) return '--';
      const date = new Date(isoString);
      const Y = date.getFullYear();
      const M = String(date.getMonth() + 1).padStart(2, '0');
      const D = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    },


    isImage(ext) {
      if (!ext) return false;
      // const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
      return imageExts.includes(ext.toLowerCase());
    },
    isZip(ext) {
      if (!ext) return false;
      return zipExts.includes(ext.toLowerCase());
    },
    isMovie(ext) {
      if (!ext) return false;
      return movieExts.includes(ext.toLowerCase());
    },
    // 获取文件列表
    fetchFiles() {
      axios.get('/files')
        .then(res => {
          this.files = res.data.map(file => ({
            ...file,
            url: file.url ? window.location.origin + file.url : '', // 文件夹可能没有 url
          }));
        })
        .catch(err => {
          console.error('获取文件列表失败', err);
        });
    },
    // 关闭当前通知
    closeCurrentNotification() {
      if (this.currentNotification) {
        this.currentNotification.close();
        this.currentNotification = null;
      }
    },

    // 显示通知（自动关闭前一个）
    showNotification(options) {
      this.closeCurrentNotification();
      this.currentNotification = this.$notify(options);
    },
    navigateMoveToRow(row) {
      this.navigateMoveTo(row.id)
    },

    // 加载可移动的文件夹
    openMoveDialog(file) {
      this.moveDialog.visible = true
      this.moveDialog.fileToMove = file
      this.moveDialog.parentId = null
      this.moveDialog.breadcrumb = []
      this.moveDialog.selectedFolder = null
      this.loadMoveFolders(null)

      this.contextMenu.visible = false // 隐藏右键菜单
    },

    loadMoveFolders(parentId) {
      this.moveDialog.folders = this.files.filter(f => f.type === 'folder' && f.parentId === parentId)
    },

    navigateMoveTo(folderId) {
      this.moveDialog.parentId = folderId
      this.moveDialog.breadcrumb = this.getBreadcrumb(folderId)
      this.moveDialog.selectedFolder = null
      this.loadMoveFolders(folderId)
    },
    goBackMoveFolder() {
      const breadcrumb = this.moveDialog.breadcrumb
      if (breadcrumb.length) {
        const parent = breadcrumb[breadcrumb.length - 2]
        this.navigateMoveTo(parent ? parent.id : null)
      }
    },
    selectMoveTarget(row) {
      this.moveDialog.selectedFolder = row
    },

    async confirmMove() {
      const file = this.moveDialog.fileToMove;
      const targetFolderPath = this.moveDialog.parentPath || ''; // 目标文件夹的相对路径
      if (!file || file.parentId === targetFolderPath) {
        this.$message.error("不能移动到自身所在目录");
        return;
      }

      try {
        await axios.put('/files/move', {
          oldRelativePath: file.relativePath, // 传文件的相对路径
          newParentPath: targetFolderPath      // 传目标文件夹的相对路径
        });

        // 本地更新 parentId 和 relativePath
        file.parentId = this.moveDialog.parentId;
        file.relativePath = targetFolderPath
          ? `${targetFolderPath}/${file.name}`
          : file.name;

        this.$message.success(`已将 "${file.name}" 移动到新目录`);
        this.moveDialog.visible = false;

        // 建议刷新列表，确保同步
        this.fetchFiles();

      } catch (err) {
        this.$message.error(err.error);
        console.error(err);
      }
    },


    getBreadcrumb(folderId) {
      const result = []
      let current = this.files.find(f => f.id === folderId)
      while (current) {
        result.unshift(current)
        current = this.files.find(f => f.id === current.parentId)
      }
      return result
    },

    // 单文件下载
    async downloadFile(file) {
      this.closeContextMenu(); // 关闭右键菜单
      this.showNotification({
        type: 'info',
        title: '下载中',
        message: `正在下载 ${file.name}...`,
        duration: 0,
        showClose: false,
      });

      try {
        if (this.isImage(file.type) || file.type === 'video') {
          await this.downloadAsBlob(file.url, file.name);
        } else {
          this.downloadDirect(file.url, file.name);
        }

        this.closeCurrentNotification();

        this.showNotification({
          type: 'success',
          title: '下载完成',
          message: `${file.name} 下载成功`,
          duration: 3000,
        });
      } catch (e) {
        this.closeCurrentNotification();
        this.showNotification({
          type: 'error',
          title: '下载失败',
          message: `${file.name} 下载失败`,
          duration: 3000,
        });
      }
    },

    // 批量下载选中的文件

    async batchDownload() {
      this.closeContextMenu(); // 关闭右键菜单
      const filesToDownload = this.files.filter(f => this.selectedFileIds.includes(f.id) && f.type !== 'folder');
      if (!filesToDownload.length) return;

      // 弹出正在下载通知（duration: 0 不自动关闭）
      this.showNotification({
        type: 'info',
        title: '下载中',
        message: `正在下载 ${filesToDownload.length} 个文件...`,
        duration: 0,
        showClose: false,
      });

      let successCount = 0;
      for (const file of filesToDownload) {
        try {
          if (this.isImage(file.type) || file.type === 'video') {
            await this.downloadAsBlob(file.url, file.name);
          } else {
            this.downloadDirect(file.url, file.name);
          }
          successCount++;
        } catch (e) {
          // 下载失败可单独处理，也可以忽略
          console.error(`下载失败：${file.name}`, e);
        }
      }

      // 关闭“正在下载”通知
      this.closeCurrentNotification();

      if (filesToDownload.length === 1) {
        // 单个文件下载成功提示
        this.showNotification({
          type: 'success',
          title: '下载完成',
          message: `${filesToDownload[0].name} 下载成功`,
          duration: 3000,
        });
      } else {
        // 批量下载成功提示
        this.showNotification({
          type: 'success',
          title: '批量下载完成',
          message: `成功下载 ${successCount} / ${filesToDownload.length} 个文件`,
          duration: 3000,
        });
      }
    },

    downloadDirect(url, fileName) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    async downloadAsBlob(url, fileName) {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(blobUrl);
    },

    // 关闭右键菜单
    closeContextMenu() {
      if (!this.contextMenu.visible) return;
      this.contextMenu.visible = false;
      this.isSelecting = false
    },
    // 显示右键菜单
    showContextMenu(event, file) {
      event.preventDefault();  // 阻止默认右键菜单
      this.contextMenu = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        file: file
      };
    },

    hideVisible() {

      this.contextMenu.visible = false;
      this.selectionBox.visible = false
      this.isSelecting = false
    },
    // 上传前的检查
    beforeUpload(file) {
      // 禁止上传文件夹（通常文件夹没有 size）
      if (!file.size) {
        this.$message.warning('不支持上传文件夹');
        return false;
      }

      // 支持的类型扩展名白名单
      const ext = file.name.split('.').pop().toLowerCase();

      if (!allowedExts.includes(ext)) {
        this.$message.warning(`不支持的文件类型: ${ext}`);
        return false;
      }
      return true;
    },

    // 打开图片查看器
    openImageViewer(file) {
      this.closeContextMenu(); // 关闭右键菜单
      const index = this.imageUrls.findIndex(url => url === file.url)
      if (index >= 0) {
        this.imagePreviewIndex = index
        this.$nextTick(() => {
          this.$refs.hiddenImage.showViewer = true
        })
      }
    },

    // 格式化大小
    formatSize(bytes) {
      if (bytes === 0 || !bytes) return '-';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const size = (bytes / Math.pow(k, i)).toFixed(2);
      return `${size} ${sizes[i]}`;
    },

    // 切换视图模式
    toggleViewMode() {
      this.viewMode = this.viewMode === 'list' ? 'grid' : 'list'
    },

    // 获取文件图标
    getIcon(typeOrExt) {
      switch ((typeOrExt || '').toLowerCase()) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
          return 'el-icon-picture-outline';
        case 'mp4':
        case 'mov':
          return 'el-icon-video-camera';
        case 'txt':
          return 'el-icon-document';
        case 'doc':
        case 'docx':
          return 'el-icon-document-checked';
        case 'xls':
        case 'xlsx':
          return 'el-icon-s-data';
        case 'pdf':
          return 'el-icon-document';
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
          return 'el-icon-suitcase';
        case 'folder':
          return 'el-icon-folder';
        default:
          return 'el-icon-document';
      }
    },

    // 创建新文件夹
    async createFolder() {
      const baseName = '新建文件夹';
      const existingNames = this.files
        .filter(file => file.type === 'folder' && file.parentId === this.currentFolderId)
        .map(file => file.name);

      let newName = baseName;
      let index = 1;
      while (existingNames.includes(newName)) {
        newName = `${baseName} (${index})`;
        index++;
      }

      // 根据 currentFolderId 找到父路径
      const parentFolder = this.files.find(f => f.id === this.currentFolderId);
      const parentPath = parentFolder ? parentFolder.relativePath || '' : '';

      try {
        const res = await axios.post('/folders', {
          parentPath,
          folderName: newName
        });
        if (res.data.status === 'ok') {
          await this.fetchFiles(); // 刷新列表
        } else {
          this.$message.error(res.data.error || '新建文件夹失败');
        }
      } catch (err) {
        console.error(err);
        this.$message.error('接口调用失败');
      }
    }
    ,

    // 打开重命名对话框
    openRenameDialog(file) {
      this.contextMenu.visible = false;
      this.renameForm = { ...file }
      this.showRenameDialog = true
    },

    confirmRename() {
      const file = this.files.find(f => f.id === this.renameForm.id);
      if (!file) return;

      const oldRelativePath = file.relativePath;  // 多层目录下完整相对路径
      const newName = this.renameForm.name;       // 用户输入的新名字（不带时间戳）

      axios.put('/files/rename', {
        oldRelativePath,
        newName
      })
        .then(() => {
          this.$message.success('重命名成功');
          this.showRenameDialog = false;
          this.fetchFiles(); // 刷新文件列表
        })
        .catch(() => {
          this.$message.error('重命名失败');
        });
    },

    // 处理上传文件变化
    handleUploadChange(file, fileList) {

      const ext = file.name.split('.').pop().toLowerCase();

      if (!file.size) {
        this.$message.warning('不支持上传文件夹');
        const index = fileList.findIndex(f => f.uid === file.uid);
        if (index !== -1) fileList.splice(index, 1);
        return;
      }

      if (!allowedExts.includes(ext)) {
        this.$message.warning(`不支持的文件类型: .${ext}`);
        const index = fileList.findIndex(f => f.uid === file.uid);
        if (index !== -1) fileList.splice(index, 1);
        return;
      }
      file.ext = ext;
      file.type = this.getFileType(file.name);
      file.id = Date.now(); // 临时 ID
      this.uploadList.push(file);
    },

    // 确认上传
    async confirmUpload() {
      const baseUrl = window.location.origin;
      const parentPath = this.currentFolderPath || '';

      if (!this.uploadList.length) {
        this.$message.warning('请选择文件上传');
        return;
      }

      this.$message.info('正在上传文件，请稍候...', { duration: 0, showClose: false });

      try {
        const uploadPromises = this.uploadList.map(fileObj => {
          const formData = new FormData();
          formData.append('file', fileObj.raw);
          return axios.post(`${baseUrl}/upload?parentPath=${encodeURIComponent(parentPath)}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        });

        await Promise.all(uploadPromises);

        this.$message.closeAll(); // 关闭上传提示
        this.$message.success('上传成功');

        this.showUploadDialog = false;
        this.uploadList = [];

        await this.fetchFiles();  // 上传后刷新文件列表

      } catch (error) {
        this.$message.closeAll();
        this.$message.error('上传失败，请重试');
        console.error('上传失败', error);
      }
    },


    // 删除单个文件或文件夹
    deleteFile(file) {
      this.closeContextMenu();
      this.$confirm('确认删除该文件吗？', '警告', { type: 'warning' }).then(() => {
        axios.delete('/files', { data: { relativePath: file.relativePath } })
          .then(() => {
            this.$message.success('删除成功');
            this.files = this.files.filter(f => f.id !== file.id);
            const idx = this.selectedFileIds.indexOf(file.id);
            if (idx >= 0) this.selectedFileIds.splice(idx, 1);
          })
          .catch(err => {
            this.$message.error('删除失败');
            console.error(err);
          });
      }).catch(() => {
        // 取消删除
      });
    },

    // 批量删除
    batchDelete() {
      this.$confirm('确认批量删除选中的文件吗？', '警告', { type: 'warning' }).then(() => {
        const deletePromises = this.selectedFileIds.map(id => {
          const file = this.files.find(f => f.id === id);
          if (!file) return Promise.resolve();
          return axios.delete('/files', { data: { relativePath: file.relativePath } });
        });

        Promise.all(deletePromises).then(() => {
          this.files = this.files.filter(f => !this.selectedFileIds.includes(f.id));
          this.selectedFileIds = [];
          this.$message.success('批量删除成功');
        }).catch(() => {
          this.$message.error('批量删除有失败项');
        });
      }).catch(() => {
        // 取消删除
      });
    },


    // 处理预览文件
    handlePreview(file) {
      this.closeContextMenu(); // 关闭右键菜单
      if (file.type === 'doc' && ['xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx'].includes(file.ext)) {
        // 用微软Office Online在线预览（file.url需encodeURIComponent）
        this.previewDialog.file = file
        this.previewDialog.file.previewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`
      } else {
        this.previewDialog.file = file
        this.previewDialog.file.previewUrl = file.url
      }
      this.previewDialog.visible = true
    },

    // 获取文件类型
    getFileType(name) {
      const ext = name.split('.').pop().toLowerCase();
      if (['jpg', 'png', 'jpeg'].includes(ext)) return 'image';
      if (['mp4', 'mov'].includes(ext)) return 'video';
      if (['txt', 'doc', 'docx', 'xls', 'xlsx', 'pdf'].includes(ext)) return 'doc';
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'; // 新增压缩包类型
      return 'unknown';
    },

    // 拖拽相关
    onDragStart(file) {
      this.selectionBox.visible = false;
      this.dragFile = file;
    },

    async onDrop(target) {
      if (target.type !== 'folder' || !this.dragFile) return;

      const sourceId = this.dragFile.id;
      const targetId = target.id;

      if (sourceId === targetId) {
        this.$message.warning('不能将文件夹拖动到自身');
        return;
      }

      if (this.isDescendantFolder(sourceId, targetId)) {
        this.$message.warning('不能将文件夹拖动到其子文件夹中');
        return;
      }

      try {
        // 调用后端接口更新文件的父级ID
        await axios.put('/files/move', {
          oldRelativePath: this.dragFile.relativePath,
          newParentPath: target.relativePath || ''
        });

        // 更新本地数据
        this.dragFile.parentId = targetId;
        this.dragFile = null;
        this.selectionBox.visible = false;

        this.$message.success('移动成功');
      } catch (error) {
        this.$message.error('移动失败');
        console.error(error);
      }
    },

    isDescendantFolder(sourceId, targetId) {
      const stack = [targetId];
      while (stack.length) {
        const currentId = stack.pop();
        if (currentId === sourceId) return true;

        const children = this.files.filter(f => f.parentId === currentId && f.type === 'folder');
        for (const child of children) {
          stack.push(child.id);
        }
      }
      return false;
    },

    // 处理文件打开事件
    handleOpen(file, event) {
      if (event) {
        event.preventDefault(); // 阻止默认行为（关键）
        event.stopPropagation(); // 阻止冒泡
      }
      this.closeContextMenu(); // 关闭右键菜单
      if (file.type === 'folder') {
        this.currentFolderId = file.id
      } else {
        if (file.type === 'image') {
          this.openImageViewer(file)
        } else {
          this.handlePreview(file)
        }
      }
    },

    // 返回上一级文件夹
    goBackFolder() {
      const parent = this.files.find(f => f.id === this.currentFolderId)
      this.currentFolderId = parent ? parent.parentId : null
    },

    // 处理分类选择
    handleCategorySelect(key) {
      this.activeCategory = key
      this.selectedFileIds = []
    },



    // 切换选中状态
    toggleSelection(file) {
      this.selectFile = file
      const idx = this.selectedFileIds.indexOf(file.id)
      if (idx >= 0) this.selectedFileIds.splice(idx, 1)
      else this.selectedFileIds.push(file.id)
    },

    // 导航到指定文件夹
    navigateTo(folderId) {
      this.currentFolderId = folderId
      this.selectedFileIds = []
    },

    startSelection(e) {
      // 忽略右键、Ctrl 键等特殊操作
      if (e.button !== 0) return;
      this.isSelecting = true; // 开始框选
      this.selectionBox.visible = true;
      this.selectionBox.startX = e.pageX;
      this.selectionBox.startY = e.pageY;
      this.selectionBox.left = e.pageX;
      this.selectionBox.top = e.pageY;
      this.selectionBox.width = 0;
      this.selectionBox.height = 0;
    },

    updateSelection(e) {
      // 如果不在框选中或正在拖文件，就不更新 👇
      if (!this.selectionBox.visible) return;

      const startX = this.selectionBox.startX;
      const startY = this.selectionBox.startY;
      const currentX = e.pageX;
      const currentY = e.pageY;
      this.selectionBox.left = Math.min(startX, currentX);
      this.selectionBox.top = Math.min(startY, currentY);
      this.selectionBox.width = Math.abs(currentX - startX);
      this.selectionBox.height = Math.abs(currentY - startY);
      this.updateSelectedFilesByRect();
    },

    endSelection() {
      if (this.selectionBox.visible) {
        this.selectionBox.visible = false;
      }
      this.isSelecting = false; // 框选结束
    },

    updateSelectedFilesByRect() {
      if (!this.isSelecting) return; // 不是框选模式就不更新
      const box = this.selectionBox;
      const boxLeft = box.left;
      const boxTop = box.top;
      const boxRight = box.left + box.width;
      const boxBottom = box.top + box.height;

      const selected = [];

      const fileCards = this.$el.querySelectorAll('.file-card');
      this.filteredFiles.forEach((file, index) => {
        const el = fileCards[index];
        if (!el) return; // 防止空节点报错
        const rect = el.getBoundingClientRect();
        const elLeft = rect.left + window.scrollX;
        const elTop = rect.top + window.scrollY;
        const elRight = elLeft + rect.width;
        const elBottom = elTop + rect.height;
        const isOverlap =
          boxLeft < elRight &&
          boxRight > elLeft &&
          boxTop < elBottom &&
          boxBottom > elTop;
        if (isOverlap) {
          selected.push(file.id);
        }
      });


      this.selectedFileIds = selected;
    },
    // 全选/取消全选切换
    toggleSelectAll() {
      if (this.isAllSelected) {
        this.selectedFileIds = [];
        if (this.viewMode === 'list' && this.$refs.listTable) {
          this.$refs.listTable.clearSelection();
        }
      } else {
        this.selectedFileIds = this.filteredFiles.map(file => file.id);
        if (this.viewMode === 'list' && this.$refs.listTable) {
          this.$refs.listTable.clearSelection();
          this.$nextTick(() => {
            this.filteredFiles.forEach(file => {
              const tableRow = this.$refs.listTable.store.states.data.find(row => row.id === file.id);
              if (tableRow) {
                this.$refs.listTable.toggleRowSelection(tableRow, true);
              }
            });
          });
        }
      }
    },

    handleSelectionChange(selection) {
      if (this.ignoreSelectionChange) return;
      this.selectedFileIds = selection.map(item => item.id);
    },
  },

  mounted() {
    this.fetchFiles();
    const grid = this.$refs.gridView;
    if (grid) {
      grid.addEventListener('mousedown', this.startSelection);
      document.addEventListener('mousemove', this.updateSelection);
      document.addEventListener('mouseup', this.endSelection);
    }
    window.addEventListener('click', this.hideVisible);
    window.addEventListener('keydown', this.handleKeyDownDelete);
    window.addEventListener('keydown', this.handleKeyDownSearch);


  },
  beforeDestroy() {
    window.removeEventListener('click', this.hideVisible);
    document.removeEventListener('mousemove', this.updateSelection);
    document.removeEventListener('mouseup', this.endSelection);
    window.removeEventListener('keydown', this.handleKeyDownDelete);
    window.removeEventListener('keydown', this.handleKeyDownSearch);

  },
}

</script>



<style scoped>
.toolbar {
  margin-bottom: 20px;
}

.selectBar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.grid-view {
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  min-width: auto;
  min-height: 300px;
}


.file-card {
  width: 120px;
  height: 120px;
  padding: 8px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  position: relative;
  text-align: center;
  overflow: hidden;
  /* 超出隐藏 */
  text-overflow: ellipsis;
  /* 溢出显示省略号 */
  white-space: nowrap;
  /* 不换行 */
}


/* 让除了图片、视频以外的内容上下左右居中 */
.file-card:not(:has(img)):not(:has(video)) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.file-card:not(:has(img)):not(:has(video)) .file-icon {
  font-size: 40px;
  color: #666;
  margin-bottom: 6px;
}

.file-name {
  max-width: 120px;
  margin-top: 6px;
  font-size: 14px;
  word-break: break-all;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.file-card.folder {
  background-color: #f8f8f8;
}

.file-card.selected {
  border-color: #409EFF;
  background: #ecf5ff;
}

/* 选中复选框 */
.select-checkbox {
  position: absolute;
  top: 6px;
  left: 2px;
  z-index: 11;
  width: 16px;
  height: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  /* 默认不可点击 */
}

.file-card:hover .select-checkbox {
  opacity: 1;
  pointer-events: auto;
  /* 鼠标悬停时可点击 */
}

.file-card.selected .select-checkbox {
  opacity: 1 !important;
  pointer-events: auto !important;
}

.dataInfo {
  position: absolute;
  right: 5px;
  bottom: 2px;
  opacity: 0;
  /* 默认隐藏 */
  pointer-events: none;
  /* 不响应鼠标事件 */
  transition: opacity 0.2s;
}


.file-card:hover .dataInfo {
  opacity: 1;
  /* 悬停时显示 */
  pointer-events: auto;
  /* 允许点击/交互 */
}

.file-icon {
  font-size: 32px;
  margin-bottom: 6px;
}

.file-name {
  font-size: 13px;
  word-break: break-word;
}

/* 操作按钮区域 */
.file-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 10;
}

.breadcrumb {
  margin-bottom: 10px;
}

.thumbnail {
  width: 100px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  user-select: none;
  pointer-events: none;
}

.preview-image-wrapper {
  text-align: center;
  padding: 10px;
}

.preview-image-wrapper img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 6px;
  object-fit: contain;
}

.preview-video {
  width: 100%;
  max-height: 70vh;
  border-radius: 6px;
}

.preview-iframe {
  width: 100%;
  height: 500px;
  border: none;
  border-radius: 6px;
}

/* 上传区域居中 */
.upload-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.upload-center .el-upload {
  display: flex;
  justify-content: center;
}

.upload-center .el-upload-dragger {
  margin: auto;
}

.file-manager {
  min-height: 500px;
  position: relative;
}

.context-menu {
  position: fixed;
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  padding: 6px 0;
  z-index: 10000;
  width: 140px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
}

.context-menu li:hover {
  background-color: #f0f0f0;
}

.folder-name {
  cursor: pointer;
  transition: color 0.2s;
}

.folder-name:hover {
  color: #409EFF;
}

.selection-rect {
  position: absolute;
  border: 1px dashed #409EFF;
  background-color: rgba(64, 158, 255, 0.2);
  pointer-events: none;
  z-index: 99;
}

.select-toggle {
  cursor: pointer;
  color: #409EFF;
  /* ElementUI 主色 */
  font-weight: 500;
  user-select: none;
  transition: color 0.2s;
  font-size: 14px;
}

.select-toggle:hover {
  color: #66b1ff;
}
</style>
