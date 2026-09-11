import Phaser from "phaser";
import { loadSave, writeSave } from "../save";
import { GRID_WIDTH, GRID_HEIGHT, TILE_WIDTH, TILE_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, tileToWorld } from "../iso";

// Screen-space speed (px/sec). Diagonal input is normalized below so 8-direction
// movement covers this same screen distance per second regardless of angle —
// without normalizing, a diagonal (both axes held) would move at sqrt(2)x speed.
const PLAYER_SPEED = 220;
const SAVE_INTERVAL_MS = 500;

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private tileX = 8;
  private tileY = 6;
  private wasMoving = false;
  private msSinceLastSave = 0;

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

  update(_time: number, delta: number) {
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    let screenDX = 0;
    let screenDY = 0;
    if (right) screenDX += 1;
    if (left) screenDX -= 1;
    if (down) screenDY += 1;
    if (up) screenDY -= 1;

    const isMoving = screenDX !== 0 || screenDY !== 0;

    if (isMoving) {
      // Normalize (Pythagorean) so a diagonal (magnitude sqrt(2)) doesn't outrun a
      // cardinal move (magnitude 1) — both cover PLAYER_SPEED px/sec on screen.
      const magnitude = Math.hypot(screenDX, screenDY);
      const distance = PLAYER_SPEED * (delta / 1000);
      const dx = (screenDX / magnitude) * distance;
      const dy = (screenDY / magnitude) * distance;

      // Screen space -> iso grid space (inverse of tileToWorld's projection).
      const dGridX = dx / TILE_WIDTH + dy / TILE_HEIGHT;
      const dGridY = dy / TILE_HEIGHT - dx / TILE_WIDTH;

      this.tileX = Phaser.Math.Clamp(this.tileX + dGridX, 0, GRID_WIDTH - 1);
      this.tileY = Phaser.Math.Clamp(this.tileY + dGridY, 0, GRID_HEIGHT - 1);
      this.setPlayerPosition(this.tileX, this.tileY);

      this.msSinceLastSave += delta;
      if (this.msSinceLastSave >= SAVE_INTERVAL_MS) {
        writeSave({ tileX: this.tileX, tileY: this.tileY });
        this.msSinceLastSave = 0;
      }
      this.wasMoving = true;
    } else if (this.wasMoving) {
      writeSave({ tileX: this.tileX, tileY: this.tileY });
      this.msSinceLastSave = 0;
      this.wasMoving = false;
    }
  }
}
