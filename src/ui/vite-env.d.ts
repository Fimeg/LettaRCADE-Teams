/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data: unknown) => void;
      on: (channel: string, callback: (data: unknown) => void) => () => void;
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
    };
  }
}

export {};
