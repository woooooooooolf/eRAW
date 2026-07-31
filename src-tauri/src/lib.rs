mod analysis;
mod commands;
mod raw;

use commands::{
    AppState, analyze_raw_image, cancel_raw_analysis, close_document, export_document,
    inspect_raw_pixels, open_document, render_raw_tile, sample_raw_pixel, save_png,
    update_descriptor,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_document,
            update_descriptor,
            close_document,
            render_raw_tile,
            inspect_raw_pixels,
            analyze_raw_image,
            cancel_raw_analysis,
            sample_raw_pixel,
            export_document,
            save_png,
        ])
        .run(tauri::generate_context!())
        .expect("启动 eRAW 时发生错误");
}
