"use client";

import { useEffect, useRef } from "react";

const VIEWPORT_WIDTH = 512;
const VIEWPORT_HEIGHT = 384;

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let destroyed = false;

    Promise.all([import("phaser"), import("./scenes/MainScene")]).then(
      ([{ default: Phaser }, { MainScene }]) => {
        if (destroyed || !containerRef.current) return;

        gameRef.current = new Phaser.Game({
          type: Phaser.AUTO,
          parent: containerRef.current,
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          pixelArt: true,
          backgroundColor: "#1e222b",
          physics: { default: "arcade" },
          scene: [MainScene],
        });
      }
    );

    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="inline-block" />;
}
