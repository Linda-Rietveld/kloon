import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGitHubPagesBuild = (globalThis as { process?: { env?: { GITHUB_ACTIONS?: string } } }).process?.env?.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isGitHubPagesBuild ? '/kloon/' : '/',
  plugins: [react()],
})
