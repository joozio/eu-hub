import { DemoMode } from './demo-mode';

const VALID_DEMO_MODES = new Set<DemoMode>(['off', 'hybrid', 'snapshot']);

export interface AppEnv {
  nodeEnv: string;
  mistralApiKey: string;
  publicDemoMode: DemoMode;
}

function normalizeDemoMode(raw: string | undefined): DemoMode {
  const normalized = (raw || 'off').trim().toLowerCase() as DemoMode;
  if (!VALID_DEMO_MODES.has(normalized)) {
    throw new Error(`Invalid NEXT_PUBLIC_DEMO_MODE value: ${raw}`);
  }
  return normalized;
}

export function loadEnv(): AppEnv {
  const publicDemoMode = normalizeDemoMode(process.env.NEXT_PUBLIC_DEMO_MODE);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    mistralApiKey: (process.env.MISTRAL_API_KEY || '').trim(),
    publicDemoMode,
  };
}

export function assertEnv(): AppEnv {
  const env = loadEnv();

  if (!['development', 'test', 'production'].includes(env.nodeEnv)) {
    throw new Error(`Unsupported NODE_ENV value: ${env.nodeEnv}`);
  }

  if (env.mistralApiKey && env.mistralApiKey.length < 16) {
    throw new Error('MISTRAL_API_KEY looks malformed (too short).');
  }

  return env;
}
