/**
 * Clippy - floating paperclip assistant for Paarrot.
 *
 * Playback follows the Microsoft Agent model read from CLIPPIT.ACS: frame list order,
 * probabilistic branches, exit chains, and the end marker. Clippy's animations are all
 * "no transition", so the way back is stored as real frames in the frame list - the
 * ping-pong shape comes out of the walk itself.
 *
 * Frames are embedded as data URIs. Regenerate with:
 *   python3 tools/acs_plugin_data.py
 */

const DATA = __DATA__;

const LINES = {
  greeting: [
    "Hey, there. What's the word?",
    "How's life? All work and no play?",
    "I'm Clippy. I used to help people in Office.",
  ],
  typing: [
    "It looks like you're writing a message. Do you want help?",
    "I notice you're typing. Would you like help with spelling?",
    "Are you writing to a colleague? I can help you sound formal.",
    "That's a long message. Do you want me to check it for typos?",
  ],
  reminder: [
    "Here's your reminder. Don't forget this.",
    "Consider yourself reminded.",
  ],
  idle: [
    "Just a thin metal wire, but I can keep everything together.",
    "Want quick answers? Just click me.",
    "Nothing to do right now. I'll hang out.",
  ],
};

// States that only hold the character; the rest are actions the program calls.
const IDLE_STATES = ["IDLINGLEVEL1", "IDLINGLEVEL2", "IDLINGLEVEL3"];

let ctxRef = null;
let root = null;
let img = null;
let balloon = null;
let currentAnim = null;
let frameIndex = 0;
let replayTaken = false;
let pending = null;
let lastTipAt = 0;
let balloonTimer = null;
let walkTimer = null;
let inputHandler = null;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function resolve(name) {
  return DATA.anim[name] ? name : DATA.fallback[name];
}

function showBalloon(text) {
  balloon.textContent = text;
  balloon.style.display = 'block';

  if (balloonTimer) clearTimeout(balloonTimer);
  balloonTimer = setTimeout(() => {
    balloon.style.display = 'none';
  }, (ctxRef.settings.get('balloonSeconds') || 6) * 1000);
}

function renderFrame() {
  const src = DATA.img[currentAnim][frameIndex];
  if (src) img.src = `data:image/png;base64,${src}`;
}

function frame() {
  return DATA.anim[currentAnim].f[frameIndex];
}

function rollBranch(f) {
  const branches = f[2];
  if (!branches.length) return null;

  const total = branches.reduce((sum, b) => sum + b[1], 0);
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [target, probability] of branches) {
    acc += probability;
    if (roll < acc) return [target, probability];
  }

  // Probabilities do not always sum to 100; the remainder falls through to the normal path.
  return null;
}

function finish() {
  const nextAnim = pending;
  pending = null;
  currentAnim = null;

  if (nextAnim) {
    currentAnim = nextAnim;
    frameIndex = 0;
    replayTaken = false;
    walk();
    return;
  }

  scheduleIdle();
}

// The exit chain is taken when an animation is stopped, not on a natural finish.
// Clippy's frame lists already contain the way back as real frames, so the chain is
// usually a jump into the mirror section.
function exitChain() {
  const f = frame();
  const next = f[1];

  if (next < 0) {
    finish();
    return;
  }

  frameIndex = next;
  renderFrame();
  walkTimer = setTimeout(exitChain, f[0] * 10 * speed());
}

function speed() {
  return ctxRef.settings.get('speed') || 1;
}

function walk() {
  const anim = DATA.anim[currentAnim];
  const f = frame();

  renderFrame();

  const branch = rollBranch(f);

  // A 100% replay branch (Thinking, Processing, GetTechy) means the animation can never
  // reach its own end. Play one pass, then stop and walk out through the exit chain.
  if (branch && branch[1] === 100 && branch[0] <= frameIndex) {
    if (replayTaken) {
      exitChain();
      return;
    }
    replayTaken = true;
  }

  const next = branch ? branch[0] : frameIndex + 1;

  if (next >= anim.f.length) {
    finish();
    return;
  }

  frameIndex = next;
  walkTimer = setTimeout(walk, f[0] * 10 * speed());
}

function startAnimation(name) {
  const target = resolve(name);
  if (!DATA.anim[target]) return;

  clearTimeout(walkTimer);

  if (currentAnim) {
    // Stopping an animation walks its exit chain before the next one plays.
    pending = target;
    exitChain();
    return;
  }

  currentAnim = target;
  frameIndex = 0;
  replayTaken = false;
  walk();
}

function scheduleIdle() {
  clearTimeout(walkTimer);
  const delay = 3000 + Math.random() * 7000;
  walkTimer = setTimeout(() => {
    startAnimation(pick(DATA.states[pick(IDLE_STATES)]));
  }, delay);
}

function applyScale() {
  const scale = ctxRef.settings.get('scale') || 1;
  img.style.width = `${Math.round(124 * scale)}px`;
}

