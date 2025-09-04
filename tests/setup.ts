// Test setup file for vitest
import { beforeEach, vi } from 'vitest';

// Mock process.exit to prevent actual process termination during tests
vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

beforeEach(() => {
  // Clear environment variables
  delete process.env.OPENAPI_SPECS_FOLDER;
});