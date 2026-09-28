// The terminal: press `i` (or tap the eye) to open. A tiny shell over the site's own files,
// with pipes, so the room can be found without leaving the page.
(() => {
  const FILES = ['index.html', 'radar.js', 'terminal.js', 'sasclops.png'];
  const HELP = `commands:
  ls              list files
  cat FILE        print a file
  grep PATTERN    keep lines that match (-i ignores case)
  echo TEXT       print text
  base64 [-d]     encode text, or decode it with -d
  cd PATH         go somewhere
  whoami  motd  clear  exit

chain commands with |   e.g.  cat index.html | grep title`;

  const dialog = document.querySelector('.term');
  const out = dialog.querySelector('.term-out');
  const form = dialog.querySelector('.term-line');
  const input = dialog.querySelector('.term-in');
  const prompt = dialog.querySelector('.prompt');
  const past = [];
  let recall = 0;
  let booted = false;

  class ShellError extends Error {}

  function print(text, kind) {
    const line = document.createElement('div');
    line.textContent = text;
    if (kind) line.className = kind;
    out.append(line);
    out.scrollTop = out.scrollHeight;
  }

  function where() {
    return sasclops.inRoom() ? '/room' : '~';
  }

  function refreshPrompt() {
    prompt.textContent = `visitor@sasclops:${where()}$`;
  }

  // "a | b 'c d'" → [['a'], ['b', 'c d']]
  function parse(line) {
    const stages = [[]];
    let word = null, quote = null;
    const end = () => { if (word !== null) stages.at(-1).push(word); word = null; };
    for (const ch of line) {
      if (quote) {
        if (ch === quote) quote = null;
        else word += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        word ??= '';
      } else if (ch === '|') {
        end();
        stages.push([]);
      } else if (/\s/.test(ch)) {
        end();
      } else {
        word = (word ?? '') + ch;
      }
    }
    if (quote) throw new ShellError('unterminated quote');
    end();
    if (stages.some((s) => s.length === 0)) throw new ShellError('syntax error near |');
    return stages;
  }

  async function readFile(cmd, name) {
    const file = name.replace(/^(\.\/|\/)/, '');
    if (!FILES.includes(file)) throw new ShellError(`${cmd}: ${name}: No such file or directory`);
    if (file.endsWith('.png')) throw new ShellError(`${cmd}: ${name}: binary file (it's a picture of me)`);
    const res = await fetch(file, { cache: 'no-store' });
    if (!res.ok) throw new ShellError(`${cmd}: ${name}: could not read`);
    return (await res.text()).replace(/\n$/, '');
  }

  function untilRotation() {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const mins = Math.ceil((next - now) / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function glitch() {
    const root = document.documentElement;
    root.classList.remove('glitch');
    void root.offsetWidth; // restart the animation if it's already running
    root.classList.add('glitch');
    setTimeout(() => root.classList.remove('glitch'), 900);
  }

  const commands = {
    help: () => HELP,
    ls: () => FILES.join('  '),
    echo: (args) => args.join(' '),
    clear: () => { out.replaceChildren(); return ''; },
    exit: () => { dialog.close(); return ''; },
    whoami: () => (sasclops.inRoom() ? 'one who sees' : 'a visitor, for now'),
    sudo: () => 'nice try.',
    motd: () => (sasclops.inRoom()
      ? `the room moves in ${untilRotation()} (00:00 UTC)`
      : 'claritas ex datis, datum ex obscuris'),

    async cat(args, stdin) {
      if (!args.length) return stdin;
      const parts = [];
      for (const name of args) parts.push(await readFile('cat', name));
      return parts.join('\n');
    },

    async grep(args, stdin) {
      const ignoreCase = args.includes('-i');
      const [pattern, file] = args.filter((a) => a !== '-i');
      if (pattern === undefined) throw new ShellError('usage: grep [-i] PATTERN [FILE]');
      const text = file ? await readFile('grep', file) : stdin;
      const needle = ignoreCase ? pattern.toLowerCase() : pattern;
      return text.split('\n')
        .filter((l) => (ignoreCase ? l.toLowerCase() : l).includes(needle))
        .join('\n');
    },

    base64(args, stdin) {
      const decode = args.some((a) => a === '-d' || a === '--decode');
      const operands = args.filter((a) => !a.startsWith('-'));
      if (operands.length) throw new ShellError('base64: pipe text in, e.g.  echo hi | base64');
      if (!decode) return btoa(String.fromCharCode(...new TextEncoder().encode(stdin)));
      try {
        const bytes = Uint8Array.from(atob(stdin.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new ShellError('base64: invalid input');
      }
    },

    async cd(args) {
      const target = args[0] ?? '~';
      if (['~', '/', '..', '-'].includes(target)) {
        if (!sasclops.inRoom()) return '';
        sasclops.leave();
        setTimeout(() => dialog.close(), 500);
        return 'leaving the room…';
      }
      const tag = target.match(/^\/?#(.+)$/)?.[1];
      if (!tag) throw new ShellError(`cd: ${target}: No such file or directory`);
      if (!(await sasclops.isRoom(tag))) throw new ShellError(`cd: ${target}: no such room`);
      if (sasclops.inRoom()) return 'you are already here.';
      location.hash = tag;
      setTimeout(() => dialog.close(), 500);
      return 'access granted.';
    },

    rm(args) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const everything = args.some((a) => a === '/' || a === '/*');
      if (!(flags.includes('r') && flags.includes('f') && everything)) {
        throw new ShellError('rm: permission denied');
      }
      glitch();
      setTimeout(() => print('…just kidding.'), 1000);
      return 'deleting / …';
    },
  };

  async function run(line) {
    let stdin = '';
    for (const [name, ...args] of parse(line)) {
      const cmd = Object.hasOwn(commands, name) ? commands[name] : null;
      if (!cmd) throw new ShellError(`sasclops: command not found: ${name}`);
      stdin = (await cmd(args, stdin)) ?? '';
    }
    return stdin;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const line = input.value.trim();
    input.value = '';
    print(`${prompt.textContent} ${line}`, 'echo');
    if (!line) return;
    past.push(line);
    recall = past.length;
    try {
      const result = await run(line);
      if (result) print(result);
    } catch (err) {
      print(err instanceof ShellError ? err.message : `sasclops: ${err.message}`, 'err');
    }
    refreshPrompt();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    recall = Math.min(Math.max(recall + (e.key === 'ArrowUp' ? -1 : 1), 0), past.length);
    input.value = past[recall] ?? '';
  });

  function open() {
    if (dialog.open) return;
    if (!booted) {
      print('SASCLOPS OS v0.1 — claritas ex datis');
      print("type 'help' to get started.");
      booted = true;
    }
    refreshPrompt();
    dialog.showModal();
    input.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'i' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || dialog.open) return;
    e.preventDefault(); // keep the `i` out of the prompt
    open();
  });
  document.querySelector('.eye').addEventListener('click', open);
})();
