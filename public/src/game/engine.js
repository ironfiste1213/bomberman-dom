import { PLAYER_COLORS } from "../shared/constants.js";

// Module-level game engine — lives entirely outside the component tree.
// Started once when the server sends game:start.

export const engine = {

  gameState: null,
  map: [],
  rafId: null,
  playerElems: {},
  bombElems: {},
  explosionElems: {},
  powerupElems: {},
  inputBound: false,
  sendInput: null,

  start({ map, sendInput }) {
    this.map = map || [];
    this.sendInput = typeof sendInput === "function" ? sendInput : null;
    this.playerElems = {};
    this.bombElems = {};
    this.explosionElems = {};
    this.powerupElems = {};
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._startInput();
    this._startRAF();
  },

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.gameState = null;
    this.map = [];
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
    this.playerElems = {};
    this.bombElems = {};
    this.explosionElems = {};
    this.powerupElems = {};
    this.sendInput = null;
  },

  _startInput() {
    if (this.inputBound) return;
    this.inputBound = true;

    const keys = { up: false, down: false, left: false, right: false, bomb: false };
    const KEY_MAP = {
      ArrowUp: "up", w: "up",
      ArrowDown: "down", s: "down",
      ArrowLeft: "left", a: "left",
      ArrowRight: "right", d: "right",
      " ": "bomb",
      Spacebar: "bomb"
    };

    const push = () => {
      if (!this.sendInput) return;
      this.sendInput({ ...keys });
      if (keys.bomb) {
        keys.bomb = false;
      }
    };
 
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

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        resetKeys();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      if (keys[dir]) return;
      keys[dir] = true;
      push();
    });

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

  _startRAF() {
    const loop = () => {
      const state = this.gameState;
      if (state && state.map && state.map.grid) {
        this.map = state.map.grid;
      }
      const MAP_COLS = this.map[0]?.length || 15;
      const MAP_ROWS = this.map.length || 13;
      const arena = document.getElementById("arena");
      if (state && arena) {
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

        // Clean up left players
        const activePlayerIds = new Set((state.players || []).map(p => p.id));
        for (const id of Object.keys(this.playerElems)) {
          if (!activePlayerIds.has(id)) {
            this.playerElems[id].remove();
            delete this.playerElems[id];
          }
        }

        // Render/update players
        for (const p of state.players || []) {
          let el = this.playerElems[p.id];
          if (!el) {
            el = document.createElement("div");
            el.className = `player-sprite token-${PLAYER_COLORS[(p.playerNumber - 1) % PLAYER_COLORS.length]}`;
            el.title = p.nickname;
            el.textContent = p.playerNumber;
            arena.appendChild(el);
            this.playerElems[p.id] = el;
          }
          el.style.left = `${(p.x / MAP_COLS) * 100}%`;
          el.style.top = `${(p.y / MAP_ROWS) * 100}%`;
          el.style.display = p.alive ? "inline-flex" : "none";
        }

        // Render/update bombs
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
          el.style.left = `${((b.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top = `${((b.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width = `calc(${(1 / MAP_COLS) * 100}% - 4px)`;
          el.style.height = `calc(${(1 / MAP_ROWS) * 100}% - 4px)`;
        }

        // Clean up removed/exploded bombs
        for (const id of Object.keys(this.bombElems)) {
          if (!activeBombIds.has(id)) {
            this.bombElems[id].remove();
            delete this.bombElems[id];
          }
        }

        // Render/update explosions
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
          el.style.left = `${((e.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top = `${((e.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width = `${(1 / MAP_COLS) * 100}%`;
          el.style.height = `${(1 / MAP_ROWS) * 100}%`;
        }

        // Clean up expired explosions
        for (const id of Object.keys(this.explosionElems)) {
          if (!activeExplosionIds.has(id)) {
            this.explosionElems[id].remove();
            delete this.explosionElems[id];
          }
        }

        // Render/update powerups
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
          el.style.left = `${((pu.x + 0.5) / MAP_COLS) * 100}%`;
          el.style.top = `${((pu.y + 0.5) / MAP_ROWS) * 100}%`;
          el.style.width = `${(1 / MAP_COLS) * 100}%`;
          el.style.height = `${(1 / MAP_ROWS) * 100}%`;
        }

        // Clean up collected/removed powerups
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