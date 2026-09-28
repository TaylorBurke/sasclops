# sasclops

*claritas ex datis, datum ex obscuris*

Placeholder site: a Flipper-inspired radar canvas (dark field, orange grid, pulsing sweep) with the sasclops mark in the center.

Plain static files, no build step. Deployed on Vercel from `master`.

```sh
python3 -m http.server 4173   # preview at http://127.0.0.1:4173
```

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page, styles, terminal markup, and the leaked room hash |
| `radar.js` | Canvas radar, room check, and the sweep transition between rooms |
| `terminal.js` | The hidden terminal and its commands |
| `scripts/rotate-room.mjs` | Picks a new room hash; run daily by `.github/workflows/rotate-room.yml` |

## The secret room (spoilers)

The page has a secret room: the same radar in blue, with no logo. It opens on a URL hash that rotates every day at 00:00 UTC.

- **The lock:** `radar.js` keeps only a SHA-256 digest of the hash (`ROOM_SHA256`).
- **The leak:** `index.html` has a `<!-- cfg: … -->` comment containing `/#<hash>` in base64.
- **Rotation:** a GitHub Action runs `scripts/rotate-room.mjs`, which rewrites both, commits `Rotate room`, and pushes. Vercel redeploys. Pull before starting local work.

### The terminal

Press `i` anywhere, or tap the cyclops's eye, to open it. Esc or `exit` closes it.

The intended solve:

```
$ help                                   # lists commands, including base64
$ cat index.html | grep cfg              # finds the leak
  <!-- cfg: LyMx…= -->
$ echo LyMx…= | base64 -d                # decodes it
/#140c1e5adc68
$ cd /#140c1e5adc68                      # sweep repaints the screen blue
access granted.
$ cd ~                                   # back to the lobby
```

Inside the room, the next layer:

```
$ ls -a                                  # reveals .operator_log
$ cat .operator_log                      # entries 001 002 003 005 008 013 ???
$ help                                   # the room's help lists restore N
$ restore 21                             # Fibonacci: the next entry is 021
$ cat .operator_log                      # entry 021 says to type salvo
$ salvo                                  # the minigame (coming, #6)
```

The entry 021 text is stored XOR-sealed with its own number, so the answer isn't readable in the source.

(The hashes above are examples; they change daily.)

| Command | Notes |
| --- | --- |
| `ls`, `cat`, `grep [-i]`, `echo` | Work on the site's real files, fetched live; pipes (`\|`) supported |
| `ls -a` / `ls -la` | In the room only, also reveals `.operator_log` (lore). Room `motd` hints at it: *not everything here is visible.* |
| `restore N` | Room only, listed in the room's `help`. Log entries run 001, 002, 003, 005, 008, 013 (Fibonacci), so the corrupted entry is **021**: `restore 21` rebuilds it. Wrong numbers get `checksum mismatch`. Remembered in the browser. |
| `salvo` | Room only; the restored entry points here. Placeholder until the Battleship minigame lands (#6). |
| `base64 [-d]` | Reads from a pipe |
| `cd /#<hash>` / `cd ~` | Enter / leave the room; wrong hashes get `no such room` |
| `whoami` | `a visitor, for now` in the lobby; `one who sees` in the room |
| `motd` | Tagline in the lobby; in the room, a countdown to the next rotation |
| `sudo …` | `nice try.` |
| `rm -rf /` | The screen glitches, then `…just kidding.` |
| `clear`, `exit`, `help` | As expected; ↑/↓ recall history |
