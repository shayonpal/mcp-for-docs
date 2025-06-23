import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

// Setup temporary directory for tests
export const TEST_TEMP_DIR = path.join(process.cwd(), 'tests', 'temp');

// Override environment variables for tests
process.env.DOCS_BASE_PATH = path.join(TEST_TEMP_DIR, 'docs');

// Clean up and create temp directory before tests
beforeAll(async () => {
  try {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, ignore error
  }
  await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
});

// Clean up temp directory after tests
afterAll(async () => {
  try {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Mock console.error to reduce noise in tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});