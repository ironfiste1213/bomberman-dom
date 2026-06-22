import { PLAYER_COLORS } from "../shared/constants.js";

// module-level game engine — lives entirely outside the component tree
// started once when the server sends game:start

export const engine = {

  // hold the latest game data tick received from the server
  gameState: null,
  // store local coordinates map layouts
  map: [],
  // animation frame identifier to manage loops
  rafId: null,
  // cache references to player DOM nodes by their IDs
  playerElems: {},
  // cache references to active bomb DOM nodes by their IDs
  bombElems: {},
  // cache references to active explosion DOM nodes by their IDs
  explosionElems: {},
  // cache references to powerup DOM nodes by their IDs
  powerupElems: {},
  // flag tracking if window key listeners have been registered
  inputBound: false,
  // callback function to transmit keys back to the client worker
  sendInput: null,

  // FPS tracking
  _fps: 0,
  _frameCount: 0,
  _lastFpsTime: 0,

  // returns the calculated frames per second metric
  getFps() {
    return this._fps;
  },

  // initialize the local gameplay loops, reset structures, and load the map
  start({ map, sendInput }) {
    // assign map grid columns and rows structure
    this.map = map || [];
    // store the callback to forward key outputs
    this.sendInput = typeof sendInput === "function" ? sendInput : null;
    // wipe active DOM caching references to prevent residue elements
    this.playerElems = {};
    this.bombElems = {};
    this.explosionElems = {};
    this.powerupElems = {};
    // reset tracking counters for performance metrics
    this._fps = 0;
    this._frameCount = 0;
    this._lastFpsTime = performance.now();
    // prevent duplicate threads by canceling outstanding loops
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // initialize keyboard capture listeners and request animation loops
    this._startInput();
    this._startRAF();
  },

  // stop execution, cancel active loops, and completely clear DOM nodes
  stop() {
    // request cancellation of the animation frames loop
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // clean up references to the global state
    this.gameState = null;
    this.map = [];
    // walk through cache objects and remove active element nodes from the document tree
    for (const el of Object.values(this.playerElems)) {
      el.remove();
    }
    for (const el of Object.values(this.bombElems)) {
      el.remove();
    }
    for (const el of Object.values(this.explosionElems)) {
      el.remove();
    }
    for (const el of Object.values(this.powerupElems)) {
      el.remove();
    }
    // reset cache maps to clean up references
    this.playerElems = {};
    this.bombElems = {};
    this.explosionElems = {};
    this.powerupElems = {};
    this.sendInput = null;
    this._fps = 0;
  },

  // set up window event listeners to intercept key down and key up movement requests
  _startInput() {
    // exit early if listeners have already been set up in the window
    if (this.inputBound) return;
    this.inputBound = true;

    // track the active keyboard key states for direct movements or placing bombs
    const keys = { up: false, down: false, left: false, right: false, bomb: false };
    // map arrows, wasd, and space keys to the local movement keys schema
    const KEY_MAP = {
      ArrowUp: "up", w: "up",
      ArrowDown: "down", s: "down",
      ArrowLeft: "left", a: "left",
      ArrowRight: "right", d: "right",
      " ": "bomb",
      Spacebar: "bomb"
    };

    // transmit the mapped keys container object to the connection worker
    const push = () => {
      if (!this.sendInput) return;
      this.sendInput({ ...keys });
      // drop the bomb event status immediately to prevent endless bomb spawning ticks
      if (keys.bomb) {
        keys.bomb = false;
      }
    };
 
    // clear all direction states and notify server when focusing inputs
    const resetKeys = () => {
      let changed = false;
      for (const k of Object.keys(keys)) {
        if (keys[k]) {
          keys[k] = false;
          changed = true;
        }
      }
      if (changed) {
        push();
      }
    };

    // trigger key state changes on keyboard key down interactions
    window.addEventListener("keydown", (e) => {
      // abort key movement commands if input elements are currently focused
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        resetKeys();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      // prevent multiple duplicate push triggers when keys are held down
      if (keys[dir]) return;
      keys[dir] = true;
      push();
    });

    // toggle off movement direction flags when user releases keys
    window.addEventListener("keyup", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        resetKeys();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      keys[dir] = false;
      push();
    });
  },

  // run the requestAnimationFrame loop to render movements, explosions, and powerups at 60fps
  _startRAF() {
    const loop = (timestamp) => {
      // update frame counts and dispatch custom event metric every second
      this._frameCount++;
      const elapsed = timestamp - this._lastFpsTime;
      if (elapsed >= 1000) {
        this._fps = Math.round((this._frameCount * 1000) / elapsed);
        this._frameCount = 0;
        this._lastFpsTime = timestamp;
        // fire custom window event to push the fps updates to the HUD display
        window.dispatchEvent(new CustomEvent("engine:fps", { detail: { fps: this._fps } }));
      }

      // pull local grid size variables and handle calculations
      const state = this.gameState;
      if (state && state.map && state.map.grid) {
        this.map = state.map.grid;
      }
      const MAP_COLS = this.map[0]?.length || 15;
      const MAP_ROWS = this.map.length || 13;
      const arena = document.getElementById("arena");
      if (state && arena) {
        // loop through current coordinates maps and update classNames if blocks were blown up
        if (state.map && state.map.grid) {
          for (let r = 0; r < state.map.grid.length; r++) {
            const row = state.map.grid[r];
            for (let c = 0; c < row.length; c++) {
              const cell = row[c];
              const tileEl = document.getElementById(`tile-${r}-${c}`);
              if (tileEl) {
                if (cell === ".") {
                  tileEl.className = "tile tile-floor";
                } else if (cell === "W") {
                  tileEl.className = "tile tile-wall";
                } else if (cell === "B") {
                  tileEl.className = "tile tile-block";
                }
              }
            }
          }
        }

        // identify and clean up DOM nodes for disconnected or defeated players
        const activePlayerIds = new Set((state.players || []).map(p => p.id));
        for (const id of Object.keys(this.playerElems)) {
          if (!activePlayerIds.has(id)) {
            this.playerElems[id].remove();
            delete this.playerElems[id];
          }
        }

        // iterate active players to place character sprites and assign colors or bot titles
        for (const p of state.players || []) {
          let el = this.playerElems[p.id];
          if (!el) {
            // create character token element node if it does not exist yet
            el = document.createElement("div");
            const colorClass = `token-${PLAYER_COLORS[(p.playerNumber - 1) % PLAYER_COLORS.length]}`;
            el.className = `player-sprite ${colorClass}${p.isBot ? " bot-sprite" : ""}`;
            el.title = p.isBot ? `🤖 ${p.nickname}` : p.nickname;
            el.textContent = p.isBot ? "🤖" : p.playerNumber;
            arena.appendChild(el);
            this.playerElems[p.id] = el;
          }
          // position player sprite centered inside grid tiles using percentage values
          el.style.left = `${((p.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top  = `${((p.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.display = p.alive ? "inline-flex" : "none";
          el.classList.toggle("immune", Boolean(p.immune));
        }

        // construct bomb models, scale them, and position them on corresponding grid coordinates
        const activeBombIds = new Set();
        for (const b of state.bombs || []) {
          activeBombIds.add(b.id);
          let el = this.bombElems[b.id];
          if (!el) {
            el = document.createElement("div");
            el.className = "bomb-sprite";
            arena.appendChild(el);
            this.bombElems[b.id] = el;
          }
          // position bomb sprite centered inside grid tiles using percentage values
          el.style.left = `${((b.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top  = `${((b.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width  = `calc(${(1 / MAP_COLS) * 100}% - 4px)`;
          el.style.height = `calc(${(1 / MAP_ROWS) * 100}% - 4px)`;
        }

        // clear exploded bomb sprites from the DOM container when removed from server state
        for (const id of Object.keys(this.bombElems)) {
          if (!activeBombIds.has(id)) {
            this.bombElems[id].remove();
            delete this.bombElems[id];
          }
        }

        // create explosion line effects to cover target grid paths
        const activeExplosionIds = new Set();
        for (const e of state.explosions || []) {
          activeExplosionIds.add(e.id);
          let el = this.explosionElems[e.id];
          if (!el) {
            el = document.createElement("div");
            el.className = "explosion-sprite";
            arena.appendChild(el);
            this.explosionElems[e.id] = el;
          }
          // position explosion sprite centered inside grid tiles using percentage values
          el.style.left   = `${((e.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top    = `${((e.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width  = `${(1 / MAP_COLS) * 100}%`;
          el.style.height = `${(1 / MAP_ROWS) * 100}%`;
        }

        // remove expired explosion visuals from the DOM container
        for (const id of Object.keys(this.explosionElems)) {
          if (!activeExplosionIds.has(id)) {
            this.explosionElems[id].remove();
            delete this.explosionElems[id];
          }
        }

        // display powerups on floor tiles for speed boots, bomb count, and range flames
        const activePowerupIds = new Set();
        for (const pu of state.powerups || []) {
          activePowerupIds.add(pu.id);
          let el = this.powerupElems[pu.id];
          if (!el) {
            el = document.createElement("div");
            el.className = `powerup-sprite powerup-${pu.type}`;
            el.title = pu.type;
            arena.appendChild(el);
            this.powerupElems[pu.id] = el;
          }
          // position powerup sprite centered inside grid tiles using percentage values
          el.style.left   = `${((pu.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top    = `${((pu.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width  = `${(1 / MAP_COLS) * 100}%`;
          el.style.height = `${(1 / MAP_ROWS) * 100}%`;
        }

        // delete powerup entities when players step over and collect them
        for (const id of Object.keys(this.powerupElems)) {
          if (!activePowerupIds.has(id)) {
            this.powerupElems[id].remove();
            delete this.powerupElems[id];
          }
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
};