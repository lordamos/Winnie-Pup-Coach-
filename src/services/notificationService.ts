export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  static async sendNotification(title: string, body: string) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/dog-icon.png", // Fallback if icon exists
      });
    }
  }

  static scheduleNotification(title: string, body: string, delaySeconds: number) {
    setTimeout(() => {
      this.sendNotification(title, body);
    }, delaySeconds * 1000);
  }

  static isNightTime(timeStr: string): boolean {
    const [hours] = timeStr.split(":").map(Number);
    // Night time defined as 10 PM (22:00) to 6 AM (06:00)
    return hours >= 22 || hours < 6;
  }
}
