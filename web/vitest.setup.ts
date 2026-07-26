import "@testing-library/jest-dom/vitest";

// Node 25 ships an experimental global localStorage without a full API and
// shadows jsdom's. Replace it with a simple in-memory Storage for tests.
class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemStorage(),
  configurable: true,
  writable: true,
});

// jsdom lacks matchMedia (MUI reads it). Provide a no-op.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith("/api/me")) {
    return new Response(JSON.stringify({ data: { id: "1", username: "sriman" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ data: {} }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
