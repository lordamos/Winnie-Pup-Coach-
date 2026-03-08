// Prevent "Cannot set property fetch of #<Window> which has only a getter"
if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'fetch', {
      value: window.fetch,
      writable: true,
      configurable: true
    });
  } catch (e) {
    console.warn("Could not redefine window.fetch", e);
  }
}
