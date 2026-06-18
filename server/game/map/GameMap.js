export default class GameMap {
    constructor(seed = 1) {
        this.width = 15;
        this.height = 13;
        this.seed = GameMap.hashSeed(seed);
        this.grid = this.generateGrid();
    }

    generateGrid() {
        const rows = [];

        for (let y = 0; y < this.height; y += 1) {
            let row = "";

            for (let x = 0; x < this.width; x += 1) {
                row += this.getTileSymbol(x, y);
            }

            rows.push(row);
        }

        return rows;
    }

    getTileSymbol(x, y) {
        if (this.isBorder(x, y)) {
            return "W";
        }

        if (this.isSpawnZone(x, y)) {
            return ".";
        }

        if (this.isInnerPillar(x, y)) {
            return "W";
        }

        if (this.shouldPlaceBlock(x, y)) {
            return "B";
        }

        return ".";
    }

    isBorder(x, y) {
        return x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
    }
// keep each corner's 3x3 area clear so player alwayes have room to start 
    isSpawnZone(x, y) {
        return (
            (x <= 2 && y <= 2) ||
            (x >= this.width - 3 && y <= 2) ||
            (x <= 2 && y >= this.height - 3) ||
            (x >= this.width - 3 && y >= this.height - 3)
        );
    }

    isInnerPillar(x, y) {
        return x % 2 === 0 && y % 2 === 0;
    }

    shouldPlaceBlock(x, y) {
        if (x % 2 !== 0 || y % 2 !== 1) {
            return false;
        }

        return GameMap.cellNoise(this.seed, x, y) < 0.7;
    }

    getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return "W";
        }

        return this.grid[y][x];
    }

    blockDead(x, y) {
        if (this.getTile(x, y) === "B") {
            this.grid[y][x] = "."
        }
    }
    
    isDestructible(x, y) {
        return this.getTile(x, y) === "B"
    }

    isWalkable(x, y) {
        return this.getTile(x, y) === "."
    }
    static hashSeed(seed) {
        const text = String(seed);
        let hash = 2166136261;

        for (const character of text) {
            hash ^= character.codePointAt(0);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }

    static cellNoise(seed, x, y) {
        let value = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
    }
}
