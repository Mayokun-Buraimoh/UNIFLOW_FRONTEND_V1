import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface RubyWakePlugin {
  startListening(options: { speechKey: string; region: string }): Promise<void>;
  stopListening(): Promise<void>;
  addListener(eventName: 'wakeDetected', listener: () => void): Promise<PluginListenerHandle>;
}

export const RubyWake = registerPlugin<RubyWakePlugin>('RubyWake');
