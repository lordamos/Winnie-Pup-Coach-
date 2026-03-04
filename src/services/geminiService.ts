import { NotificationService } from "./notificationService";

export async function askAmos(query: string, puppyName: string = "Winnie") {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, puppyName }),
  });

  if (!res.ok) {
    throw new Error('Failed to fetch AI response');
  }

  const data = await res.json();
  let reply = data.reply || "";

  if (data.functionCalls && data.functionCalls.length > 0) {
    for (const call of data.functionCalls) {
      if (call.name === "schedule_notification") {
        const args = call.args as { title: string; body: string; delaySeconds: number };
        NotificationService.scheduleNotification(args.title, args.body, args.delaySeconds);
        reply += `\n\n(I've also scheduled a reminder: "${args.title}" in ${args.delaySeconds} seconds.)`;
      }
    }
  }

  return reply || "I'm having trouble thinking right now. Check the leash!";
}
