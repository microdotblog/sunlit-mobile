const listeners = new Set();

export function notify_session_expired() {
  listeners.forEach(listener => listener());
}

export function on_session_expired(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
