export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

export const sendSystemNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        silent: false,
        tag: 'trade-signal'
      });

      setTimeout(() => notification.close(), 8000);

      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn("Notification failed", e);
    }
  }
};
