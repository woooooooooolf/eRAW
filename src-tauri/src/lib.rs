mod commands;
mod raw;

use commands::{
    AppState, close_document, export_document, open_document, render_raw_tile, sample_raw_pixel,
    update_descriptor,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_document,
            update_descriptor,
            close_document,
            render_raw_tile,
            sample_raw_pixel,
            export_document,
        ])
        .run(tauri::generate_context!())
        .expect("启动 eRAW 时发生错误");
}
