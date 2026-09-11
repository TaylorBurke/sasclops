import Phaser from "phaser";
import { loadSave, writeSave } from "../save";
import { GRID_WIDTH, GRID_HEIGHT, TILE_WIDTH, TILE_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, tileToWorld } from "../iso";

const MOVE_DURATION_MS = 120;

// Screen-relative movement: pressing "up" moves the player up the screen,
// even though that maps to a diagonal step in the underlying iso grid.
const DIRECTIONS = {
  up: { dx: -1, dy: -1 },
  down: { dx: 1, dy: 1 },
  left: { dx: -1, dy: 1 },
  right: { dx: 1, dy: -1 },
} as const;

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<keyof typeof DIRECTIONS, Phaser.Input.Keyboard.Key>;
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
    this.setPlayerPosition(this.tileX, this.tileY, this.player);

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

  private setPlayerPosition(gridX: number, gridY: number, target: Phaser.GameObjects.Container) {
    const { x, y } = tileToWorld(gridX, gridY);
    target.setPosition(x, y);
    target.setDepth(gridX + gridY);
  }

  update() {
    if (this.isMoving) return;

    let direction: keyof typeof DIRECTIONS | null = null;
    if (this.cursors.left.isDown || this.wasd.left.isDown) direction = "left";
    else if (this.cursors.right.isDown || this.wasd.right.isDown) direction = "right";
    else if (this.cursors.up.isDown || this.wasd.up.isDown) direction = "up";
    else if (this.cursors.down.isDown || this.wasd.down.isDown) direction = "down";

    if (!direction) return;

    const { dx, dy } = DIRECTIONS[direction];
    const nextX = Phaser.Math.Clamp(this.tileX + dx, 0, GRID_WIDTH - 1);
    const nextY = Phaser.Math.Clamp(this.tileY + dy, 0, GRID_HEIGHT - 1);
    if (nextX === this.tileX && nextY === this.tileY) return;

    this.tileX = nextX;
    this.tileY = nextY;
    this.isMoving = true;

    const { x, y } = tileToWorld(this.tileX, this.tileY);
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: MOVE_DURATION_MS,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.player.setDepth(this.tileX + this.tileY);
        writeSave({ tileX: this.tileX, tileY: this.tileY });
      },
    });
  }
}
