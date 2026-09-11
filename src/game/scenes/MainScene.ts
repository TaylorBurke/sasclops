import Phaser from "phaser";
import { loadSave, writeSave } from "../save";

const TILE_SIZE = 32;
const GRID_WIDTH = 16;
const GRID_HEIGHT = 12;
const MOVE_DURATION_MS = 120;

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
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

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const isDark = (x + y) % 2 === 0;
        this.add
          .rectangle(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            isDark ? 0x2f3542 : 0x3a4152
          )
          .setStrokeStyle(1, 0x1e222b);
      }
    }

    this.player = this.add.rectangle(
      this.tileX * TILE_SIZE + TILE_SIZE / 2,
      this.tileY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE * 0.7,
      TILE_SIZE * 0.7,
      0xffd166
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.cameras.main.setBounds(0, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true);
  }

  update() {
    if (this.isMoving) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.up.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const nextX = Phaser.Math.Clamp(this.tileX + dx, 0, GRID_WIDTH - 1);
    const nextY = Phaser.Math.Clamp(this.tileY + dy, 0, GRID_HEIGHT - 1);
    if (nextX === this.tileX && nextY === this.tileY) return;

    this.tileX = nextX;
    this.tileY = nextY;
    this.isMoving = true;

    this.tweens.add({
      targets: this.player,
      x: this.tileX * TILE_SIZE + TILE_SIZE / 2,
      y: this.tileY * TILE_SIZE + TILE_SIZE / 2,
      duration: MOVE_DURATION_MS,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        writeSave({ tileX: this.tileX, tileY: this.tileY });
      },
    });
  }
}

export const GRID_PIXEL_WIDTH = GRID_WIDTH * TILE_SIZE;
export const GRID_PIXEL_HEIGHT = GRID_HEIGHT * TILE_SIZE;
