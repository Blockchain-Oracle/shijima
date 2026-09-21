import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'db',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/testing/global-setup.ts'],
    // Every file shares one test database, so files run one after another. Tests isolate themselves by
    // creating their own owner and desk, never by truncating.
    fileParallelism: false,
  },
})
