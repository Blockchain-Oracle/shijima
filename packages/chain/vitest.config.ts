import { defineProject } from 'vitest/config'

export default defineProject({ test: { name: 'chain', include: ['src/**/*.test.ts'] } })
