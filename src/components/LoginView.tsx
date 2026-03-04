import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dog, ArrowRight, Users, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface LoginViewProps {
  onLogin: (user: any, family: any) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'join'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [puppyName, setPuppyName] = useState('');
  const [puppyAge, setPuppyAge] = useState(8);
  const [puppyBreed, setPuppyBreed] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (mode === 'login') {
        res = await api.login(email, password);
      } else if (mode === 'register') {
        res = await api.register(email, password, puppyName, puppyAge, puppyBreed);
      } else {
        res = await api.join(email, password, inviteCode);
      }

      if (res.error) {
        setError(res.error);
      } else {
        onLogin(res.user, res.family);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transition-colors duration-200"
      >
        <div className="bg-blue-600 dark:bg-blue-700 p-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Dog size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Pup Coach</h1>
          <p className="text-blue-100 text-sm">Smart Training & Schedule Tracker</p>
        </div>

        <div className="p-8">
          <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            {(['login', 'register', 'join'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  mode === m ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {m === 'join' ? 'Join Family' : m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="you@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Puppy's Name</label>
                      <input
                        type="text"
                        required
                        value={puppyName}
                        onChange={(e) => setPuppyName(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Winnie"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Breed (Optional)</label>
                      <input
                        type="text"
                        value={puppyBreed}
                        onChange={(e) => setPuppyBreed(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Golden Retriever"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Puppy's Age (Weeks)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="52"
                        value={puppyAge}
                        onChange={(e) => setPuppyAge(parseInt(e.target.value))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                {mode === 'join' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Family Invite Code</label>
                    <input
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono tracking-widest"
                      placeholder="ABC123"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ask your family member for the code in Settings.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white font-bold py-4 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Join Family'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
