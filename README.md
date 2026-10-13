# Clippy plugin for Paarrot

Floating paperclip assistant. Playback follows the Microsoft Agent model read from
`CLIPPIT.ACS`: frame list order, probabilistic branches, exit chains, and the end marker.
Clippy's animations are all `no transition`, so the way back is stored as real frames —
the ping-pong comes out of the walk itself.

Frames are embedded as base64 data URIs.

## Install

Copy `index.js`, `plugin-metadata.json` and `thumbnail.png` to:

    ~/.config/paarrot/plugins/clippy/

Then run `/clippy show` or use the toolbar button.

## Regenerating index.js

`index.js` is generated from `index.template.js` by the generator in the BonziBuddy repo:

    cd ~/dev/BonziBuddy && python3 tools/acs_plugin_data.py

It reads `extracted/assets/CLIPPIT.ACS` with `tools/acs.py`, the rendered frames in
`extracted/frames/CLIPPIT/<Animation>/<NNN>.png`, writes `extracted/clippy_plugin_data.json`,
and replaces `__DATA__` in the template.

Hand edits to `index.js` are lost on regeneration. Edit `index.template.js` instead.
