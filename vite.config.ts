/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// GitHub Pages serves the site at https://sehunyang.github.io/thermo-sim/
export default defineConfig({
  base: '/thermo-sim/',
  plugins: [svelte()],
  test: {
    include: ['tests/physics/**/*.test.ts'],
  },
})
