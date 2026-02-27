import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export async function runTUI(projectRoot?: string): Promise<void> {
  const { waitUntilExit } = render(<App projectRoot={projectRoot} />);
  await waitUntilExit();
}

export { App } from './App.js';
export * from './components/AgentList.js';
export * from './components/Preview.js';
export * from './components/StatusBar.js';
export * from './components/HelpModal.js';
export * from './hooks/useAgents.js';
export * from './hooks/useOutput.js';
export * from './hooks/useKeyboard.js';