function applyPosition() {
  const saved = ctxRef.settings.get('position');
  if (saved) {
    const [x, y] = saved.split(',');
    root.style.left = `${Number(x)}px`;
    root.style.top = `${Number(y)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    return;
  }

  root.style.right = '24px';
  root.style.bottom = '90px';
  root.style.left = 'auto';
  root.style.top = 'auto';
}

function mount() {
  if (root) return root;

  document.getElementById('clippy-overlay')?.remove();

  root = document.createElement('div');
  root.id = 'clippy-overlay';
  root.setAttribute('aria-label', 'Clippy assistant');
  root.style.cssText =
    'position:fixed;z-index:9999;display:flex;flex-direction:column;gap:6px;' +
    'align-items:flex-start;cursor:grab;user-select:none;touch-action:none;';

  balloon = document.createElement('div');
  balloon.style.cssText =
    'max-width:260px;padding:8px 10px;border-radius:8px;background:#fff;color:#111;' +
    'font-size:13px;line-height:1.4;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:none;';

  img = document.createElement('img');
  img.alt = 'Clippy';
  img.draggable = false;
  img.style.cssText = 'display:block;image-rendering:pixelated;';

  root.appendChild(balloon);
  root.appendChild(img);
  document.body.appendChild(root);

  applyScale();
  applyPosition();

  root.addEventListener('pointerdown', (event) => {
    // Capture keeps the move and up events on the sprite even when the pointer
    // leaves it, so a drag always ends and the position is saved.
    root.setPointerCapture(event.pointerId);

    const offsetX = event.clientX - root.offsetLeft;
    const offsetY = event.clientY - root.offsetTop;

    const move = (e) => {
      root.style.left = `${e.clientX - offsetX}px`;
      root.style.top = `${e.clientY - offsetY}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    };

    const up = () => {
      root.releasePointerCapture(event.pointerId);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      ctxRef.settings.set('position', `${root.offsetLeft},${root.offsetTop}`);
    };

    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
  });

  return root;
}

function show() {
  mount();
  root.style.display = 'flex';
  showBalloon(pick(LINES.greeting));
  startAnimation('RestPose');
}

function hide() {
  if (root) root.style.display = 'none';
}

function onTyping(event) {
  if (!ctxRef.settings.get('showOnTyping')) return;
  if (!root || root.style.display === 'none') return;

  const target = event.target;
  if (!target || (target.tagName !== 'TEXTAREA' && !target.isContentEditable)) return;

  const cooldown = (ctxRef.settings.get('tipCooldown') || 45) * 1000;
  if (Date.now() - lastTipAt < cooldown) return;
  lastTipAt = Date.now();

  showBalloon(pick(LINES.typing));
  startAnimation('GetAttention');
}

module.exports = {
  name: "Clippy",
  version: "1.0.2",

  onLoad: async (ctx) => {
    ctxRef = ctx;

    ctx.settings.define({
      enabled: {
        type: 'boolean',
        label: 'Show Clippy',
        description: 'Float Clippy over the chat window',
        default: true,
      },
      scale: {
        type: 'number',
        label: 'Size',
        description: 'Sprite scale factor (frames are 124x93)',
        default: 1,
      },
      speed: {
        type: 'number',
        label: 'Playback speed',
        description: 'Multiplier on the frame durations from CLIPPIT.ACS',
        default: 1,
      },
      showOnTyping: {
        type: 'boolean',
        label: 'Comment when typing',
        description: 'Clippy speaks when you start writing a message',
        default: true,
      },
      tipCooldown: {
        type: 'number',
        label: 'Tip cooldown',
        description: 'Seconds between typing tips',
        default: 45,
      },
      balloonSeconds: {
        type: 'number',
        label: 'Balloon duration',
        description: 'Seconds the speech balloon stays visible',
        default: 6,
      },
      position: {
        type: 'string',
        label: 'Position',
        description: 'Saved x,y on screen. Drag Clippy to change it.',
        default: '',
      },
    });

    ctx.commands.register({
      name: 'clippy',
      args: ['action', 'text'],
      description: 'Show, hide, or make Clippy say something',
      run: ({ action, text }) => {
        if (!action || action === 'show') {
          show();
          return null;
        }
        if (action === 'hide') {
          hide();
          return null;
        }
        if (action === 'say') {
          showBalloon(text || 'I have nothing to say.');
          startAnimation('Explain');
          return null;
        }
        return 'Usage: /clippy [show|hide|say <text>]';
      },
    });

    ctx.ui.registerButton({
      id: 'clippy-toggle',
      location: 'text-composer-toolbar',
      label: 'Clippy',
      icon: '📎',
      onClick: () => {
        if (!root || root.style.display === 'none') show();
        else hide();
      },
    });

    inputHandler = onTyping;
    document.addEventListener('input', inputHandler);

    if (ctx.settings.get('enabled')) show();

    ctx.log('Clippy loaded. /clippy say hello');
  },

  onUnload: async () => {
    if (inputHandler) document.removeEventListener('input', inputHandler);
    if (balloonTimer) clearTimeout(balloonTimer);
    if (walkTimer) clearTimeout(walkTimer);
    if (root) root.remove();
    root = null;
    img = null;
    balloon = null;
  },
};
