import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dog, 
  CalendarCheck, 
  RotateCcw, 
  Sparkles, 
  Send, 
  LayoutGrid, 
  MessageCircle, 
  Settings, 
  Check,
  Bell,
  BellOff,
  PlayCircle,
  X,
  Clock,
  Lightbulb,
  LogOut,
  Copy,
  Mic,
  MicOff,
  Moon,
  Footprints,
  Utensils,
  Map,
  Upload,
  Edit,
  Trash2,
  Plus,
  GripVertical,
  Dumbbell
} from 'lucide-react';
import { askAmos } from './services/geminiService';
import { NotificationService } from './services/notificationService';
import { api } from './services/api';
import { LoginView } from './components/LoginView';

interface ScheduleItem {
  id?: number;
  time: string;
  task: string;
  desc: string;
  demoUrl?: string;
  demoType?: 'video' | 'gif';
}

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
};

const VideoModal = ({ url, type, onClose }: { url: string, type: 'video' | 'gif', onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
      <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-lg dark:text-white">Training Demo</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-300">
          <X size={24} />
        </button>
      </div>
      <div className="aspect-video bg-black flex items-center justify-center">
        {type === 'video' ? (
          <video src={url} controls autoPlay className="w-full h-full object-contain" />
        ) : (
          <img src={url} alt="Training Demo" className="w-full h-full object-contain" />
        )}
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 text-center">
        Tap outside to close
      </div>
    </div>
  </div>
);

const TimeShiftModal = ({ currentOffset, onSave, onClose }: { currentOffset: number, onSave: (offset: number) => void, onClose: () => void }) => {
  const [startTime, setStartTime] = useState(addMinutes("07:00", currentOffset));

  const handleSave = () => {
    const [h, m] = startTime.split(':').map(Number);
    const originalStart = 7 * 60; // 07:00 in minutes
    const newStart = h * 60 + m;
    const offset = newStart - originalStart;
    onSave(offset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2 dark:text-white">Shift Schedule</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Running late? Adjust the start time and the whole day will shift.</p>
        
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Day Start Time</label>
          <input 
            type="time" 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full text-2xl font-bold p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
            Update Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  public state = { hasError: false, error: null };
  public props: {children: React.ReactNode};
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.props = props;
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-600 bg-red-50 min-h-screen">
          <h2 className="text-xl font-bold mb-2">App Crashed</h2>
          <pre className="text-xs overflow-auto bg-white p-4 rounded border border-red-200">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [user, setUser] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'amos', text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem('pupNotifications') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [lastNotifiedTask, setLastNotifiedTask] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ url: string, type: 'video' | 'gif' } | null>(null);
  const [scheduleOffset, setScheduleOffset] = useState(() => {
    try {
      const saved = localStorage.getItem('pupScheduleOffset');
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [puppies, setPuppies] = useState<any[]>([]);
  const [selectedPuppyId, setSelectedPuppyId] = useState<number | null>(null);
  const [showAddPuppyModal, setShowAddPuppyModal] = useState(false);
  const [newPuppyName, setNewPuppyName] = useState('');
  const [newPuppyAge, setNewPuppyAge] = useState(8);
  const [newPuppyBreed, setNewPuppyBreed] = useState('');
  const [newPuppyPhoto, setNewPuppyPhoto] = useState('');

  const [puppyName, setPuppyName] = useState("Winnie");
  const [puppyBreed, setPuppyBreed] = useState("");
  const [puppyAge, setPuppyAge] = useState(8);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [naps, setNaps] = useState<any[]>([]);
  const [dailyTip, setDailyTip] = useState<string | null>(null);
  const [showTimeShiftModal, setShowTimeShiftModal] = useState(false);
  const [showEditScheduleModal, setShowEditScheduleModal] = useState(false);
  const [showPottyModal, setShowPottyModal] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [currentView, setCurrentView] = useState<'schedule' | 'chat' | 'settings' | 'naps' | 'edit-schedule'>('schedule');
  const [use24HourTime, setUse24HourTime] = useState(() => {
    try {
      return localStorage.getItem('pupUse24HourTime') === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (currentView === 'naps' && selectedPuppyId) {
      api.getNaps(selectedPuppyId).then(setNaps);
    }
  }, [currentView, selectedPuppyId]);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('pupDarkMode');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const [isListening, setIsListening] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Auth on Mount
  useEffect(() => {
    api.checkAuth().then(data => {
      if (data) {
        setUser(data.user);
        setFamily(data.family);
        setPuppyName(data.family.puppy_name);
        fetchData();
      }
      setLoading(false);
    });
  }, []);

  const fetchData = async (puppyId?: number) => {
    try {
      const data = await api.getData(puppyId);
      setCompletedTasks(data.completedTasks);
      setDailyTip(data.tip?.content || null);
      if (data.schedule) {
        setScheduleData(data.schedule);
      }
      if (data.family) {
        setFamily(data.family);
      }
      if (data.puppies) {
        setPuppies(data.puppies);
        setSelectedPuppyId(data.selectedPuppyId);
        const selected = data.puppies.find((p: any) => p.id === data.selectedPuppyId);
        if (selected) {
          setPuppyName(selected.name);
          setPuppyBreed(selected.breed || '');
          setPuppyAge(selected.age_weeks || 8);
        }
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  // Memoize the adjusted schedule
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newSchedule = [...scheduleData];
    const draggedItem = newSchedule[draggedItemIndex];
    newSchedule.splice(draggedItemIndex, 1);
    newSchedule.splice(index, 0, draggedItem);
    
    setDraggedItemIndex(index);
    setScheduleData(newSchedule);
  };

  const handleDragEnd = async () => {
    setDraggedItemIndex(null);
    if (!selectedPuppyId) return;
    
    // Save new order to backend
    const scheduleIds = scheduleData.map(item => item.id).filter(id => id !== undefined) as number[];
    try {
      await api.reorderSchedule(selectedPuppyId, scheduleIds);
    } catch (e) {
      console.error("Failed to save new schedule order", e);
    }
  };

  const currentSchedule = React.useMemo(() => {
    if (scheduleOffset === 0) return scheduleData;
    return scheduleData.map(item => ({
      ...item,
      time: addMinutes(item.time, scheduleOffset)
    }));
  }, [scheduleOffset, scheduleData]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAndNotify(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [notificationsEnabled, lastNotifiedTask, scheduleOffset]);

  useEffect(() => {
    try {
      localStorage.setItem('pupScheduleOffset', String(scheduleOffset));
    } catch (e) {}
  }, [scheduleOffset]);

  useEffect(() => {
    try {
      localStorage.setItem('pupNotifications', String(notificationsEnabled));
    } catch (e) {}
  }, [notificationsEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('pupUse24HourTime', String(use24HourTime));
    } catch (e) {}
  }, [use24HourTime]);

  useEffect(() => {
    try {
      localStorage.setItem('pupDarkMode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  }, [darkMode]);

  useEffect(() => {
    if (currentView === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, currentView]);

  const formatTime = (timeStr: string) => {
    if (use24HourTime) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
  };

  const playNapSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playNote(329.63, now, 1); // E4
      playNote(261.63, now + 0.5, 1.5); // C4
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const checkAndNotify = (now: Date) => {
    if (!notificationsEnabled) return;

    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const currentTask = currentSchedule.find(item => item.time === timeStr);

    if (currentTask && lastNotifiedTask !== currentTask.time) {
      const isNight = NotificationService.isNightTime(currentTask.time);
      const title = isNight ? `🌙 Night Potty: ${currentTask.task}` : `🐾 Potty Time: ${currentTask.task}`;
      NotificationService.sendNotification(title, currentTask.desc);
      setLastNotifiedTask(currentTask.time);

      if (currentTask.task.toLowerCase().includes('nap')) {
        playNapSound();
      }
    }
  };

  const toggleTask = async (index: number) => {
    if (!selectedPuppyId) return;
    const isCompleted = completedTasks.includes(index);
    // Optimistic update
    setCompletedTasks(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
    
    try {
      await api.toggleTask(selectedPuppyId, index, !isCompleted);
    } catch (e) {
      // Revert if failed
      setCompletedTasks(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    }
  };

  const resetDay = () => {
    if (confirm("Reset all checkmarks for today?")) {
      setCompletedTasks([]);
      // TODO: Add API for reset if needed, or just loop toggle
    }
  };

  const handleAskAI = async () => {
    if (!userInput.trim() || isAiLoading) return;

    const query = userInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: query }]);
    setUserInput('');
    setIsAiLoading(true);

    try {
      const reply = await askAmos(query, puppyName, puppyAge, puppyBreed);
      setChatMessages(prev => [...prev, { role: 'amos', text: reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'amos', text: "Connection error. Try again." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await NotificationService.requestPermission();
      if (granted) {
        setNotificationsEnabled(true);
        NotificationService.sendNotification("Notifications Enabled!", `You'll get alerts for ${puppyName}'s schedule.`);
      } else {
        alert("Please enable notification permissions in your browser settings.");
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleLogin = (user: any, family: any) => {
    setUser(user);
    setFamily(family);
    setPuppyName(family.puppyName);
    fetchData();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setFamily(null);
  };

  const handleAddPuppy = async () => {
    if (!newPuppyName.trim()) return;
    try {
      const res = await api.addPuppy(newPuppyName, newPuppyAge, newPuppyBreed, newPuppyPhoto);
      setShowAddPuppyModal(false);
      setNewPuppyName('');
      setNewPuppyBreed('');
      setNewPuppyPhoto('');
      setNewPuppyAge(8);
      fetchData(res.puppyId);
    } catch (e) {
      alert("Failed to add puppy");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPuppyId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const res = await api.uploadPhoto(selectedPuppyId, file);
      if (res.success) {
        const newPuppies = [...puppies];
        const index = newPuppies.findIndex(p => p.id === selectedPuppyId);
        if (index !== -1) {
          newPuppies[index].photo_url = res.photoUrl;
          setPuppies(newPuppies);
        }
        alert("Photo uploaded successfully!");
      }
    } catch (err) {
      alert("Failed to upload photo");
    }
  };

  const handleUpdateSettings = async () => {
    if (!selectedPuppyId) return;
    const selected = puppies.find(p => p.id === selectedPuppyId);
    if (!selected) return;
    try {
      await api.updatePuppy(selectedPuppyId, puppyName, puppyAge, puppyBreed, selected.photo_url);
      alert("Settings saved!");
      fetchData(selectedPuppyId);
    } catch (e) {
      alert("Failed to update settings");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  const currentTimeStr = currentTime.getHours().toString().padStart(2, '0') + ":" + currentTime.getMinutes().toString().padStart(2, '0');
  const nextTask = currentSchedule.find((item, index) => !completedTasks.includes(index) && item.time >= currentTimeStr) || null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-50 px-4 py-4 flex justify-between items-center shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-2">
          {puppies.find(p => p.id === selectedPuppyId)?.photo_url ? (
            <img 
              src={puppies.find(p => p.id === selectedPuppyId)?.photo_url} 
              alt={puppyName} 
              className="w-10 h-10 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Dog size={24} />
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight leading-none">{puppyName}'s <span className="text-blue-600">Pup Coach</span></h1>
            {puppies.length > 1 && (
              <select 
                value={selectedPuppyId || ''} 
                onChange={(e) => fetchData(Number(e.target.value))}
                className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none mt-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {puppies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleNotifications}
            className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-300'}`}
          >
            {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !use24HourTime })}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Status Card */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg"
              >
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Up Next</p>
                <h2 className="text-2xl font-bold mb-2">{nextTask ? nextTask.task : "Sleep Time"}</h2>
                <p className="text-blue-50/80 text-sm">{nextTask ? nextTask.desc : "Pup should be dreaming. Rest up!"}</p>
              </motion.div>

              {/* Daily Tip Card */}
              {dailyTip && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-xl p-4 flex gap-3 items-start"
                >
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm mb-1">Daily Training Tip</h3>
                    <p className="text-amber-800 dark:text-amber-200/80 text-xs leading-relaxed">{dailyTip}</p>
                  </div>
                </motion.div>
              )}

              {/* Schedule Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                    <CalendarCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Today's Schedule
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => setShowTimeShiftModal(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                      <Clock className="w-3 h-3" /> Adjust Time
                    </button>
                    <button onClick={resetDay} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {currentSchedule.map((item, index) => {
                    const isCompleted = completedTasks.includes(index);
                    const isActive = nextTask?.time === item.time;
                    const isNight = NotificationService.isNightTime(item.time);
                    
                    const isNap = item.task.toLowerCase().includes('nap');
                    const isWalk = item.task.toLowerCase().includes('walk');
                    const isPotty = item.task.toLowerCase().includes('potty') || item.task.toLowerCase().includes('out');
                    const isFood = item.task.toLowerCase().includes('breakfast') || item.task.toLowerCase().includes('dinner') || item.task.toLowerCase().includes('lunch');
                    const isTrain = item.task.toLowerCase().includes('train') || item.task.toLowerCase().includes('play');

                    let typeColor = 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800';
                    let typeIcon = null;

                    if (isActive) {
                      typeColor = 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900/40 dark:border-blue-800 dark:ring-blue-900';
                    } else if (isNap) {
                      typeColor = 'border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-900/20';
                      typeIcon = <Moon size={14} className="text-indigo-400 dark:text-indigo-300" />;
                    } else if (isWalk) {
                      typeColor = 'border-teal-100 bg-teal-50/30 dark:border-teal-900/50 dark:bg-teal-900/20';
                      typeIcon = <Map size={14} className="text-teal-500 dark:text-teal-400" />;
                    } else if (isPotty) {
                      typeColor = 'border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-900/20';
                      typeIcon = <Footprints size={14} className="text-emerald-500 dark:text-emerald-400" />;
                    } else if (isFood) {
                      typeColor = 'border-orange-100 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-900/20';
                      typeIcon = <Utensils size={14} className="text-orange-400 dark:text-orange-300" />;
                    } else if (isTrain) {
                      typeColor = 'border-blue-100 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-900/20';
                      typeIcon = <Dumbbell size={14} className="text-blue-400 dark:text-blue-300" />;
                    }

                    return (
                      <motion.div
                        key={index}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${typeColor}`}
                      >
                        <div className={`text-xs font-bold w-12 ${isNight ? 'text-indigo-400 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                          {formatTime(item.time)}
                          {isNight && <span className="block text-[8px] uppercase">Night</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            {typeIcon}
                            <h4 className={`font-semibold text-sm transition-all flex items-center gap-2 ${isCompleted ? 'line-through opacity-40' : 'dark:text-slate-100'}`}>
                              {item.task}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{item.desc}</p>
                            {item.demoUrl && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveVideo({ url: item.demoUrl!, type: item.demoType || 'video' });
                                }}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                title="Watch Demo"
                              >
                                <PlayCircle size={14} fill="currentColor" className="text-white dark:text-slate-800" />
                              </button>
                            )}
                          </div>
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.85 }}
                          onClick={() => toggleTask(index)} 
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <AnimatePresence>
                            {isCompleted && (
                              <motion.div
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 45 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <Check size={16} strokeWidth={3} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          )}

          {showTimeShiftModal && (
            <TimeShiftModal 
              currentOffset={scheduleOffset} 
              onSave={setScheduleOffset} 
              onClose={() => setShowTimeShiftModal(false)} 
            />
          )}

          {activeVideo && (
            <VideoModal 
              url={activeVideo.url} 
              type={activeVideo.type} 
              onClose={() => setActiveVideo(null)} 
            />
          )}

          {/* AI Assistant / Amos Mode */}
          {currentView === 'chat' && (
            <motion.section 
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 h-[calc(100vh-180px)] flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold dark:text-white">Ask Amos (AI Coach)</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm space-y-3 border border-slate-100 dark:border-slate-800">
                {chatMessages.length === 0 && (
                  <div className="text-slate-400 dark:text-slate-500 italic text-center py-8">
                    Ask me anything about potty training, crate whining, or puppy behavior...
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-2 rounded-2xl max-w-[85%] ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.role === 'amos' && <span className="font-bold block text-[10px] uppercase mb-1 text-amber-600 dark:text-amber-500">Amos</span>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-2xl rounded-tl-none shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleVoiceInput}
                  className={`p-3 rounded-xl transition-colors ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                  title="Voice Input"
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  placeholder="How do I stop biting?" 
                  className="flex-1 bg-slate-100 dark:bg-slate-700 dark:text-white border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button 
                  onClick={handleAskAI}
                  disabled={isAiLoading}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </motion.section>
          )}
          {currentView === 'edit-schedule' && (
            <motion.section 
              key="edit-schedule"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                    <Edit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Edit Schedule
                  </h2>
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Back to Settings
                  </button>
                </div>
                
                <div className="space-y-3">
                  {scheduleData.map((item, index) => {
                    const isNap = item.task.toLowerCase().includes('nap');
                    const isWalk = item.task.toLowerCase().includes('walk');
                    const isPotty = item.task.toLowerCase().includes('potty') || item.task.toLowerCase().includes('out');
                    const isFood = item.task.toLowerCase().includes('breakfast') || item.task.toLowerCase().includes('dinner') || item.task.toLowerCase().includes('lunch');
                    const isTrain = item.task.toLowerCase().includes('train') || item.task.toLowerCase().includes('play');

                    let typeColor = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900';
                    let typeIcon = null;

                    if (isNap) {
                      typeColor = 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/50 dark:bg-indigo-900/30';
                      typeIcon = <Moon size={16} className="text-indigo-500 dark:text-indigo-400" />;
                    } else if (isWalk) {
                      typeColor = 'border-teal-200 bg-teal-50/50 dark:border-teal-800/50 dark:bg-teal-900/30';
                      typeIcon = <Map size={16} className="text-teal-500 dark:text-teal-400" />;
                    } else if (isPotty) {
                      typeColor = 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-900/30';
                      typeIcon = <Footprints size={16} className="text-emerald-500 dark:text-emerald-400" />;
                    } else if (isFood) {
                      typeColor = 'border-orange-200 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-900/30';
                      typeIcon = <Utensils size={16} className="text-orange-500 dark:text-orange-400" />;
                    } else if (isTrain) {
                      typeColor = 'border-blue-200 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-900/30';
                      typeIcon = <Dumbbell size={16} className="text-blue-500 dark:text-blue-400" />;
                    }

                    return (
                    <div 
                      key={item.id || index} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${typeColor} ${draggedItemIndex === index ? 'opacity-50 scale-95' : ''}`}
                    >
                      <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <GripVertical size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">
                            {formatTime(item.time)}
                          </span>
                          {typeIcon}
                          <span className="font-bold text-sm dark:text-white">{item.task}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{item.desc}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingScheduleItem(item);
                          setShowEditScheduleModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this task?')) {
                            if (selectedPuppyId && item.id) {
                              await api.deleteScheduleItem(selectedPuppyId, item.id);
                              fetchData(selectedPuppyId);
                            }
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )})}
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => {
                      setEditingScheduleItem(null);
                      setShowEditScheduleModal(true);
                    }}
                    className="flex-1 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus size={20} /> Add Task
                  </button>
                  <button 
                    onClick={() => setShowPottyModal(true)}
                    className="flex-1 p-3 border-2 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-500 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus size={20} /> Potty Breaks
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {/* Settings View */}
          {currentView === 'settings' && (
            <motion.section 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
                  <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" /> App Settings
                </h2>
                
                <div className="space-y-4">
                  {/* Family Invite Code */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Family Invite Code</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800 font-mono text-lg font-bold tracking-widest text-center text-slate-700 dark:text-slate-300">
                        {family?.invite_code || family?.inviteCode || 'LOADING'}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(family?.invite_code || family?.inviteCode);
                          alert("Code copied!");
                        }}
                        className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Copy size={20} />
                      </button>
                    </div>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-2">Share this code to let family members join your puppy's team.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Puppy's Name</label>
                      <input 
                        type="text" 
                        value={puppyName}
                        onChange={(e) => setPuppyName(e.target.value)}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Winnie"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Breed</label>
                      <input 
                        type="text" 
                        value={puppyBreed}
                        onChange={(e) => setPuppyBreed(e.target.value)}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Golden Retriever"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age (Weeks)</label>
                      <input 
                        type="number" 
                        value={puppyAge}
                        onChange={(e) => setPuppyAge(Number(e.target.value))}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Photo URL (Optional)</label>
                      <div className="flex gap-2">
                        <input 
                          type="url" 
                          value={puppies.find(p => p.id === selectedPuppyId)?.photo_url || ''}
                          onChange={(e) => {
                            const newPuppies = [...puppies];
                            const index = newPuppies.findIndex(p => p.id === selectedPuppyId);
                            if (index !== -1) {
                              newPuppies[index].photo_url = e.target.value;
                              setPuppies(newPuppies);
                            }
                          }}
                          className="flex-1 p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="https://example.com/photo.jpg"
                        />
                        <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 p-3 rounded-xl flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-600">
                          <Upload size={20} />
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        </label>
                      </div>
                    </div>
                    <button onClick={handleUpdateSettings} className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors">Save Puppy Details</button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold mb-2 dark:text-white">Manage Puppies</h3>
                    <button 
                      onClick={() => setCurrentView('edit-schedule')}
                      className="w-full p-3 mb-3 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Edit size={18} /> Edit {puppyName}'s Schedule
                    </button>
                    <button 
                      onClick={() => setShowAddPuppyModal(true)}
                      className="w-full p-3 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      + Add Another Puppy
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold mb-2 text-slate-900 dark:text-white">Preferences</h3>
                    <button 
                      onClick={() => setDarkMode(!darkMode)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all mb-3 ${
                        darkMode ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={darkMode ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'}>
                          Dark Mode
                        </span>
                      </span>
                      <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'left-5' : 'left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setUse24HourTime(!use24HourTime)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all mb-3 ${
                        use24HourTime ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Clock size={18} className={use24HourTime ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"} />
                        <span className={use24HourTime ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'}>
                          {use24HourTime ? '24-Hour Time' : '12-Hour Time'}
                        </span>
                      </span>
                      <div className={`w-10 h-6 rounded-full relative transition-colors ${use24HourTime ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${use24HourTime ? 'left-5' : 'left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={toggleNotifications}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        notificationsEnabled ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {notificationsEnabled ? <Bell size={18} className="text-blue-600 dark:text-blue-400" /> : <BellOff size={18} className="text-slate-400 dark:text-slate-500" />}
                        <span className={notificationsEnabled ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'}>
                          {notificationsEnabled ? 'Notifications Enabled' : 'Notifications Disabled'}
                        </span>
                      </span>
                      <div className={`w-10 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-5' : 'left-1'}`} />
                      </div>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                     <h3 className="font-semibold mb-2 text-slate-600 dark:text-slate-400">Account</h3>
                     <button 
                      onClick={handleLogout}
                      className="w-full p-3 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                     >
                       <LogOut size={16} /> Sign Out
                     </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
          {currentView === 'naps' && (
            <motion.section 
              key="naps"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
                  <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Enforced Naps
                </h2>
                <div className="space-y-4">
                  {naps.map(nap => (
                    <div key={nap.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                      <div>
                        <p className="font-bold dark:text-white">{nap.start_time} - {nap.end_time}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Day: {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nap.day_of_week]}</p>
                      </div>
                      <button onClick={async () => {
                        await api.deleteNap(selectedPuppyId!, nap.id);
                        setNaps(prev => prev.filter(n => n.id !== nap.id));
                      }} className="text-red-500 hover:text-red-700">
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                  <button onClick={async () => {
                    const start_time = prompt("Start Time (HH:MM)");
                    const end_time = prompt("End Time (HH:MM)");
                    const day_of_week = parseInt(prompt("Day of week (0-6, 0=Sun)") || "0");
                    if (start_time && end_time && !isNaN(day_of_week)) {
                      const res = await api.addNap(selectedPuppyId!, start_time, end_time, day_of_week);
                      setNaps(prev => [...prev, { id: res.napId, start_time, end_time, day_of_week }]);
                    }
                  }} className="w-full p-3 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium">
                    + Add New Nap
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Footer */}
      <nav className="fixed bottom-0 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-t dark:border-slate-700 px-6 py-3 flex justify-around items-center z-50 transition-colors duration-200">
        <button 
          onClick={() => setCurrentView('schedule')}
          className={`flex flex-col items-center transition-colors ${currentView === 'schedule' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
        >
          <LayoutGrid size={24} />
          <span className="text-[10px] mt-1 font-bold">Schedule</span>
        </button>
        <button 
          onClick={() => setCurrentView('chat')} 
          className={`flex flex-col items-center transition-colors ${currentView === 'chat' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
        >
          <MessageCircle size={24} />
          <span className="text-[10px] mt-1 font-bold">Chat</span>
        </button>
        <button 
          onClick={() => setCurrentView('naps')}
          className={`flex flex-col items-center transition-colors ${currentView === 'naps' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
        >
          <Moon size={24} />
          <span className="text-[10px] mt-1 font-bold">Naps</span>
        </button>
        <button 
          onClick={() => setCurrentView('settings')}
          className={`flex flex-col items-center transition-colors ${currentView === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
        >
          <Settings size={24} />
          <span className="text-[10px] mt-1 font-bold">Settings</span>
        </button>
      </nav>

      {/* Potty Breaks Modal */}
      {showPottyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPottyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">
              Generate Potty Breaks
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Automatically add recurring potty break reminders to your schedule.
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedPuppyId) return;
              
              const formData = new FormData(e.currentTarget);
              const startTime = formData.get('startTime') as string;
              const endTime = formData.get('endTime') as string;
              const intervalMinutes = Number(formData.get('intervalMinutes'));
              
              try {
                await api.generatePottyBreaks(selectedPuppyId, startTime, endTime, intervalMinutes);
                setShowPottyModal(false);
                fetchData(selectedPuppyId);
              } catch (err) {
                alert("Failed to generate potty breaks");
              }
            }}>
              <div className="space-y-4 mb-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      name="startTime"
                      defaultValue="07:00"
                      required
                      className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">End Time</label>
                    <input 
                      type="time" 
                      name="endTime"
                      defaultValue="21:00"
                      required
                      className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Frequency</label>
                  <select 
                    name="intervalMinutes"
                    defaultValue="120"
                    className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every 1 hour</option>
                    <option value="90">Every 1.5 hours</option>
                    <option value="120">Every 2 hours</option>
                    <option value="180">Every 3 hours</option>
                    <option value="240">Every 4 hours</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowPottyModal(false)} 
                  className="flex-1 py-3 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {showEditScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowEditScheduleModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">
              {editingScheduleItem ? 'Edit Task' : 'Add New Task'}
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedPuppyId) return;
              
              const formData = new FormData(e.currentTarget);
              const time = formData.get('time') as string;
              const task = formData.get('task') as string;
              const desc = formData.get('desc') as string;
              
              try {
                if (editingScheduleItem?.id) {
                  await api.updateScheduleItem(selectedPuppyId, editingScheduleItem.id, time, task, desc);
                } else {
                  await api.addScheduleItem(selectedPuppyId, time, task, desc);
                }
                setShowEditScheduleModal(false);
                fetchData(selectedPuppyId);
              } catch (err) {
                alert("Failed to save schedule item");
              }
            }}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Time</label>
                  <input 
                    type="time" 
                    name="time"
                    defaultValue={editingScheduleItem?.time || "12:00"}
                    required
                    className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Task Name</label>
                  <input 
                    type="text" 
                    name="task"
                    defaultValue={editingScheduleItem?.task || ""}
                    required
                    placeholder="e.g. Potty Break"
                    className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Description</label>
                  <textarea 
                    name="desc"
                    defaultValue={editingScheduleItem?.desc || ""}
                    required
                    placeholder="What should happen during this time?"
                    className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditScheduleModal(false)} 
                  className="flex-1 py-3 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Puppy Modal */}
      {showAddPuppyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddPuppyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">Add a New Puppy</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Name</label>
                <input 
                  type="text" 
                  value={newPuppyName}
                  onChange={(e) => setNewPuppyName(e.target.value)}
                  className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Puppy's name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Breed (Optional)</label>
                <input 
                  type="text" 
                  value={newPuppyBreed}
                  onChange={(e) => setNewPuppyBreed(e.target.value)}
                  className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Golden Retriever"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Age (Weeks)</label>
                <input 
                  type="number" 
                  value={newPuppyAge}
                  onChange={(e) => setNewPuppyAge(Number(e.target.value))}
                  className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Photo URL (Optional)</label>
                <input 
                  type="url" 
                  value={newPuppyPhoto}
                  onChange={(e) => setNewPuppyPhoto(e.target.value)}
                  className="w-full p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddPuppyModal(false)} className="flex-1 py-3 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddPuppy} className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
                Add Puppy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
