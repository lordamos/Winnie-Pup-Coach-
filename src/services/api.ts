export const api = {
  async register(email: string, password: string, puppyName: string, puppyAge: number, breed?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, puppyName, puppyAge, breed }),
    });
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async join(email: string, password: string, inviteCode: string) {
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, inviteCode }),
    });
    return res.json();
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  async checkAuth() {
    const res = await fetch('/api/auth/me');
    if (res.status === 401) return null;
    return res.json();
  },

  async getData(puppyId?: number) {
    const url = puppyId ? `/api/data?puppyId=${puppyId}` : '/api/data';
    const res = await fetch(url);
    return res.json();
  },

  async toggleTask(puppyId: number, taskIndex: number, completed: boolean) {
    await fetch('/api/data/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puppyId, taskIndex, completed }),
    });
  },

  async updateSettings(puppyName: string, puppyAge: number) {
    await fetch('/api/data/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puppyName, puppyAge }),
    });
  },

  async addPuppy(name: string, age_weeks: number, breed?: string, photo_url?: string) {
    const res = await fetch('/api/puppies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age_weeks, breed, photo_url }),
    });
    return res.json();
  },

  async updatePuppy(id: number, name: string, age_weeks: number, breed?: string, photo_url?: string) {
    const res = await fetch(`/api/puppies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age_weeks, breed, photo_url }),
    });
    return res.json();
  }
};
