# Virtual qPCR Flow Simulation

An interactive educational simulation that guides students through the process of optimising a qPCR experiment, from primer selection through to interpreting results.

## Quick Start (local development)

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Deploy to GitHub Pages

### One-time setup

1. **Create a new GitHub repository** (e.g. `qpcr-sim`)

2. **Edit `vite.config.js`** — change `your-repo-name` to your actual repo name:
   ```js
   base: '/qpcr-sim/',
   ```

3. **Push the code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/qpcr-sim.git
   git push -u origin main
   ```

4. **Enable GitHub Pages:**
   - Go to your repo → **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - That's it — the included workflow will build and deploy automatically

5. Your site will be live at: `https://YOUR-USERNAME.github.io/qpcr-sim/`

### Updating

Any push to `main` automatically rebuilds and redeploys. Just edit, commit, and push.

## Embedding in another page

```html
<iframe
  src="https://YOUR-USERNAME.github.io/qpcr-sim/"
  width="100%"
  height="900"
  style="border: none; border-radius: 12px;"
></iframe>
```
