type Listener = (line: string) => void;

const buffer: string[] = [];
const listeners = new Set<Listener>();
const MAX_LINES = 500;

function timestamp() {
  return new Date().toISOString();
}

export const syncLog = {
  log(message: string, data?: unknown) {
    const line = data
      ? `${timestamp()} ${message} ${safeJson(data)}`
      : `${timestamp()} ${message}`;
    buffer.push(line);
    if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
    listeners.forEach((fn) => fn(line));
    // Also mirror to console for dev tools
    console.log(line);
  },
  clear() {
    buffer.length = 0;
    listeners.forEach((fn) => fn("__CLEAR__"));
  },
  getAll() {
    return [...buffer];
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default syncLog;
