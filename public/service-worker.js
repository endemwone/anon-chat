// Anon Chat — Service Worker for Web Push Notifications

self.addEventListener("push", (event) => {
    let data = { title: "Anon Chat", body: "New message" };

    try {
        data = event.data.json();
    } catch (e) {
        // fallback to plain text
        data.body = event.data ? event.data.text() : "New message";
    }

    const options = {
        body: data.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
        data: { roomCode: data.roomCode || "" },
        tag: `anonchat-${data.roomCode || "msg"}`, // group notifications per room
        renotify: true,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    // Focus the existing tab or open a new one
    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin)) {
                        return client.focus();
                    }
                }
                return self.clients.openWindow("/");
            })
    );
});
