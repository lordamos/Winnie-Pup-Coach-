import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import db from './src/db/index.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

app.use(express.json());
app.use(cookieParser());

// --- Auth Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Register (Create Family)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, puppyName, puppyAge, breed } = req.body;
  
  try {
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = db.prepare('INSERT INTO families (puppy_name, puppy_age_weeks, invite_code) VALUES (?, ?, ?)').run(puppyName, puppyAge || 8, inviteCode);
    const familyId = result.lastInsertRowid;

    db.prepare('INSERT INTO puppies (family_id, name, age_weeks, breed) VALUES (?, ?, ?, ?)').run(familyId, puppyName, puppyAge || 8, breed || '');

    const userResult = db.prepare('INSERT INTO users (email, password_hash, family_id) VALUES (?, ?, ?)').run(email, hashedPassword, familyId);
    
    const token = jwt.sign({ id: userResult.lastInsertRowid, familyId }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
    res.json({ success: true, user: { email, familyId }, family: { inviteCode, puppyName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join Family
app.post('/api/auth/join', async (req, res) => {
  const { email, password, inviteCode } = req.body;

  try {
    const family = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(inviteCode);
    if (!family) return res.status(404).json({ error: 'Invalid invite code' });

    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = db.prepare('INSERT INTO users (email, password_hash, family_id) VALUES (?, ?, ?)').run(email, hashedPassword, family.id);

    const token = jwt.sign({ id: userResult.lastInsertRowid, familyId: family.id }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
    res.json({ success: true, user: { email, familyId: family.id }, family: { inviteCode: family.invite_code, puppyName: family.puppy_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(user.family_id);

    const token = jwt.sign({ id: user.id, familyId: user.family_id }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
    res.json({ success: true, user: { email, familyId: user.family_id }, family: { inviteCode: family.invite_code, puppyName: family.puppy_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Check Auth Status
app.get('/api/auth/me', authenticate, (req: any, res) => {
  const familyId = req.user.familyId;
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
  res.json({ user: req.user, family });
});

// Get Data (Tasks, Family Info, Tips)
app.get('/api/data', authenticate, async (req: any, res) => {
  const familyId = req.user.familyId;
  const puppyId = req.query.puppyId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    const puppies = db.prepare('SELECT * FROM puppies WHERE family_id = ?').all(familyId);
    
    if (puppies.length === 0) {
      return res.json({ family, puppies: [], completedTasks: [], tip: null });
    }

    const selectedPuppyId = puppyId ? parseInt(puppyId) : puppies[0].id;
    const selectedPuppy: any = puppies.find((p: any) => p.id === selectedPuppyId) || puppies[0];

    const tasks = db.prepare('SELECT task_index FROM puppy_tasks WHERE puppy_id = ? AND date = ?').all(selectedPuppy.id, today);
    const completedTasks = tasks.map((t: any) => t.task_index);

    // Check for daily tip
    let tip: any = db.prepare('SELECT * FROM puppy_tips WHERE puppy_id = ? AND date = ?').get(selectedPuppy.id, today);

    // Generate AI Tip if missing
    if (!tip && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Generate a short, encouraging, and specific training tip for a ${selectedPuppy.age_weeks}-week-old puppy named ${selectedPuppy.name}${selectedPuppy.breed ? ` (${selectedPuppy.breed})` : ''}. Focus on positive reinforcement. Max 2 sentences.`;
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
        });
        
        const content = response.text || "Consistency is key! Keep up the good work.";
        
        db.prepare('INSERT INTO puppy_tips (puppy_id, date, content) VALUES (?, ?, ?)').run(selectedPuppy.id, today, content);
        tip = { content };
      } catch (e) {
        console.error("AI Tip Gen Error:", e);
        tip = { content: "Remember to reward good behavior immediately!" };
      }
    }

    res.json({ 
      family, 
      puppies,
      selectedPuppyId: selectedPuppy.id,
      completedTasks, 
      tip: tip || { content: "Training takes time. Be patient!" } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat with Amos
app.post('/api/chat', authenticate, async (req: any, res) => {
  const { query, puppyName } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const SYSTEM_PROMPT = `You are "Amos," a master puppy trainer. Your goal is to give the .01% standard of advice for a ${puppyName}, an 8-week old medium breed puppy. The owner is home all day. Use the "Learn, Earn, Return" philosophy. Keep answers short, actionable, and focus on crate training and potty success. Never suggest punishment. Always suggest carrying the puppy to the potty spot and using a leash. If the user asks for a reminder or notification, use the schedule_notification tool.`;
    
    const scheduleNotificationTool = {
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: `[Context: The puppy's name is ${puppyName}] ${query}` }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [scheduleNotificationTool] }],
      },
    });

    const reply = response.text || "";
    const functionCalls = response.functionCalls;

    res.json({ reply, functionCalls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI Error' });
  }
});

// Toggle Task
app.post('/api/data/task', authenticate, (req: any, res) => {
  const { puppyId, taskIndex, completed } = req.body;
  const familyId = req.user.familyId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(puppyId, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    if (completed) {
      db.prepare('INSERT OR IGNORE INTO puppy_tasks (puppy_id, date, task_index) VALUES (?, ?, ?)').run(puppyId, today, taskIndex);
    } else {
      db.prepare('DELETE FROM puppy_tasks WHERE puppy_id = ? AND date = ? AND task_index = ?').run(puppyId, today, taskIndex);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Puppy
app.post('/api/puppies', authenticate, (req: any, res) => {
  const { name, breed, age_weeks, photo_url } = req.body;
  const familyId = req.user.familyId;
  try {
    const result = db.prepare('INSERT INTO puppies (family_id, name, breed, age_weeks, photo_url) VALUES (?, ?, ?, ?, ?)').run(familyId, name, breed, age_weeks, photo_url);
    res.json({ success: true, puppyId: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Puppy
app.put('/api/puppies/:id', authenticate, (req: any, res) => {
  const { name, breed, age_weeks, photo_url } = req.body;
  const familyId = req.user.familyId;
  try {
    db.prepare('UPDATE puppies SET name = ?, breed = ?, age_weeks = ?, photo_url = ? WHERE id = ? AND family_id = ?').run(name, breed, age_weeks, photo_url, req.params.id, familyId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
