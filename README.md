# Photo

A lightweight desktop photo manager built with Tauri 2 + Vanilla JS.

## Features

- **Photo grid** — browse a folder's photos sorted by modification time
- **Culling mode** — single-photo review with keyboard shortcuts for quick rating and flagging
- **Folder panel** — navigate nested folder hierarchies as workspaces
- **Lightbox** — full-screen viewing with prev/next navigation
- **Metadata panel** — read EXIF data (camera, ISO, aperture, shutter, focal length, GPS)
- **Ratings** — 1–5 star ratings (keyboard: `1`–`5`)
- **Color labels** — red / yellow / green / blue / purple
- **Flag / Reject** — mark photos to keep or discard (`P` / `X`)
- **Filter** — filter grid by rating, label, or flagged status
- **Rename** — rename photos in-place with sidecar metadata sync
- **Reveal in Finder** — open photo location in the system file manager

Metadata (ratings, labels, flags) is stored in a `.photo_meta.json` sidecar file inside each folder — photos themselves are never modified.

### Supported formats

`JPG` `JPEG` `PNG` `WebP` `HEIC` `HEIF` `TIFF` `TIF` `GIF` `BMP` `AVIF`

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2](https://tauri.app) |
| Backend | Rust (`walkdir`, `kamadak-exif`, `serde_json`) |
| Frontend | Vanilla HTML / CSS / JavaScript (no framework) |

## Development

**Prerequisites:** [Rust](https://rustup.rs) · [Node.js](https://nodejs.org)

```bash
# Install JS dependencies
npm install

# Start dev server with hot-reload
npm run tauri dev

# Build a release binary
npm run tauri build
```

## License

[MIT](LICENSE)
