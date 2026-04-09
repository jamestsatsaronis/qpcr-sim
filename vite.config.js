import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'your-repo-name' with your actual GitHub repository name
// e.g. if your repo is github.com/yourname/qpcr-sim, use '/qpcr-sim/'
export default defineConfig({
  plugins: [react()],
  base: '/qpcr-sim/',
})
