// app.js — Global state, initialization, and event wiring (loaded last)

const AppState = {
  // ── Workspaces ──────────────────────────────────────────────────────────
  workspaces: [],          // ["/path/a", "/path/b"]
  activeWorkspace: null,   // currently active workspace root path

  // ── Current folder ──────────────────────────────────────────────────────
  currentFolder: null,
  allFolderPhotos: [],     // raw scan result (unfiltered PhotoEntry[])
  currentPhotos: [],       // filtered + displayed

  // Per-folder sidecar metadata cache (filename → PhotoMeta)
  // { "IMG_001.jpg": { rating:4, label:"green", flagged:true, rejected:false } }
  folderMeta: {},

  // ── Filters / view ──────────────────────────────────────────────────────
  selectedIndex: -1,
  filterRating: 0,
  filterLabel: '',
  filterFlagged: false,
  currentView: 'grid',     // 'grid' | 'cull'

  // ── Persistence ─────────────────────────────────────────────────────────
  saveWorkspaces: debounce(async function () {
    try {
      await API.saveData({
        workspaces: AppState.workspaces,
        active_workspace: AppState.activeWorkspace,
      });
    } catch (e) {
      console.error('保存工作区失败:', e);
    }
  }, 500),

  saveFolderMeta: debounce(async function () {
    if (!AppState.currentFolder) return;
    try {
      await API.saveFolderMeta(AppState.currentFolder, {
        version: 1,
        photos: AppState.folderMeta,
      });
    } catch (e) {
      console.error('保存元数据失败:', e);
    }
  }, 500),

  // ── Workspace management ─────────────────────────────────────────────────
  async addWorkspace(path) {
    if (!this.workspaces.includes(path)) {
      this.workspaces.push(path);
    }
    await this.switchWorkspace(path);
  },

  async switchWorkspace(path) {
    this.activeWorkspace = path;
    this.selectedIndex = -1;

    // Reset filter state without triggering applyFilters yet
    this.filterRating = 0;
    this.filterLabel = '';
    this.filterFlagged = false;
    FilterBar.resetUI();

    // Reset to grid view and cull sub-mode
    if (this.currentView !== 'grid') {
      _switchView('grid');
    } else {
      Culling.resetMode();
    }

    FolderPanel.renderWorkspaces();
    await FolderPanel.renderTree(path);
    await this.setFolder(path);
    this.saveWorkspaces();
  },

  removeWorkspace(path) {
    this.workspaces = this.workspaces.filter((w) => w !== path);
    if (this.activeWorkspace === path) {
      this.activeWorkspace = this.workspaces[0] || null;
      if (this.activeWorkspace) {
        // Reset state for the new active workspace
        this.selectedIndex = -1;
        this.filterRating = 0;
        this.filterLabel = '';
        this.filterFlagged = false;
        FilterBar.resetUI();
        if (this.currentView !== 'grid') _switchView('grid');
        else Culling.resetMode();
        FolderPanel.renderTree(this.activeWorkspace);
        this.setFolder(this.activeWorkspace);
      } else {
        this.currentFolder = null;
        this.allFolderPhotos = [];
        this.currentPhotos = [];
        PhotoGrid.render([]);
        _updateBreadcrumb('');
        FolderPanel.renderTree(null);
      }
    }
    FolderPanel.renderWorkspaces();
    this.saveWorkspaces();
  },

  // ── Folder scanning ──────────────────────────────────────────────────────
  async setFolder(path) {
    this.currentFolder = path;
    _updateBreadcrumb(path);

    document.getElementById('photo-grid').innerHTML =
      '<div class="empty-state">正在扫描…</div>';

    try {
      const result = await API.scanFolder(path);
      this.allFolderPhotos = result.photos;

      // Build in-memory folderMeta from the scan result
      this.folderMeta = {};
      result.photos.forEach((p) => {
        this.folderMeta[p.filename] = {
          rating: p.rating,
          label: p.label,
          flagged: p.flagged,
          rejected: p.rejected,
        };
      });

      this.applyFilters();
      FolderPanel.updateActiveFolder(path);
    } catch (e) {
      document.getElementById('photo-grid').innerHTML =
        `<div class="empty-state">扫描失败: ${e}</div>`;
    }
  },

  // ── Metadata mutation ────────────────────────────────────────────────────
  updatePhotoMeta(filename, patch) {
    if (!this.folderMeta[filename]) {
      this.folderMeta[filename] = { rating: 0, label: '', flagged: false, rejected: false };
    }
    Object.assign(this.folderMeta[filename], patch);

    // Mirror back into allFolderPhotos so the grid overlay refreshes
    const photo = this.allFolderPhotos.find((p) => p.filename === filename);
    if (photo) Object.assign(photo, patch);
    const cpPhoto = this.currentPhotos.find((p) => p.filename === filename);
    if (cpPhoto) Object.assign(cpPhoto, patch);

    this.saveFolderMeta();
  },

  // ── Filtering ────────────────────────────────────────────────────────────
  applyFilters() {
    let photos = this.allFolderPhotos;
    if (this.filterRating > 0) {
      photos = photos.filter((p) => p.rating === this.filterRating);
    }
    if (this.filterLabel !== '') {
      photos = photos.filter((p) => p.label === this.filterLabel);
    }
    if (this.filterFlagged) {
      photos = photos.filter((p) => p.flagged);
    }
    this.currentPhotos = photos;
    PhotoGrid.render(photos);
    _updatePhotoCount(photos.length, this.allFolderPhotos.length);
    // Refresh culling filmstrip if active
    if (this.currentView === 'cull') {
      Culling.refresh();
    }
  },

  // ── Boot ─────────────────────────────────────────────────────────────────
  async init() {
    try {
      const data = await API.loadData();
      this.workspaces = data.workspaces || [];
      this.activeWorkspace = data.active_workspace || null;
    } catch (e) {
      console.warn('加载工作区失败:', e);
    }

    FolderPanel.renderWorkspaces();

    if (this.activeWorkspace) {
      await FolderPanel.renderTree(this.activeWorkspace);
      await this.setFolder(this.activeWorkspace);
    } else {
      document.getElementById('photo-grid').innerHTML =
        '<div class="empty-state large">点击左侧 <strong>+</strong> 添加照片文件夹</div>';
    }
  },
};

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

