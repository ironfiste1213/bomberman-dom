import { PLAYER_COLORS } from "../shared/constants.js";

// Module-level game engine — lives entirely outside the component tree.
// Started once when the server sends game:start.
export const engine = {
  gameState: null,
  map: [],
  rafId: null,
  playerElems: {},
  inputBound: false,
  sendInput: null,

  start({ map, sendInput }) {
    this.map = map || [];
    this.sendInput = typeof sendInput === "function" ? sendInput : null;
    this.playerElems = {};
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
    this.playerElems = {};
    this.sendInput = null;
  },

  _startInput() {
    if (this.inputBound) return;
    this.inputBound = true;

    const keys = { up: false, down: false, left: false, right: false };
    const KEY_MAP = {
      ArrowUp: "up", w: "up",
      ArrowDown: "down", s: "down",
      ArrowLeft: "left", a: "left",
      ArrowRight: "right", d: "right"
    };

    const push = () => {
      if (!this.sendInput) return;
      this.sendInput({ ...keys });
    };

    window.addEventListener("keydown", (e) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      if (keys[dir]) return;
      keys[dir] = true;
      push();
    });

    window.addEventListener("keyup", (e) => {
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

        for (const p of state.players) {
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
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
};