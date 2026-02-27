import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { NotificationService } from "./notificationService";

const SYSTEM_PROMPT = `You are "Amos," a master puppy trainer. Your goal is to give the .01% standard of advice for a Winnie, an 8-week old medium breed puppy. The owner is home all day. Use the "Learn, Earn, Return" philosophy. Keep answers short, actionable, and focus on crate training and potty success. Never suggest punishment. Always suggest carrying the puppy to the potty spot and using a leash. If the user asks for a reminder or notification, use the schedule_notification tool.`;

const scheduleNotificationTool: FunctionDeclaration = {
  name: "schedule_notification",
  description: "Schedule a browser notification to remind the user about a task.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title of the notification" },
      body: { type: Type.STRING, description: "The body text of the notification" },
      delaySeconds: { type: Type.NUMBER, description: "Delay in seconds before sending the notification" },
    },
    required: ["title", "body", "delaySeconds"],
  },
};

export async function askAmos(query: string, puppyName: string = "Winnie") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: `[Context: The puppy's name is ${puppyName}] ${query}` }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [scheduleNotificationTool] }],
    },
  });

  let reply = response.text || "";

  const functionCalls = response.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    for (const call of functionCalls) {
      if (call.name === "schedule_notification") {
        const args = call.args as { title: string; body: string; delaySeconds: number };
        NotificationService.scheduleNotification(args.title, args.body, args.delaySeconds);
        reply += `\n\n(I've also scheduled a reminder: "${args.title}" in ${args.delaySeconds} seconds.)`;
      }
    }
  }

  return reply || "I'm having trouble thinking right now. Check the leash!";
}
