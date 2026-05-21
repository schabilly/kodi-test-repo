# AGENTS.md — POV Web Interface

> **Start here for this component.** This file gives you the full picture.  
> For **user setup and daily use**, see [`README.md`](README.md).  
> For **technical architecture, JSON-RPC details, and deployment**, see [`DEVELOPERS.md`](DEVELOPERS.md).  
> For **project-wide rules and constraints**, see [`../../kodi-manager/AGENTS.md`](../../kodi-manager/AGENTS.md).

## What This Is

A zero-dependency vanilla-JS SPA served as a Kodi web interface addon. It lets the user browse POV (a Fen-fork video add-on) from any browser on the same network, with rich TMDB-enriched details.

## Tech Stack

- **Vanilla JS** — no frameworks, no build step
- **Vanilla CSS** — CSS custom properties for theming
- **Kodi JSON-RPC** — all data comes from `Files.GetDirectory`, `Player.Open`, `GUI.ActivateWindow`
- **TMDB REST API** — enrichment data (cast, similar, trailers)

## File Map

| File | Purpose | Details |
|------|---------|---------|
| `addon.xml` | Kodi extension declaration (`xbmc.webinterface`) | [`DEVELOPERS.md`](DEVELOPERS.md) |
| `index.html` | SPA shell — sidebar, grid, modal markup | [`DEVELOPERS.md`](DEVELOPERS.md) |
| `app.js` | All logic: JSON-RPC client, grid renderer, modal, TMDB enrichment | [`DEVELOPERS.md`](DEVELOPERS.md) |
| `style.css` | Dark theme, responsive grid, modal overlay, cast/similar sections | [`DEVELOPERS.md`](DEVELOPERS.md) |

## Design Principles

1. **Zero dependencies** — Do not add npm packages, bundlers, or CDNs.
2. **Same-origin JSON-RPC** — All Kodi calls go to `/jsonrpc` (no CORS; served by Kodi itself).
3. **Graceful degradation** — If TMDB fails, the modal still shows POV's native data. If images fail, show text initials.
4. **Mobile-first responsive** — Sidebar collapses on narrow screens; modal stacks vertically.

## Critical Constraints

### POV Extras Dialog is Banned

POV's native `Extras` dialog (`mode=extras_menu_choice`) cannot be opened reliably via `Addons.ExecuteAddon`. It suffers from focus-trapping on the Shield — the remote sends input to the underlying window instead of the dialog.

**Log evidence:**
```
Activate of window '10025' refused because there are active modal dialogs
```

**Rule:** Any "extras" functionality must be built into the web UI modal (Cast, Similar, Trailer links). Do not reintroduce a POV Extras button.

### YouTube Playback is Broken

The `plugin.video.youtube` add-on fails to resolve streams (`error probing input format`). Trailers must be external YouTube links that open in the browser.

### Kodi Image Serving

POV stores posters in `art.poster` (not `thumbnail`). The app falls back through `thumbnail → art.poster → art.icon → art.fanart`.

Kodi's `/image/` endpoint requires `encodeURIComponent()` for `image://` URLs. See [`DEVELOPERS.md`](DEVELOPERS.md) for the implementation.

### TV Show URL Rewrite

Trending TV items return `mode=build_episode_list&tmdb_id=...&season=all`. The app rewrites this to `mode=build_season_list` (stripping `season=all`) so users navigate Seasons → Episodes. See [`DEVELOPERS.md`](DEVELOPERS.md) for the code.

## When Modifying This Code

- Verify JSON-RPC methods exist on Kodi 21 Omega (JSON-RPC v13.5)
- `Files.GetDirectory` only accepts valid `Item.Fields.Base` properties (invalid = `-32602 Invalid params`)
- Reuse the hardcoded `TMDB_KEY` constant; append to `append_to_response` to reduce API calls
- The TMDB key is hardcoded in `app.js` because POV itself hardcodes the same key. There is no separate POV setting for the TMDB API key — it is embedded in POV's source and session token. Changing it would require forking POV.
- Always provide `onerror` fallbacks for images
- Test by pushing to Shield and hard-refreshing the browser (no Kodi restart needed for JS/CSS)

## Deployment

```bash
adb push webinterface.pov/ /sdcard/Android/data/org.xbmc.kodi/files/.kodi/addons/webinterface.pov/
```

Activation: Kodi Settings → Services → Control → Web interface → "POV Web"

## Code Conventions

- Keep it as simple as possible. Introduce complexity only when needed.
- Stay consistent when introducing design patterns. Change them everywhere.
- Avoid comments for obvious code; clear naming should speak for itself.
- Avoid hardcoded paths and strings. Derive identifiers from source data.
- Add tests for new features. Test with at least two different inputs.
- Validate success conditions, not failure conditions.
- Never silently swallow errors on commands whose output you inspect (`curl`, `grep`, etc.).
- When fixing a bug, grep the entire codebase for the same pattern before declaring it fixed.
- Prefer explicit argument parsing over positional heuristic checks.
- **Always keep documentation up to date.** When you change a script's interface or behavior, update `README.md`, `DEVELOPERS.md`, and examples immediately.

## Behavior

- Ask the user when questions arise multiple times; present options before implementing.
- Challenge the existence of features or functions for the sake of simplicity.

## Pending: Browser Playback with Audio (Transcoding)

**Status:** Explored, blocked, waiting for physical access to Shield.

**Problem:** Debrid streams often carry DTS audio, which browsers cannot decode. "Play in Browser" works for video but has no audio.

**Attempted approaches:**
1. **Kodi Python service addon + static FFmpeg binary** — The addon (`service.pov.transcode`) and static `ffmpeg` ARM64 binary were built and installed. The addon starts an HTTP server on port 8082 and spawns FFmpeg for audio-only transcode (DTS→AAC, video copy) to HLS. **Blocked:** Android 10+ prevents the Kodi process (`u0_a113`) from executing binaries in `/data/local/tmp/`, even with world-execute permissions. SELinux/permission model hard limit.
2. **Host-side transcoding** — Feasible but rejected by user; transcoding must run on the Shield.
3. **ADB-orchestrated transcoding** — Feasible (run FFmpeg via `adb shell` as `shell` user, serve HLS with a static binary like `darkhttpd`), but requires macOS host to act as orchestrator. User preferred to wait.

**Next steps (when physically in front of Shield):**
1. Open Termux app on Shield
2. Run: `pkg install -y ffmpeg python`
3. Push `transcode-server.py` to Termux home
4. Start server: `python3 ~/transcode-server.py`
5. Update web interface to POST stream URLs to `http://<shield-ip>:8082/start` and play the returned HLS playlist via `hls.js`

**Relevant removed files (can be restored from git history):**
- `transcode-server.py` — Python HTTP server for Termux
- `service.pov.transcode/` — Kodi Python service addon (addon.xml + service.py)
- `install-transcode-server.sh` / `install-transcode-addon.sh`
- `ffmpeg-android` — downloaded static FFmpeg binary for Android ARM64