function _updateBreadcrumb(path) {
  const el = document.getElementById('breadcrumb');
  if (!path) { el.innerHTML = ''; return; }
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  // Plain text — no per-crumb navigation; whole bar opens Finder on click
  el.innerHTML = parts
    .map((part) => `<span class="crumb">${part}</span>`)
    .join('<span class="crumb-sep">/</span>');
  el.title = '在文件管理器中显示';
}

// One-time listener: clicking the breadcrumb opens the current folder in Finder
document.getElementById('breadcrumb').addEventListener('click', () => {
  if (AppState.currentFolder) API.revealInFinder(AppState.currentFolder);
});

function _updatePhotoCount(shown, total) {
  const el = document.getElementById('photo-count');
  if (!el) return;
  el.textContent = shown === total ? `${total} 张` : `${shown} / ${total} 张`;
}

// ─── View toggling ────────────────────────────────────────────────────────────

document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    _switchView(view);
  });
});

function _switchView(view) {
  AppState.currentView = view;
  document.querySelectorAll('.view-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));

  if (view === 'grid') {
    document.getElementById('photo-grid').classList.add('active');
    document.body.classList.remove('view-cull', 'cull-filter-mode');
  } else if (view === 'cull') {
    document.getElementById('cull-view').classList.add('active');
    document.body.classList.add('view-cull');
    document.body.classList.remove('cull-filter-mode');
    Culling.resetMode();
    Culling.enter(AppState.selectedIndex >= 0 ? AppState.selectedIndex : 0);
  }
}

// ─── Open folder buttons (toolbar + sidebar "+") ─────────────────────────────

async function _openFolderDialog() {
  const folder = await API.pickFolder();
  if (folder) AppState.addWorkspace(folder);
}

document.getElementById('btn-open-folder').addEventListener('click', _openFolderDialog);
document.getElementById('btn-add-workspace').addEventListener('click', _openFolderDialog);

// ─── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  AppState.init();
});
