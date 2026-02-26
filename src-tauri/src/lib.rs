use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

// ─────────────────────────────────────────────
// Data models
// ─────────────────────────────────────────────

/// Per-photo metadata stored inside .photo_meta.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PhotoMeta {
    #[serde(default)]
    pub rating: u8,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub flagged: bool,
    #[serde(default)]
    pub rejected: bool,
}

/// Contents of {folder}/.photo_meta.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FolderMeta {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub photos: HashMap<String, PhotoMeta>, // key = filename (not full path)
}

fn default_version() -> u32 {
    1
}

/// Global app data — workspaces list only
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppData {
    #[serde(default)]
    pub workspaces: Vec<String>,
    pub active_workspace: Option<String>,
}

/// A single photo entry returned from scan_folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoEntry {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub modified: u64,
    pub rating: u8,
    pub label: String,
    pub flagged: bool,
    pub rejected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderScanResult {
    pub photos: Vec<PhotoEntry>,
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExifData {
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub iso: Option<u32>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<String>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

fn supported_extensions() -> HashSet<&'static str> {
    ["jpg", "jpeg", "png", "webp", "heic", "heif", "tiff", "tif", "gif", "bmp", "avif"]
        .iter()
        .cloned()
        .collect()
}

fn app_data_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir.join("data.json"))
}

fn folder_meta_file(folder_path: &str) -> std::path::PathBuf {
    std::path::Path::new(folder_path).join(".photo_meta.json")
}

fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("选择照片文件夹")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });
    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn scan_folder(folder_path: String) -> Result<FolderScanResult, String> {
    let exts = supported_extensions();

    // Load per-folder metadata sidecar
    let meta_file = folder_meta_file(&folder_path);
    let folder_meta: FolderMeta = if meta_file.exists() {
        let contents = std::fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&contents).unwrap_or_default()
    } else {
        FolderMeta::default()
    };

    let mut photos: Vec<PhotoEntry> = Vec::new();

    for entry in WalkDir::new(&folder_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if !exts.contains(ext.as_str()) {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let fs_meta = std::fs::metadata(path).ok();
        let size = fs_meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = fs_meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Merge with per-folder sidecar metadata
        let pm = folder_meta.photos.get(&filename).cloned().unwrap_or_default();

        photos.push(PhotoEntry {
            path: path_str,
            filename,
            size,
            modified,
            rating: pm.rating,
            label: pm.label,
            flagged: pm.flagged,
            rejected: pm.rejected,
        });
    }

    // Sort by modified descending (newest first)
    photos.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(FolderScanResult {
        photos,
        folder_path,
    })
}

