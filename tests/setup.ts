// Test setup file for vitest
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Clear environment variables
  delete process.env.OPENAPI_SPECS_FOLDER;
});