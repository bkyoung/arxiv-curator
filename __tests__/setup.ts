/**
 * Test Setup
 *
 * Global test configuration and setup
 */

import '@testing-library/jest-dom';

// Mock ResizeObserver for Radix UI components (Slider, etc.)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