#[tauri::command]
async fn load_folder_meta(folder_path: String) -> Result<FolderMeta, String> {
    let meta_file = folder_meta_file(&folder_path);
    if !meta_file.exists() {
        return Ok(FolderMeta::default());
    }
    let contents = std::fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_folder_meta(folder_path: String, meta: FolderMeta) -> Result<(), String> {
    let meta_file = folder_meta_file(&folder_path);
    let json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    atomic_write(&meta_file, &json)
}

#[tauri::command]
async fn list_subfolders(folder_path: String) -> Result<Vec<FolderNode>, String> {
    let exts = supported_extensions();
    let dir = std::fs::read_dir(&folder_path).map_err(|e| e.to_string())?;
    let mut folders: Vec<FolderNode> = Vec::new();

    for entry in dir.filter_map(|e| e.ok()) {
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if !meta.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path().to_string_lossy().to_string();
        let has_children = std::fs::read_dir(&path)
            .ok()
            .map(|rd| {
                rd.filter_map(|e| e.ok()).any(|e| {
                    if let Ok(m) = e.metadata() {
                        if m.is_dir() {
                            let n = e.file_name().to_string_lossy().to_lowercase();
                            return !n.starts_with('.');
                        }
                        // Also treat photo files as children
                        let ext = e
                            .path()
                            .extension()
                            .and_then(|ex| ex.to_str())
                            .map(|ex| ex.to_lowercase())
                            .unwrap_or_default();
                        exts.contains(ext.as_str())
                    } else {
                        false
                    }
                })
            })
            .unwrap_or(false);

        folders.push(FolderNode {
            name,
            path,
            has_children,
        });
    }

    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(folders)
}

#[tauri::command]
async fn get_exif_data(path: String) -> Result<ExifData, String> {
    use exif::{In, Tag};

    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut bufreader = std::io::BufReader::new(file);
    let exifreader = exif::Reader::new();

    let exif = match exifreader.read_from_container(&mut bufreader) {
        Ok(e) => e,
        Err(_) => {
            return Ok(ExifData {
                date_taken: None,
                camera_make: None,
                camera_model: None,
                iso: None,
                aperture: None,
                shutter_speed: None,
                focal_length: None,
                gps_lat: None,
                gps_lon: None,
                width: None,
                height: None,
            });
        }
    };

    let field_str = |tag: Tag| -> Option<String> {
        exif.get_field(tag, In::PRIMARY)
            .map(|f| f.display_value().to_string())
    };

    let field_u32 = |tag: Tag| -> Option<u32> {
        exif.get_field(tag, In::PRIMARY)
            .and_then(|f| match f.value {
                exif::Value::Short(ref v) => v.first().map(|&x| x as u32),
                exif::Value::Long(ref v) => v.first().copied(),
                _ => None,
            })
    };

    let gps_dms_to_decimal = |tag: Tag, ref_tag: Tag| -> Option<f64> {
        let field = exif.get_field(tag, In::PRIMARY)?;
        let ref_field = exif.get_field(ref_tag, In::PRIMARY)?;
        if let exif::Value::Rational(ref rationals) = field.value {
            if rationals.len() >= 3 {
                let deg = rationals[0].to_f64();
                let min = rationals[1].to_f64();
                let sec = rationals[2].to_f64();
                let decimal = deg + min / 60.0 + sec / 3600.0;
                let ref_str = ref_field.display_value().to_string();
                if ref_str.contains('S') || ref_str.contains('W') {
                    return Some(-decimal);
                }
                return Some(decimal);
            }
        }
        None
    };

    Ok(ExifData {
        date_taken: field_str(Tag::DateTimeOriginal).or_else(|| field_str(Tag::DateTime)),
        camera_make: field_str(Tag::Make),
        camera_model: field_str(Tag::Model),
        iso: field_u32(Tag::PhotographicSensitivity),
        aperture: field_str(Tag::FNumber),
        shutter_speed: field_str(Tag::ExposureTime),
        focal_length: field_str(Tag::FocalLength),
        gps_lat: gps_dms_to_decimal(Tag::GPSLatitude, Tag::GPSLatitudeRef),
        gps_lon: gps_dms_to_decimal(Tag::GPSLongitude, Tag::GPSLongitudeRef),
        width: field_u32(Tag::PixelXDimension),
        height: field_u32(Tag::PixelYDimension),
    })
}

#[tauri::command]
async fn rename_photo(folder_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let folder = std::path::Path::new(&folder_path);
    let old_path = folder.join(&old_name);
    let new_path = folder.join(&new_name);

    if !old_path.exists() {
        return Err(format!("文件不存在: {}", old_name));
    }
    if new_path.exists() {
        return Err(format!("文件已存在: {}", new_name));
    }

    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    // Update sidecar: move metadata entry from old key to new key
    let meta_file = folder_meta_file(&folder_path);
    if meta_file.exists() {
        let contents = std::fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
        let mut folder_meta: FolderMeta = serde_json::from_str(&contents).unwrap_or_default();
        if let Some(meta) = folder_meta.photos.remove(&old_name) {
            folder_meta.photos.insert(new_name, meta);
            let json = serde_json::to_string_pretty(&folder_meta).map_err(|e| e.to_string())?;
            atomic_write(&meta_file, &json)?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn load_data(app: AppHandle) -> Result<AppData, String> {
    let data_file = app_data_file(&app)?;
    if !data_file.exists() {
        return Ok(AppData::default());
    }
    let contents = std::fs::read_to_string(&data_file).map_err(|e| e.to_string())?;
    // Tolerant parse: if schema changed, fall back to default
    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_data(app: AppHandle, data: AppData) -> Result<(), String> {
    let data_file = app_data_file(&app)?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    atomic_write(&data_file, &json)
}

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            scan_folder,
            load_folder_meta,
            save_folder_meta,
            list_subfolders,
            get_exif_data,
            load_data,
            save_data,
            rename_photo,
            reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
