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
| `salvo.js` | SALVO, the Battleship minigame, drawn on the radar canvas |
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
$ salvo                                  # the minigame
```

The entry 021 text is stored XOR-sealed with its own number, so the answer isn't readable in the source.

(The hashes above are examples; they change daily.)

| Command | Notes |
| --- | --- |
| `ls`, `cat`, `grep [-i]`, `echo` | Work on the site's real files, fetched live; pipes (`\|`) supported |
| `ls -a` / `ls -la` | In the room only, also reveals `.operator_log` (lore). Room `motd` hints at it: *not everything here is visible.* |
| `restore N` | Room only, listed in the room's `help`. Log entries run 001, 002, 003, 005, 008, 013 (Fibonacci), so the corrupted entry is **021**: `restore 21` rebuilds it. Wrong numbers get `checksum mismatch`. Remembered in the browser. |
| `salvo` | Room only; the restored entry points here. Starts SALVO (below). |
| `base64 [-d]` | Reads from a pipe |
| `cd /#<hash>` / `cd ~` | Enter / leave the room; wrong hashes get `no such room` |
| `whoami` | `a visitor, for now` in the lobby; `one who sees` in the room |
| `motd` | Tagline in the lobby; in the room, a countdown to the next rotation |
| `sudo …` | `nice try.` |
| `CMD > FILE` / `CMD >> FILE` | Write (or append) output to a file. Files live in the visitor's browser (localStorage, max 20 files of 4000 chars). The site's own files and `.operator_log` are read-only (`Permission denied`). `help` hints at it: *save output with >*. |
| `rm FILE` | Deletes your own files; `rm .fire_control` resets it to the default |
| `rm -rf /` | The screen glitches, then `…just kidding.` |
| `clear`, `exit`, `help` | As expected; ↑/↓ recall history |

### SALVO

Battleship against a hidden fleet, played on the radar above the terminal.

1. `salvo` asks where to launch counterstrikes from: a coordinate like `e5`. That cell is your ship, and one hit on it loses the game.
2. The enemy hides **3 ships, each 4 tiles long**, horizontal or vertical, and **fires first** at a random cell.
3. Take turns: type `a`–`j` plus `1`–`10` (e.g. `c7`) to fire. `quit` stands down.
4. Hit every enemy tile to win: `the returns have all been cleared, stand by`.

Everything waits for the sweep. The board appears on the next pass after you pick your position, and each shot is shown **and reported** only when the bar crosses its row.

| On the board | Look | Refreshed by each sweep? |
| --- | --- | --- |
| Frame, grid, labels | blue | yes; burns back in, then fades toward a floor |
| Your ship | solid blue square | yes |
| Any shot | white square | no; flashes once, then fades away |
| Hit on an enemy ship | red square | yes |
| Your miss, with plot memory | orange square | yes |

**Plot memory upgrade:** in the room, `ls -a` also shows `.fire_control`:

```
$ cat .fire_control
# SASCLOPS fire control
plot_memory=off
$ echo plot_memory=on > .fire_control
$ salvo                                  # "plot memory online": your misses now stay orange
```

`radar.js` exposes `sasclops.addOverlay(draw)` and `sasclops.lastCross(y, t)` / `nextCross(y, t)` (when the bar crosses height `y`); `terminal.js` exposes `sasclops.term.takeOver()` so a program can borrow the prompt. Follow-ups: smarter enemy (#9), win reward (#10).
