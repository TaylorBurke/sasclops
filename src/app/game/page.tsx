import PhaserGame from "@/game/PhaserGame";

export default function GamePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-8">
      <h1 className="text-xl font-semibold text-neutral-100">sasclops</h1>
      <PhaserGame />
      <p className="text-sm text-neutral-400">Arrow keys / WASD to move. Progress saves automatically.</p>
    </main>
  );
}
