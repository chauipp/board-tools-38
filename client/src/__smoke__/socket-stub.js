globalThis.__emitted = [];
const handlers = new Map();
const fakeSocket = {
  id: "self-socket",
  on: (ev, fn) => { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(fn); },
  off: (ev, fn) => { const l = handlers.get(ev) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
  emit: (ev, payload) => { globalThis.__emitted.push([ev, payload]); },
  disconnect: () => {}
};
globalThis.__deliver = (ev, payload) => (handlers.get(ev) || []).slice().forEach((fn) => fn(payload));
export function io() { return fakeSocket; }
