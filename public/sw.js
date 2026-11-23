// 먹킷 서비스 워커 — 푸시 알림 표시 · 눌렀을 때 화면 열기만 한다 (오프라인 캐시 없음)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "먹킷", body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/home";
  event.waitUntil(
    self.registration.showNotification(data.title || "먹킷", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: data.tag || undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => w.url === url);
      if (same) return same.focus();
      const any = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (any) return any.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});
