import React, { useState, useEffect, useRef } from 'react';
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
  Clock
} from 'lucide-react';
import { askAmos } from './services/geminiService';
import { NotificationService } from './services/notificationService';

interface ScheduleItem {
  time: string;
  task: string;
  desc: string;
  demoUrl?: string;
  demoType?: 'video' | 'gif';
}

const scheduleData: ScheduleItem[] = [
  { 
    time: "07:00", 
    task: "Immediate Out", 
    desc: "Carry to grass immediately. No walking!",
    demoUrl: "https://media.giphy.com/media/3o7abAHdYvZdBNkDAS/giphy.gif",
    demoType: 'gif'
  },
  { time: "07:15", task: "Breakfast", desc: "Feed inside the crate for positive vibes." },
  { time: "07:35", task: "Potty Break #2", desc: "The post-breakfast ritual." },
  { 
    time: "07:45", 
    task: "Training/Play", 
    desc: "15-30 mins of high engagement.",
    demoUrl: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
    demoType: 'gif'
  },
  { 
    time: "08:15", 
    task: "Enforced Nap", 
    desc: "Crate time with a stuffed Kong.",
    demoUrl: "https://media.giphy.com/media/26BRL7YrutHKsHtJK/giphy.gif",
    demoType: 'gif'
  },
  { time: "10:00", task: "Potty + Stretch", desc: "Quick relief and 10 min break." },
  { time: "10:15", task: "Enforced Nap", desc: "Back to the den." },
  { time: "12:00", task: "Potty + Lunch + Play", desc: "Mid-day interaction window." },
  { time: "13:00", task: "Enforced Nap", desc: "Solid afternoon sleep." },
  { time: "15:30", task: "Potty + Stretch", desc: "Quick break." },
  { time: "15:45", task: "Enforced Nap", desc: "Final afternoon nap." },
  { time: "18:00", task: "Potty + Dinner + Play", desc: "Longest freedom window." },
  { time: "20:30", task: "Potty + Nap", desc: "Evening wind-down." },
  { time: "22:30", task: "Water Pick-up", desc: "Pull water. Quick potty trip." },
  { time: "00:00", task: "Midnight Chill", desc: "Low energy interaction." },
  { time: "01:30", task: "Final Business Potty", desc: "Last trip then bed for everyone!" }
];

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
};

