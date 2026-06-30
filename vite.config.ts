import { defineConfig, configDefaults } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.{ts,tsx}',
        'convex/**/*.{ts,tsx}',
        'shared/**/*.{ts,tsx}',
        'scripts/generate-catalog.ts',
        'scripts/import-catalog.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/routeTree.gen.ts',
        'convex/_generated/**',
        '**/*.d.ts',
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})

export default config
