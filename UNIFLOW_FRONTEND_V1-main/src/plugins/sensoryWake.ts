import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface SensoryWakeStatus {
  sdkLinked: boolean;
  modelPresent: boolean;
  modelFile: string;
}

export interface SensoryWakePlugin {
  getStatus(): Promise<SensoryWakeStatus>;
  startListening(options?: { modelFile?: string }): Promise<void>;
  stopListening(): Promise<void>;
  addListener(eventName: 'wakeDetected', listener: () => void): Promise<PluginListenerHandle>;
}

export const SensoryWake = registerPlugin<SensoryWakePlugin>('SensoryWake');
