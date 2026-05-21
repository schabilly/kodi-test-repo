# POV Web Interface

A lightweight web interface for browsing and controlling POV (a Kodi video add-on) from any browser. Runs as a Kodi web interface addon at `http://<shield-ip>:8080/`.

## Features

- **Sidebar navigation** — Next Episodes, Trending Movies/TV, Watchlists, Real-Debrid Cloud
- **Search** — Search movies by title
- **Grid view** — Poster thumbnails with title, year, and type badges
- **Details modal** — Rich info pulled from TMDB:
  - Poster, backdrop, plot, rating, runtime, genres
  - **Cast** — Photos, actor names, and character roles
  - **Similar** — Related movies/shows from TMDB; click to search in POV
  - **Trailer** — Direct YouTube link (opens in browser)
- **Actions** — Play on Shield, Open in Kodi, browse seasons/episodes

## Setup

1. Ensure POV is installed and configured on the Shield
2. Push this addon to Kodi:
   ```bash
   adb push webinterface.pov/ /sdcard/Android/data/org.xbmc.kodi/files/.kodi/addons/webinterface.pov/
   ```
3. In Kodi, go to **Settings → Services → Control → Web interface** and select **POV Web**
4. Open `http://<shield-ip>:8080/` in any browser on the same network

## Daily Use

- Click any poster to open the details modal
- Click **Play** to start playback on the Shield
- Click **View Seasons** (TV shows) to browse seasons, then episodes
- Click **Show Similar** to discover related titles
- Click **Open in Kodi** to jump to that item in the Kodi UI

## Notes

- Thumbnails are served through Kodi's `/image/<encoded>` endpoint
- The YouTube Kodi add-on is currently broken upstream; trailers open in the browser instead
- POV's native Extras dialog cannot be opened reliably via JSON-RPC (focus issues), so extras are built into the web UI directly
