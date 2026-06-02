#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod badge;
mod commands;
mod tray;
mod window;

use tauri::WindowEvent;

/// Check whether a boolean flag is present in the command-line arguments.
fn has_flag(flag: &str) -> bool {
    std::env::args().any(|a| a == flag)
}

/// Parse a `--key <value>` pair from the command-line arguments.
/// Returns `None` if the flag is not provided.
fn parse_option(flag: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if args[i] == flag {
            if let Some(val) = args.get(i + 1) {
                return Some(val.clone());
            }
        }
    }
    None
}

fn main() {
    let badge_attr = parse_option("--badge-attr");
    let background = has_flag("--background");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![commands::update_unread_count, commands::send_notification])
        .setup(move |app| {
            window::create(app, badge_attr.as_deref(), background)?;
            tray::setup(app)?;
            Ok(())
        })
        // Hide to tray instead of quitting when the window is closed.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = window.hide() {
                    eprintln!("failed to hide window: {e}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start application");
}
