import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import db from './src/db/index.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})
const upload = multer({ storage: storage })

app.use('/uploads', express.static(uploadDir));
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

    const schedule = db.prepare('SELECT * FROM puppy_schedule WHERE puppy_id = ? ORDER BY sort_order ASC, time ASC').all(selectedPuppy.id);

    res.json({ 
      family, 
      puppies,
      selectedPuppyId: selectedPuppy.id,
      completedTasks, 
      tip: tip || { content: "Training takes time. Be patient!" },
      schedule
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat with Amos
app.post('/api/chat', authenticate, async (req: any, res) => {
  const { query, puppyName, puppyAge, puppyBreed } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const SYSTEM_PROMPT = `You are "Amos," a master puppy trainer. Your goal is to give the .01% standard of advice for a ${puppyAge}-week-old ${puppyBreed ? puppyBreed + ' ' : ''}puppy named ${puppyName}. The owner is home all day. Use the "Learn, Earn, Return" philosophy. Keep answers short, actionable, and focus on crate training, potty success, behavior, training techniques, and health concerns. Never suggest punishment. Always suggest carrying the puppy to the potty spot and using a leash. If the user asks for a reminder or notification, use the schedule_notification tool.`;
    
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
    const puppyId = result.lastInsertRowid;
    
    // Insert default schedule for new puppy
    const defaultSchedule = [
      { time: "07:00", task: "Immediate Out", desc: "Carry to grass immediately. No walking!", demo_url: "https://media.giphy.com/media/3o7abAHdYvZdBNkDAS/giphy.gif", demo_type: 'gif' },
      { time: "07:15", task: "Breakfast", desc: "Feed inside the crate for positive vibes." },
      { time: "07:35", task: "Potty Break #2", desc: "The post-breakfast ritual." },
      { time: "08:00", task: "Nap Time", desc: "Mandatory 2-hour crate nap." },
      { time: "10:00", task: "Wake & Potty", desc: "Carry out again." },
      { time: "10:15", task: "Play & Train", desc: "15 mins of tug or basic commands." },
      { time: "11:00", task: "Nap Time", desc: "Back in the crate." },
      { time: "13:00", task: "Lunch & Potty", desc: "Midday meal and break." },
      { time: "14:00", task: "Nap Time", desc: "Rest is crucial for growth." },
      { time: "16:00", task: "Wake & Potty", desc: "Afternoon break." },
      { time: "16:30", task: "Socialization", desc: "Expose to new sounds/sights safely." },
      { time: "17:30", task: "Dinner", desc: "Last meal of the day." },
      { time: "18:00", task: "Potty Break", desc: "Post-dinner outing." },
      { time: "19:00", task: "Wind Down", desc: "Calm chewing or cuddling." },
      { time: "20:00", task: "Final Potty & Bed", desc: "Lights out in the crate." }
    ];
    const insertStmt = db.prepare('INSERT INTO puppy_schedule (puppy_id, time, task, desc, demo_url, demo_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    defaultSchedule.forEach((item, index) => {
      insertStmt.run(puppyId, item.time, item.task, item.desc, item.demo_url || null, item.demo_type || null, index);
    });

    res.json({ success: true, puppyId });
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

// Upload Puppy Photo
app.post('/api/puppies/:id/photo', authenticate, upload.single('photo'), (req: any, res) => {
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE puppies SET photo_url = ? WHERE id = ?').run(photoUrl, req.params.id);
    
    res.json({ success: true, photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Manage Schedule
app.post('/api/puppies/:id/schedule', authenticate, (req: any, res) => {
  const { time, task, desc, demo_url, demo_type } = req.body;
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    const maxSort = db.prepare('SELECT MAX(sort_order) as max FROM puppy_schedule WHERE puppy_id = ?').get(req.params.id) as any;
    const sort_order = (maxSort.max || 0) + 1;

    const result = db.prepare('INSERT INTO puppy_schedule (puppy_id, time, task, desc, demo_url, demo_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.params.id, time, task, desc, demo_url || null, demo_type || null, sort_order);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/puppies/:id/schedule/:scheduleId', authenticate, (req: any, res) => {
  const { time, task, desc, demo_url, demo_type } = req.body;
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    db.prepare('UPDATE puppy_schedule SET time = ?, task = ?, desc = ?, demo_url = ?, demo_type = ? WHERE id = ? AND puppy_id = ?').run(time, task, desc, demo_url || null, demo_type || null, req.params.scheduleId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/puppies/:id/schedule/:scheduleId', authenticate, (req: any, res) => {
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    db.prepare('DELETE FROM puppy_schedule WHERE id = ? AND puppy_id = ?').run(req.params.scheduleId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/puppies/:id/schedule/generate-potty', authenticate, (req: any, res) => {
  const { startTime, endTime, intervalMinutes } = req.body;
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    const maxSort = db.prepare('SELECT MAX(sort_order) as max FROM puppy_schedule WHERE puppy_id = ?').get(req.params.id) as any;
    let currentSort = (maxSort.max || 0) + 1;

    const insertStmt = db.prepare('INSERT INTO puppy_schedule (puppy_id, time, task, desc, sort_order) VALUES (?, ?, ?, ?, ?)');
    
    // Parse times
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let currentTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;

    db.transaction(() => {
      while (currentTotalMinutes <= endTotalMinutes) {
        const h = Math.floor(currentTotalMinutes / 60);
        const m = currentTotalMinutes % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        
        insertStmt.run(req.params.id, timeStr, "Potty Break", "Scheduled potty break reminder.", currentSort++);
        
        currentTotalMinutes += intervalMinutes;
      }
    })();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/puppies/:id/schedule/reorder', authenticate, (req: any, res) => {
  const { scheduleIds } = req.body; // Array of IDs in new order
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.id, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });

    const updateStmt = db.prepare('UPDATE puppy_schedule SET sort_order = ? WHERE id = ? AND puppy_id = ?');
    db.transaction(() => {
      scheduleIds.forEach((id: number, index: number) => {
        updateStmt.run(index, id, req.params.id);
      });
    })();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Naps
app.get('/api/puppies/:puppyId/naps', authenticate, (req: any, res) => {
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.puppyId, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });
    const naps = db.prepare('SELECT * FROM puppy_naps WHERE puppy_id = ?').all(req.params.puppyId);
    res.json(naps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Nap
app.post('/api/puppies/:puppyId/naps', authenticate, (req: any, res) => {
  const { start_time, end_time, day_of_week } = req.body;
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.puppyId, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });
    const result = db.prepare('INSERT INTO puppy_naps (puppy_id, start_time, end_time, day_of_week) VALUES (?, ?, ?, ?)').run(req.params.puppyId, start_time, end_time, day_of_week);
    res.json({ success: true, napId: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Nap
app.delete('/api/puppies/:puppyId/naps/:napId', authenticate, (req: any, res) => {
  const familyId = req.user.familyId;
  try {
    const puppy = db.prepare('SELECT id FROM puppies WHERE id = ? AND family_id = ?').get(req.params.puppyId, familyId);
    if (!puppy) return res.status(403).json({ error: 'Unauthorized' });
    db.prepare('DELETE FROM puppy_naps WHERE id = ? AND puppy_id = ?').run(req.params.napId, req.params.puppyId);
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
