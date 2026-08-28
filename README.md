# Task Manager QA

A static task board app — no build step, no backend.

## Files
- `index.html` — markup
- `style.css` — all styles
- `script.js` — all app logic (board state, timers, canvas drawing tool)
- `vercel.json` — static deploy config

## Data storage
The app saves board state to the browser's `localStorage` under the key
`board-state`, so data is per-browser/per-device (nothing is synced to a
server or database).

## Run locally
Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option B — Git + Vercel dashboard
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
Then import the repo at https://vercel.com/new — no build command or
output directory needed, it's served as-is (static site).
