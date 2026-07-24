use crate::raw::{
    ExportRequest, ExportResult, PixelInspectionRequest, PixelSample, RawDescriptor, RawLayout,
    RawWarning, TileRequest, calculate_layout, cfa_name_at, export_raw, inspect_pixels, read_pixel,
    render_tile,
};
use memmap2::{Mmap, MmapOptions};
use serde::Serialize;
use std::{
    fs::File,
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::{State, ipc::Response};

struct RawDocument {
    path: String,
    name: String,
    file_size: u64,
    map: Option<Arc<Mmap>>,
    descriptor: RawDescriptor,
    layout: RawLayout,
    warnings: Vec<RawWarning>,
    generation: u64,
}

#[derive(Default)]
pub struct AppState {
    document: Mutex<Option<RawDocument>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInfo {
    path: String,
    name: String,
    file_size: u64,
    descriptor: RawDescriptor,
    layout: RawLayout,
    warnings: Vec<RawWarning>,
    generation: u64,
}

impl From<&RawDocument> for DocumentInfo {
    fn from(document: &RawDocument) -> Self {
        Self {
            path: document.path.clone(),
            name: document.name.clone(),
            file_size: document.file_size,
            descriptor: document.descriptor.clone(),
            layout: document.layout,
            warnings: document.warnings.clone(),
            generation: document.generation,
        }
    }
}

fn lock_document<'a>(
    state: &'a State<'_, AppState>,
) -> Result<std::sync::MutexGuard<'a, Option<RawDocument>>, String> {
    state
        .document
        .lock()
        .map_err(|_| "RAW 文档会话已损坏，请重新启动应用".into())
}

#[tauri::command]
pub fn open_document(
    path: String,
    descriptor: RawDescriptor,
    state: State<'_, AppState>,
) -> Result<DocumentInfo, String> {
    let file = File::open(&path).map_err(|error| format!("无法打开 RAW 文件：{error}"))?;
    let file_size = file
        .metadata()
        .map_err(|error| format!("无法读取文件信息：{error}"))?
        .len();
    let map = if file_size == 0 {
        None
    } else {
        // SAFETY: 映射保持只读；Mmap 持有独立映射句柄，源文件不会通过 eRAW 修改。
        Some(Arc::new(
            unsafe { MmapOptions::new().map(&file) }
                .map_err(|error| format!("无法映射 RAW 文件：{error}"))?,
        ))
    };
    let (layout, warnings) = calculate_layout(&descriptor, file_size);
    let name = Path::new(&path)
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("未命名.raw")
        .to_owned();
    let document = RawDocument {
        path,
        name,
        file_size,
        map,
        descriptor,
        layout,
        warnings,
        generation: 1,
    };
    let info = DocumentInfo::from(&document);
    *lock_document(&state)? = Some(document);
    Ok(info)
}

#[tauri::command]
pub fn update_descriptor(
    descriptor: RawDescriptor,
    state: State<'_, AppState>,
) -> Result<DocumentInfo, String> {
    let mut guard = lock_document(&state)?;
    let document = guard.as_mut().ok_or("尚未打开 RAW 文件")?;
    let (layout, warnings) = calculate_layout(&descriptor, document.file_size);
    document.descriptor = descriptor;
    document.layout = layout;
    document.warnings = warnings;
    document.generation = document.generation.wrapping_add(1).max(1);
    Ok(DocumentInfo::from(&*document))
}

#[tauri::command]
pub fn close_document(state: State<'_, AppState>) -> Result<(), String> {
    *lock_document(&state)? = None;
    Ok(())
}

#[tauri::command]
pub async fn render_raw_tile(
    request: TileRequest,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let (map, descriptor, layout, generation) = {
        let guard = lock_document(&state)?;
        let document = guard.as_ref().ok_or("尚未打开 RAW 文件")?;
        (
            document.map.clone(),
            document.descriptor.clone(),
            document.layout,
            document.generation,
        )
    };
    if request.generation != generation {
        return Err("stale_generation".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let bytes: &[u8] = match map.as_ref() {
            Some(value) => value.as_ref(),
            None => &[],
        };
        render_tile(bytes, &descriptor, &layout, &request).map(Response::new)
    })
    .await
    .map_err(|error| format!("瓦片渲染任务异常：{error}"))?
}

#[tauri::command]
pub async fn inspect_raw_pixels(
    request: PixelInspectionRequest,
    state: State<'_, AppState>,
) -> Result<Response, String> {
    let (map, descriptor, layout, generation) = {
        let guard = lock_document(&state)?;
        let document = guard.as_ref().ok_or("尚未打开 RAW 文件")?;
        (
            document.map.clone(),
            document.descriptor.clone(),
            document.layout,
            document.generation,
        )
    };
    if request.generation != generation {
        return Err("stale_generation".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let bytes: &[u8] = match map.as_ref() {
            Some(value) => value.as_ref(),
            None => &[],
        };
        inspect_pixels(bytes, &descriptor, &layout, &request).map(Response::new)
    })
    .await
    .map_err(|error| format!("像素检查任务异常：{error}"))?
}

#[tauri::command]
pub fn sample_raw_pixel(
    x: u32,
    y: u32,
    frame: u64,
    state: State<'_, AppState>,
) -> Result<PixelSample, String> {
    let (map, descriptor, layout) = {
        let guard = lock_document(&state)?;
        let document = guard.as_ref().ok_or("尚未打开 RAW 文件")?;
        (
            document.map.clone(),
            document.descriptor.clone(),
            document.layout,
        )
    };
    let bytes: &[u8] = match map.as_ref() {
        Some(value) => value.as_ref(),
        None => &[],
    };
    Ok(PixelSample {
        x,
        y,
        value: read_pixel(bytes, &descriptor, &layout, frame, x, y),
        channel: cfa_name_at(descriptor.cfa, x, y),
    })
}

#[tauri::command]
pub async fn export_document(
    request: ExportRequest,
    state: State<'_, AppState>,
) -> Result<ExportResult, String> {
    let (map, file_size, source_path, generation) = {
        let guard = lock_document(&state)?;
        let document = guard.as_ref().ok_or("尚未打开 RAW 文件")?;
        (
            document.map.clone(),
            document.file_size,
            document.path.clone(),
            document.generation,
        )
    };
    if request.source_path != source_path || request.source_generation != generation {
        return Err("导出来源快照已失效，请关闭导出窗口后重新打开".into());
    }
    if let (Ok(source), Ok(target)) = (
        std::fs::canonicalize(&source_path),
        std::fs::canonicalize(&request.path),
    ) {
        if source == target {
            return Err("导出路径不能覆盖当前打开的源 RAW 文件".into());
        }
    }
    let descriptor = request.source_descriptor.clone();
    let layout = calculate_layout(&descriptor, file_size).0;
    tauri::async_runtime::spawn_blocking(move || {
        let bytes: &[u8] = match map.as_ref() {
            Some(value) => value.as_ref(),
            None => &[],
        };
        export_raw(bytes, &descriptor, &layout, &request)
    })
    .await
    .map_err(|error| format!("RAW 导出任务异常：{error}"))?
}
