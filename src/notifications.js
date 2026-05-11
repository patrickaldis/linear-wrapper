// Injected on every page load to:
//
// 1. Bridge browser notifications to native OS notifications via Tauri's
//    notification plugin.
// 2. Detect unread notifications and forward the count to the Rust backend so
//    the tray icon badge can be updated.
//
// Unread detection is a placeholder — the actual logic for extracting the
// notification count from Linear's UI will be implemented later.
//
// We poll every second and send the result to Rust via IPC.

(function() {
    if (window.__notificationOverrideInstalled) return;
    window.__notificationOverrideInstalled = true;

    // --- Notification bridge ---------------------------------------------------

    // Override the browser Notification API to forward notifications to the
    // native OS via Tauri's notification plugin. We do NOT call the original
    // Notification constructor because WebKitGTK doesn't support web
    // notifications.

    window.Notification = function(title, options) {
        // Send via our Rust command which calls the notification plugin from
        // the Rust side — the JS plugin API silently fails on some setups.
        if (window.__TAURI__ && window.__TAURI__.core) {
            window.__TAURI__.core.invoke('send_notification', {
                title: title,
                body: options?.body || '',
            });
        }
        // Return a minimal stub so callers don't crash.
        this.title = title;
        this.body = options?.body || '';
        this.close = function() {};
    };

    window.Notification.requestPermission = function() {
        return Promise.resolve('granted');
    };

    Object.defineProperty(window.Notification, 'permission', {
        get: function() { return 'granted'; }
    });

    // --- Unread count detection ------------------------------------------------

    function getUnreadCount() {
        // Placeholder: actual Linear notification count extraction will be
        // implemented later.
        return 0;
    }

    var lastCount = -1;

    function pollUnreadCount() {
        if (!window.__TAURI__ || !window.__TAURI__.core) return;

        var count = getUnreadCount();

        // Only invoke the Rust command when the count actually changes.
        if (count !== lastCount) {
            lastCount = count;
            window.__TAURI__.core.invoke('update_unread_count', { count: count });
        }
    }

    // Poll every second.
    setInterval(pollUnreadCount, 1000);

    // Also run once immediately in case the page already has unreads.
    pollUnreadCount();
})();
