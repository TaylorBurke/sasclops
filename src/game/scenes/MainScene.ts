import Phaser from "phaser";
import { loadSave, writeSave } from "../save";
import { GRID_WIDTH, GRID_HEIGHT, TILE_WIDTH, TILE_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, tileToWorld } from "../iso";

// Screen-space speed (px/sec) used to derive each step's tween duration, so a
// step is only ever "instant" relative to how far it actually moves on screen.
const PLAYER_SPEED = 220;

// Input is read as screen-relative axes: right-left and down-up, each in
// {-1, 0, 1}. That gives 8 possible non-zero combinations (arrow keys held
// together produce the diagonals, e.g. Up+Left), and each maps to exactly one
// of the 8 neighbors on the iso grid, so the player always snaps cleanly from
// tile to tile — never a fractional tile position.
const DIRECTION_TO_GRID_STEP: Record<string, { dx: number; dy: number }> = {
  "0,-1": { dx: -1, dy: -1 }, // up
  "0,1": { dx: 1, dy: 1 }, // down
  "-1,0": { dx: -1, dy: 1 }, // left
  "1,0": { dx: 1, dy: -1 }, // right
  "1,-1": { dx: 0, dy: -1 }, // up + right
  "-1,-1": { dx: -1, dy: 0 }, // up + left
  "1,1": { dx: 1, dy: 0 }, // down + right
  "-1,1": { dx: 0, dy: 1 }, // down + left
};

function stepDurationMs(gridDx: number, gridDy: number): number {
  const screenDx = (gridDx - gridDy) * (TILE_WIDTH / 2);
  const screenDy = (gridDx + gridDy) * (TILE_HEIGHT / 2);
  const distance = Math.hypot(screenDx, screenDy);
  return (distance / PLAYER_SPEED) * 1000;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private tileX = 8;
  private tileY = 6;
  private isMoving = false;

  constructor() {
    super("main");
  }

  create() {
    const saved = loadSave();
    if (saved) {
      this.tileX = saved.tileX;
      this.tileY = saved.tileY;
    }

    this.drawTiles();
    this.player = this.createPlayer();
    this.setPlayerPosition(this.tileX, this.tileY);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true);
  }

  private drawTiles() {
    const graphics = this.add.graphics();
    for (let gy = 0; gy < GRID_HEIGHT; gy++) {
      for (let gx = 0; gx < GRID_WIDTH; gx++) {
        const { x, y } = tileToWorld(gx, gy);
        const isDark = (gx + gy) % 2 === 0;
        graphics.fillStyle(isDark ? 0x2f3542 : 0x3a4152, 1);
        graphics.lineStyle(1, 0x1e222b, 1);
        graphics.beginPath();
        graphics.moveTo(x, y - TILE_HEIGHT / 2);
        graphics.lineTo(x + TILE_WIDTH / 2, y);
        graphics.lineTo(x, y + TILE_HEIGHT / 2);
        graphics.lineTo(x - TILE_WIDTH / 2, y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }
  }

  private createPlayer(): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 4, TILE_WIDTH * 0.4, TILE_HEIGHT * 0.4, 0x000000, 0.35);
    const body = this.add.ellipse(0, -TILE_HEIGHT * 0.6, TILE_WIDTH * 0.32, TILE_HEIGHT * 0.8, 0xffd166);
    return this.add.container(0, 0, [shadow, body]);
  }

  private setPlayerPosition(gridX: number, gridY: number) {
    const { x, y } = tileToWorld(gridX, gridY);
    this.player.setPosition(x, y);
    this.player.setDepth(gridX + gridY);
  }

  update() {
    if (this.isMoving) return;

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    const screenDX = (right ? 1 : 0) - (left ? 1 : 0);
    const screenDY = (down ? 1 : 0) - (up ? 1 : 0);
    if (screenDX === 0 && screenDY === 0) return;

    const step = DIRECTION_TO_GRID_STEP[`${screenDX},${screenDY}`];
    const nextX = Phaser.Math.Clamp(this.tileX + step.dx, 0, GRID_WIDTH - 1);
    const nextY = Phaser.Math.Clamp(this.tileY + step.dy, 0, GRID_HEIGHT - 1);
    if (nextX === this.tileX && nextY === this.tileY) return;

    const appliedDx = nextX - this.tileX;
    const appliedDy = nextY - this.tileY;
    this.tileX = nextX;
    this.tileY = nextY;
    this.isMoving = true;

    const { x, y } = tileToWorld(this.tileX, this.tileY);
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: stepDurationMs(appliedDx, appliedDy),
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.player.setDepth(this.tileX + this.tileY);
        writeSave({ tileX: this.tileX, tileY: this.tileY });
      },
    });
  }
}
