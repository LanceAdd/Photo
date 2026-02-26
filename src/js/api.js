// api.js — All Tauri IPC wrappers (single point of contact with window.__TAURI__)

const API = (() => {
  const invoke = window.__TAURI__.core.invoke;
  const convertFileSrc = window.__TAURI__.core.convertFileSrc;

  return {
    pickFolder: () =>
      invoke('pick_folder'),

    scanFolder: (folderPath) =>
      invoke('scan_folder', { folderPath }),

    loadFolderMeta: (folderPath) =>
      invoke('load_folder_meta', { folderPath }),

    saveFolderMeta: (folderPath, meta) =>
      invoke('save_folder_meta', { folderPath, meta }),

    listSubfolders: (folderPath) =>
      invoke('list_subfolders', { folderPath }),

    getExifData: (path) =>
      invoke('get_exif_data', { path }),

    // Global app data — workspaces list only
    loadData: () =>
      invoke('load_data'),

    saveData: (data) =>
      invoke('save_data', { data }),

    // Convert an absolute file path to an asset:// URL the WebView can load
    toImageUrl: (absolutePath) =>
      convertFileSrc(absolutePath),

    // Reveal a folder or file in the system file manager (Finder on macOS)
    revealInFinder: (path) =>
      invoke('reveal_in_finder', { path }),

    // Rename a photo file and update the sidecar metadata
    renamePhoto: (folderPath, oldName, newName) =>
      invoke('rename_photo', { folderPath, oldName, newName }),
  };
})();