const VideoModal = ({ url, type, onClose }: { url: string, type: 'video' | 'gif', onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-lg">Training Demo</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
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
      <div className="p-4 bg-slate-50 text-sm text-slate-500 text-center">
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
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2">Shift Schedule</h3>
        <p className="text-sm text-slate-500 mb-4">Running late? Adjust the start time and the whole day will shift.</p>
        
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Day Start Time</label>
          <input 
            type="time" 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full text-2xl font-bold p-2 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
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
  const [completedTasks, setCompletedTasks] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('pupTasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
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
  const [puppyName, setPuppyName] = useState(() => {
    try {
      return localStorage.getItem('pupName') || "Winnie";
    } catch (e) {
      return "Winnie";
    }
  });
  const [showTimeShiftModal, setShowTimeShiftModal] = useState(false);
  const [currentView, setCurrentView] = useState<'schedule' | 'chat' | 'settings'>('schedule');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Memoize the adjusted schedule
  const currentSchedule = React.useMemo(() => {
    if (scheduleOffset === 0) return scheduleData;
    return scheduleData.map(item => ({
      ...item,
      time: addMinutes(item.time, scheduleOffset)
    }));
  }, [scheduleOffset]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAndNotify(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [notificationsEnabled, lastNotifiedTask, scheduleOffset]); // Added scheduleOffset dependency

  useEffect(() => {
    try {
      localStorage.setItem('pupScheduleOffset', String(scheduleOffset));
    } catch (e) {}
  }, [scheduleOffset]);

  useEffect(() => {
    try {
      localStorage.setItem('pupName', puppyName);
    } catch (e) {}
  }, [puppyName]);

  useEffect(() => {
    try {
      localStorage.setItem('pupTasks', JSON.stringify(completedTasks));
    } catch (e) {}
  }, [completedTasks]);

  useEffect(() => {
    try {
      localStorage.setItem('pupNotifications', String(notificationsEnabled));
    } catch (e) {}
  }, [notificationsEnabled]);

  useEffect(() => {
    if (currentView === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, currentView]);

  const checkAndNotify = (now: Date) => {
    if (!notificationsEnabled) return;

    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    // Use currentSchedule instead of scheduleData
    const currentTask = currentSchedule.find(item => item.time === timeStr);

    if (currentTask && lastNotifiedTask !== currentTask.time) {
      const isNight = NotificationService.isNightTime(currentTask.time);
      const title = isNight ? `🌙 Night Potty: ${currentTask.task}` : `🐾 Potty Time: ${currentTask.task}`;
      NotificationService.sendNotification(title, currentTask.desc);
      setLastNotifiedTask(currentTask.time);
    }
  };

  const toggleTask = (index: number) => {
    setCompletedTasks(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const resetDay = () => {
    if (confirm("Reset all checkmarks for today?")) {
      setCompletedTasks([]);
    }
  };

  const handleAskAI = async () => {
    if (!userInput.trim() || isAiLoading) return;

    const query = userInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: query }]);
    setUserInput('');
    setIsAiLoading(true);

    try {
      const reply = await askAmos(query, puppyName);
      setChatMessages(prev => [...prev, { role: 'amos', text: reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'amos', text: "Connection error. Try again." }]);
    } finally {
      setIsAiLoading(false);
    }
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

  const currentTimeStr = currentTime.getHours().toString().padStart(2, '0') + ":" + currentTime.getMinutes().toString().padStart(2, '0');
  // Use currentSchedule instead of scheduleData
  const nextTask = currentSchedule.find((item, index) => !completedTasks.includes(index) && item.time >= currentTimeStr) || null;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen pb-24 font-sans">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 px-4 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Dog size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{puppyName}'s <span className="text-blue-600">Pup Coach</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleNotifications}
            className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-100'}`}
          >
            {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
          <div className="text-sm font-semibold text-slate-500 tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {currentView === 'schedule' && (
          <>
            {/* Status Card */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg transition-all">
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Up Next</p>
              <h2 className="text-2xl font-bold mb-2">{nextTask ? nextTask.task : "Sleep Time"}</h2>
              <p className="text-blue-50/80 text-sm">{nextTask ? nextTask.desc : "Pup should be dreaming. Rest up!"}</p>
            </div>

            {/* Schedule Section */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-600" /> Today's Schedule
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowTimeShiftModal(true)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" /> Adjust Time
                  </button>
                  <button onClick={resetDay} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-1">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {currentSchedule.map((item, index) => {
                  const isCompleted = completedTasks.includes(index);
                  const isActive = nextTask?.time === item.time;
                  const isNight = NotificationService.isNightTime(item.time);

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isActive ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-white border-slate-100'
                      }`}
                    >
                      <div className={`text-xs font-bold w-12 ${isNight ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {item.time}
                        {isNight && <span className="block text-[8px] uppercase">Night</span>}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-semibold text-sm transition-all flex items-center gap-2 ${isCompleted ? 'line-through opacity-40' : ''}`}>
                          {item.task}
                          {item.demoUrl && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveVideo({ url: item.demoUrl!, type: item.demoType || 'video' });
                              }}
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                              title="Watch Demo"
                            >
                              <PlayCircle size={16} fill="currentColor" className="text-white" />
                            </button>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                      </div>
                      <button 
                        onClick={() => toggleTask(index)} 
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          isCompleted ? 'bg-green-500 border-green-500 text-white scale-110' : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {isCompleted && <Check size={16} strokeWidth={3} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
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
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 h-[calc(100vh-180px)] flex flex-col">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold">Ask Amos (AI Coach)</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 p-3 bg-slate-50 rounded-xl text-sm space-y-3 border border-slate-100">
              {chatMessages.length === 0 && (
                <div className="text-slate-400 italic text-center py-8">
                  Ask me anything about potty training, crate whining, or puppy behavior...
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-3 py-2 rounded-2xl max-w-[85%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.role === 'amos' && <span className="font-bold block text-[10px] uppercase mb-1 text-amber-600">Amos</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 shrink-0">
              <input 
                type="text" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                placeholder="How do I stop biting?" 
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button 
                onClick={handleAskAI}
                disabled={isAiLoading}
                className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </section>
        )}
        {/* Settings View */}
        {currentView === 'settings' && (
          <section className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" /> App Settings
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Puppy's Name</label>
                  <input 
                    type="text" 
                    value={puppyName}
                    onChange={(e) => setPuppyName(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Winnie"
                  />
                  <p className="text-xs text-slate-500 mt-1">This name will be used by Amos and in notifications.</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-semibold mb-2">Notifications</h3>
                  <button 
                    onClick={toggleNotifications}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      notificationsEnabled ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {notificationsEnabled ? <Bell size={18} className="text-blue-600" /> : <BellOff size={18} className="text-slate-400" />}
                      <span className={notificationsEnabled ? 'text-blue-700 font-medium' : 'text-slate-600'}>
                        {notificationsEnabled ? 'Notifications Enabled' : 'Notifications Disabled'}
                      </span>
                    </span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-5' : 'left-1'}`} />
                    </div>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                   <h3 className="font-semibold mb-2 text-red-600">Danger Zone</h3>
                   <button 
                    onClick={() => {
                      if(confirm("Are you sure you want to reset all app data? This cannot be undone.")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full p-3 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium"
                   >
                     Reset All App Data
                   </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Navigation Footer */}
      <nav className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t px-6 py-3 flex justify-around items-center z-50">
        <button 
          onClick={() => setCurrentView('schedule')}
          className={`flex flex-col items-center transition-colors ${currentView === 'schedule' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
        >
          <LayoutGrid size={24} />
          <span className="text-[10px] mt-1 font-bold">Schedule</span>
        </button>
        <button 
          onClick={() => setCurrentView('chat')} 
          className={`flex flex-col items-center transition-colors ${currentView === 'chat' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
        >
          <MessageCircle size={24} />
          <span className="text-[10px] mt-1 font-bold">Chat</span>
        </button>
        <button 
          onClick={() => setCurrentView('settings')}
          className={`flex flex-col items-center transition-colors ${currentView === 'settings' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
        >
          <Settings size={24} />
          <span className="text-[10px] mt-1 font-bold">Settings</span>
        </button>
      </nav>
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
