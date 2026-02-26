// folder-panel.js — Left sidebar: workspace list (top) + folder tree (bottom)

const FolderPanel = (() => {
  const workspaceList = document.getElementById('workspace-list');
  const treeTitle = document.getElementById('folder-tree-title');
  const tree = document.getElementById('folder-tree');

  // ── Workspace list ────────────────────────────────────────────────────────

  function renderWorkspaces() {
    workspaceList.innerHTML = '';

    if (AppState.workspaces.length === 0) {
      workspaceList.innerHTML =
        '<div class="ws-empty">还没有工作区<br>点击 + 添加文件夹</div>';
    }

    AppState.workspaces.forEach((path) => {
      const isActive = path === AppState.activeWorkspace;
      const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path;

      const item = document.createElement('div');
      item.className = 'ws-item' + (isActive ? ' active' : '');
      item.title = path;
      item.innerHTML = `
        <span class="ws-icon">${isActive ? '📂' : '📁'}</span>
        <span class="ws-name">${name}</span>
        <button class="ws-remove" data-path="${path}" title="移除工作区">×</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('ws-remove')) return;
        AppState.switchWorkspace(path);
      });

      item.querySelector('.ws-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.removeWorkspace(path);
      });

      workspaceList.appendChild(item);
    });

    // Update folder tree title
    if (AppState.activeWorkspace) {
      const name = AppState.activeWorkspace
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .pop();
      treeTitle.textContent = name || '文件夹';
    } else {
      treeTitle.textContent = '文件夹';
    }
  }

  // ── Folder tree ───────────────────────────────────────────────────────────

  async function renderTree(rootPath) {
    tree.innerHTML = '';
    if (!rootPath) return;

    const rootName = rootPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || rootPath;
    const ul = document.createElement('ul');
    ul.className = 'folder-tree-root';
    tree.appendChild(ul);

    try {
      const [subfolders, scanResult] = await Promise.all([
        API.listSubfolders(rootPath),
        API.scanFolder(rootPath),
      ]);
      const photos = scanResult.photos;
      const hasContent = subfolders.length > 0 || photos.length > 0;

      // Build the workspace root item (always visible, pre-expanded)
      const li = document.createElement('li');
      li.className = 'folder-item';
      li.dataset.path = rootPath;

      const row = document.createElement('div');
      row.className = 'folder-row' + (rootPath === AppState.currentFolder ? ' active' : '');

      const arrow = document.createElement('span');
      arrow.className = 'folder-arrow' + (hasContent ? '' : ' invisible');
      arrow.textContent = hasContent ? '▼' : '▶';

      const icon = document.createElement('span');
      icon.className = 'folder-icon';
      icon.textContent = '📂';

      const nameEl = document.createElement('span');
      nameEl.className = 'folder-name';
      nameEl.textContent = rootName;

      row.appendChild(arrow);
      row.appendChild(icon);
      row.appendChild(nameEl);
      li.appendChild(row);

      row.addEventListener('click', (e) => {
        if (e.target === arrow) return;
        document.querySelectorAll('.folder-row.active').forEach((el) =>
          el.classList.remove('active')
        );
        row.classList.add('active');
        AppState.setFolder(rootPath);
      });

      if (hasContent) {
        // Pre-expand root: show first-level children immediately
        let expanded = true;
        const subUl = document.createElement('ul');
        subUl.className = 'folder-children';
        subfolders.forEach((sub) => subUl.appendChild(_makeTreeItem(sub)));
        photos.forEach((photo) => subUl.appendChild(_makePhotoItem(photo, rootPath)));
        li.appendChild(subUl);

        arrow.addEventListener('click', (e) => {
          e.stopPropagation();
          expanded = !expanded;
          arrow.textContent = expanded ? '▼' : '▶';
          subUl.style.display = expanded ? '' : 'none';
        });
      }

      ul.appendChild(li);
    } catch (e) {
      console.error('列出子文件夹失败:', e);
    }
  }

  function _makeTreeItem(folder) {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.dataset.path = folder.path;

    const row = document.createElement('div');
    row.className = 'folder-row';
    if (folder.path === AppState.currentFolder) row.classList.add('active');

    const arrow = document.createElement('span');
    arrow.className = 'folder-arrow' + (folder.has_children ? '' : ' invisible');
    arrow.textContent = '▶';

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '📁';

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;

    row.appendChild(arrow);
    row.appendChild(icon);
    row.appendChild(name);
    li.appendChild(row);

    let expanded = false;
    let childrenLoaded = false;

    if (folder.has_children) {
      arrow.addEventListener('click', async (e) => {
        e.stopPropagation();
        expanded = !expanded;
        arrow.textContent = expanded ? '▼' : '▶';

        if (expanded && !childrenLoaded) {
          childrenLoaded = true;
          try {
            const [subs, scanResult] = await Promise.all([
              API.listSubfolders(folder.path),
              API.scanFolder(folder.path),
            ]);
            const subUl = document.createElement('ul');
            subUl.className = 'folder-children';
            subs.forEach((sub) => subUl.appendChild(_makeTreeItem(sub)));
            scanResult.photos.forEach((photo) =>
              subUl.appendChild(_makePhotoItem(photo, folder.path))
            );
            li.appendChild(subUl);
          } catch (err) {
            console.error('加载子文件夹失败:', err);
          }
        } else {
          const children = li.querySelector('.folder-children');
          if (children) children.style.display = expanded ? '' : 'none';
        }
      });
    }

    row.addEventListener('click', (e) => {
      if (e.target === arrow) return;
      document.querySelectorAll('.folder-row.active').forEach((el) =>
        el.classList.remove('active')
      );
      row.classList.add('active');
      AppState.setFolder(folder.path);
    });

    return li;
  }

  function _makePhotoItem(photo, parentFolderPath) {
    const li = document.createElement('li');
    li.className = 'folder-item';

    const row = document.createElement('div');
    row.className = 'folder-row photo-row';

    // Spacer to align with folder items (no expand arrow)
    const spacer = document.createElement('span');
    spacer.className = 'folder-arrow invisible';
    spacer.textContent = '▶';

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '🖼';

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = photo.filename;

    row.appendChild(spacer);
    row.appendChild(icon);
    row.appendChild(name);
    li.appendChild(row);

    // Single click → navigate to folder and select photo in grid
    row.addEventListener('click', async () => {
      if (AppState.currentFolder !== parentFolderPath) {
        await AppState.setFolder(parentFolderPath);
        updateActiveFolder(parentFolderPath);
      }
      const index = AppState.currentPhotos.findIndex((p) => p.path === photo.path);
      if (index >= 0) {
        const fig = document.getElementById('photo-grid').querySelector(`[data-index="${index}"]`);
        if (fig) {
          fig.click();
          fig.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });

    // Double-click → open lightbox
    row.addEventListener('dblclick', async () => {
      if (AppState.currentFolder !== parentFolderPath) {
        await AppState.setFolder(parentFolderPath);
        updateActiveFolder(parentFolderPath);
      }
      const index = AppState.currentPhotos.findIndex((p) => p.path === photo.path);
      if (index >= 0) Lightbox.open(index);
    });

    // Right-click → context menu with rename option
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _showTreeContextMenu(e.clientX, e.clientY, photo, parentFolderPath, name);
    });

    return li;
  }

  // ── Tree context menu ─────────────────────────────────────────────────────

  let _treeCtxMenu = null;

  function _showTreeContextMenu(x, y, photo, parentFolderPath, nameEl) {
    _hideTreeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'tree-ctx-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const renameItem = document.createElement('div');
    renameItem.className = 'tree-ctx-item';
    renameItem.textContent = '重命名';
    renameItem.addEventListener('click', () => {
      _hideTreeContextMenu();
      _startRename(nameEl, photo, parentFolderPath);
    });
    menu.appendChild(renameItem);

    document.body.appendChild(menu);
    _treeCtxMenu = menu;
    setTimeout(() => document.addEventListener('click', _hideTreeContextMenu, { once: true }), 0);
  }

  function _hideTreeContextMenu() {
    if (_treeCtxMenu) { _treeCtxMenu.remove(); _treeCtxMenu = null; }
  }

  function _startRename(nameEl, photo, parentFolderPath) {
    const oldName = photo.filename;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-rename-input';
    input.value = oldName;

    nameEl.replaceWith(input);
    input.focus();
    // Pre-select name without extension
    const dotIdx = oldName.lastIndexOf('.');
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : oldName.length);

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newName = input.value.trim();
      if (!newName || newName === oldName) {
        input.replaceWith(nameEl);
        return;
      }
      try {
        await API.renamePhoto(parentFolderPath, oldName, newName);
        // Update the photo object so future clicks use the new path/name
        const newPath = photo.path.replace(/[^/\\]*$/, newName);
        photo.filename = newName;
        photo.path = newPath;
        nameEl.textContent = newName;
        input.replaceWith(nameEl);
        // Update AppState in-memory if this folder is currently loaded
        if (AppState.currentFolder === parentFolderPath) {
          const ap = AppState.allFolderPhotos.find((p) => p.filename === oldName);
          if (ap) { ap.filename = newName; ap.path = newPath; }
          const cp = AppState.currentPhotos.find((p) => p.filename === oldName);
          if (cp) { cp.filename = newName; cp.path = newPath; }
          if (AppState.folderMeta[oldName] !== undefined) {
            AppState.folderMeta[newName] = AppState.folderMeta[oldName];
            delete AppState.folderMeta[oldName];
          }
          // Refresh the grid item if visible
          const index = AppState.currentPhotos.findIndex((p) => p.filename === newName);
          if (index >= 0) PhotoGrid.refreshItem(index);
        }
      } catch (err) {
        committed = false; // allow retry
        input.replaceWith(nameEl);
        console.error('重命名失败:', err);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; input.replaceWith(nameEl); }
    });
    input.addEventListener('blur', commit);
  }

  // ── Update active folder highlight without rebuilding the tree ────────────

  function updateActiveFolder(path) {
    document.querySelectorAll('.folder-row').forEach((row) => {
      const item = row.closest('.folder-item');
      row.classList.toggle('active', item != null && item.dataset.path === path);
    });
  }

  return { renderWorkspaces, renderTree, updateActiveFolder };
})();
