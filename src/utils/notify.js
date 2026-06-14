export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

export function sendBrowserNotification(title, body, receiveAlerts, url = null) {
  if (!receiveAlerts) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const options = {
    body: body,
    badge: "/favicon.svg",
    silent: false,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  const notification = new Notification(title, options);
  if (url) {
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.href = url;
    };
  }
}