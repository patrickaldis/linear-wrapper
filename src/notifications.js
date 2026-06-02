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

    // Linear's inbox sidebar link contains a count badge. We find the inbox
    // link by href, then locate the badge element and read a configured
    // attribute for the numeric count.
    //
    // window.__BADGE_ATTR specifies which attribute on the badge element
    // contains the numeric count (injected by Rust from the --badge-attr
    // CLI flag). When not provided, unread detection is disabled.

    var BADGE_ATTR = window.__BADGE_ATTR || null;

    function getUnreadCount() {
        if (!BADGE_ATTR) return 0;

        // Find the inbox sidebar link
        var inboxLink = document.querySelector('a[href$="/inbox"]');
        if (!inboxLink) return 0;

        // Look for any element inside the link that has the configured attribute
        var badge = inboxLink.querySelector('[' + BADGE_ATTR + ']');
        if (!badge) return 0;

        // Read the attribute value as the count
        var label = badge.getAttribute(BADGE_ATTR);
        if (label) {
            var n = parseInt(label, 10);
            if (!isNaN(n)) return n;
        }

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
