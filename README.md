# kodi-addons

Personal Kodi addon repository.

## Contents

- `webinterface.pov/` — POV Web Interface addon
- `plugin.video.testdummy/` — Test dummy addon (integration testing)
- `repository.kodi-addons/` — Repository add-on

## Install

Install `repository.kodi-addons/repository.kodi-addons-*.zip` in Kodi to subscribe to this repo.

## Build

From `kodi-manager/`:

```bash
./scripts/build-repo.sh ../kodi-addons
```

This regenerates `addons.xml`, `addons.xml.md5`, and builds all addon zips.
