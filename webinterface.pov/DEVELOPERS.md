# DEVELOPERS.md — POV Web Interface

## Architecture

This is a **zero-dependency** vanilla-JS SPA served as a Kodi web interface addon. It communicates with Kodi via JSON-RPC over the same origin (`/jsonrpc`).

### File Layout

```
webinterface.pov/
├── addon.xml      # Kodi extension declaration (point: xbmc.webinterface)
├── index.html     # SPA shell — sidebar, content area, modal markup
├── app.js         # All logic: JSON-RPC client, grid renderer, modal, TMDB enrichment
└── style.css      # Dark theme, responsive grid, modal overlay, cast/similar sections
```

### JSON-RPC Methods Used

| Method | Purpose |
|--------|---------|
| `Files.GetDirectory` | Browse POV directories (with `properties: ['title','plot','thumbnail','art','year','season','episode','showtitle']`) |
| `Player.Open` | Play a file on the Shield |
| `GUI.ActivateWindow` | Open an item in the Kodi UI (window `videos`) |

### TMDB Integration

- **API key:** Hardcoded in `app.js` (value stored in source, not in `config.sh`)
- **Endpoints:**
  - `GET /3/movie/{id}?append_to_response=credits,videos`
  - `GET /3/tv/{id}?append_to_response=credits,videos`
  - `GET /3/movie/{id}/similar` or `/3/tv/{id}/similar`
- **Images:** `https://image.tmdb.org/t/p/{size}{path}`

### Kodi Image Serving

POV stores posters in `art.poster` (not `thumbnail`). The app falls back through `thumbnail → art.poster → art.icon → art.fanart`.

Kodi's image endpoint requires double-encoding for `image://` URLs:
```javascript
function thumbUrl(url) {
    if (url.startsWith('image://')) {
        return '/image/' + encodeURIComponent(url);
    }
    return url;
}
```

### TV Show URL Rewrite

Trending TV items return `mode=build_episode_list&tmdb_id=...&season=all`. The app rewrites this to `mode=build_season_list` (stripping `season=all`) so users navigate Seasons → Episodes.

```javascript
if (seasonPath.includes('mode=build_episode_list') && seasonPath.includes('season=all')) {
    seasonPath = seasonPath.replace('mode=build_episode_list', 'mode=build_season_list')
                           .replace(/&season=all/, '');
}
```

### Modal Structure

The modal has three regions:
1. **Header** — Poster + info (title, meta, plot, actions)
2. **Cast section** — Horizontal scrolling row of up to 8 cast members
3. **Similar section** — Lazy-loaded grid of similar items from TMDB

Clicking a similar item closes the modal and runs a POV search for that title.

## Known Limitations

### POV Extras Dialog (Removed)

POV's native Extras dialog (`windows/extras.py`) extends `BaseDialog` → `WindowXMLDialog`. When opened via `Addons.ExecuteAddon` from JSON-RPC, the dialog does **not** receive input focus on the Shield. The remote sends input to the underlying window (10025) instead.

**Log evidence:**
```
Activate of window '10025' refused because there are active modal dialogs
```

The Extras button was removed and replaced with built-in Cast, Similar, and Trailer sections.

### YouTube Trailer Playback

The `plugin.video.youtube` add-on fails to resolve streams on this build (`error probing input format`). Trailers are offered as external YouTube links instead.

### `Files.GetDirectory` Properties

Only valid `Item.Fields.Base` enum values are accepted. Invalid properties return `-32602 Invalid params`.

## Deployment

```bash
# Push to Shield
adb push webinterface.pov/ /sdcard/Android/data/org.xbmc.kodi/files/.kodi/addons/webinterface.pov/

# Activate via JSON-RPC (or Kodi GUI)
curl -u <user>:<pass> http://<shield-ip>:8080/jsonrpc \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"Settings.SetSettingValue","params":{"setting":"services.webskin","value":"webinterface.pov"},"id":1}'
```
