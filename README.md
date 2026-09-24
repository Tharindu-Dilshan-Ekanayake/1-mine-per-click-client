# 1 Mine Per Click — game client

React + three.js (react-three-fiber) client for the Colyseus server in
`../-1-mine-per-click-server`.

```bash
npm install
npm run dev      # http://localhost:5173, joins the server on port 2567
```

Copy `.env.example` to `.env.local` for the Bloxity SDK settings.

## Graphics quality

There is no settings menu: `src/game/quality.js` picks a starting tier from the
GPU, CPU cores and memory, and a frame-rate monitor in the scene steps it down
(lower resolution, no shadows, no sparkles) when the game stutters and back up
when there's headroom.

## Deploying to Bloxity hosting

`.github/workflows/deploy.yml` builds the site and uploads it: `dev` branch →
`https://<gameId>.dev.play.bloxity.io` (talks straight to the dev server),
`main` → `https://<gameId>.play.bloxity.io` (joins through the Legion
matchmaker, which fills a server pod and then starts the next).

One-time setup (repo → Settings → Secrets and variables → Actions):

| Kind     | Name                   | Value                                          |
| -------- | ---------------------- | ---------------------------------------------- |
| Secret   | `LEGION_DEPLOY_TOKEN`  | deploy token from My Games (same as server's)  |
| Variable | `BLOXITY_GAME_ID`      | your lowercase game id, e.g. `mine-per-click`  |
| Variable | `GAME_SLUG` (optional) | Bloxity SDK slug, if different from the game id |
