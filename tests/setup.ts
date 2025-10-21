// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
beforeAll(async () => {
  // Setup test database, Redis, etc.
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});
