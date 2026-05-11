use tauri::webview::{PageLoadEvent, WebviewWindowBuilder};

/// The Linear URL loaded into the webview.
const LINEAR_URL: &str = "https://linear.app/obsidiansystems";

/// JavaScript injected on every page load to bridge browser notifications
/// to native OS notifications. See `src/notifications.js` for details.
const NOTIFICATION_SCRIPT: &str = include_str!("notifications.js");

/// Create the main webview window pointing at Linear.
///
/// The notification-bridging script is injected after every page load so it
/// survives SPA navigations and redirects within linear.app.
pub fn create(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let url = LINEAR_URL
        .parse()
        .expect("hardcoded Linear URL is invalid");

    WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
        .title("Linear")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .zoom_hotkeys_enabled(true)
        .on_page_load(move |webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                if let Err(e) = webview.eval(NOTIFICATION_SCRIPT) {
                    eprintln!("failed to inject notification script: {e}");
                }
            }
        })
        .build()?;

    Ok(())
}
