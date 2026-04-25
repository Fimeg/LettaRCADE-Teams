import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

export interface Config {
  serverUrl: string;
  apiKey?: string;
  permissionMode: 'strict' | 'bypass';
  windowWidth: number;
  windowHeight: number;
  theme: 'light' | 'dark';
  pollingInterval: number;
  externalMemfsEnabled?: boolean;
}

export const defaultConfig: Config = {
  serverUrl: 'http://10.10.20.19:8283',
  permissionMode: 'bypass',
  windowWidth: 1400,
  windowHeight: 900,
  theme: 'dark',
  pollingInterval: 5000
};

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(fileContent);
      return { ...defaultConfig, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return defaultConfig;
}

export function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}
