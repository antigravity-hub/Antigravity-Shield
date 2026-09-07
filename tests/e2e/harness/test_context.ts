import { MockUpstreamServer } from './mock_upstream';

export interface TestAccount {
  id: string;
  email: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiresAt: number;
  isForbidden: boolean;
  quarantineUntil?: number;
  rateLimitedUntil?: number;
  deviceProfile: {
    machineId: string;
    macMachineId: string;
    devDeviceId: string;
    sqmId: string;
    sessionId: string;
  };
}

export function createMockAccount(id: string, email: string): TestAccount {
  return {
    id,
    email,
    refreshToken: 'mock-refresh-token-' + id,
    accessToken: 'mock-access-token-' + id,
    tokenExpiresAt: Date.now() + 3600_000,
    isForbidden: false,
    deviceProfile: {
      machineId: 'mach-' + id + '-c4ca4238a0b923820dcc509a6f75849b',
      macMachineId: 'mac-' + id + '-c81e728d9d4c2f636f067f89cc14862c',
      devDeviceId: 'id-' + id + '-4a7d-b65f-1f0e2d3c4b5a',
      sqmId: '{' + id.toUpperCase() + '-0000-0000-0000-000000000000}',
      sessionId: 'sess-' + id + '-eccbc87e4b5ce2fe28308fd9f2a7baf3',
    },
  };
}

export interface SimulationEnvironment {
  mockServer: MockUpstreamServer;
  accounts: TestAccount[];
  cleanup: () => Promise<void>;
}

export async function setupTestEnv(): Promise<SimulationEnvironment> {
  const mockServer = new MockUpstreamServer();
  await mockServer.start();

  const accounts = [
    createMockAccount('acc-1', 'developer-primary@example.com'),
    createMockAccount('acc-2', 'developer-secondary@example.com'),
    createMockAccount('acc-3', 'developer-fallback@example.com'),
  ];

  return {
    mockServer,
    accounts,
    cleanup: async () => {
      await mockServer.stop();
    },
  };
}
