import { useEffect, useRef } from "react";
import type PhaserType from "phaser";
import type { SessionState } from "./types";

export function Arena({ state, className = "" }: { state: SessionState | null; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Phaser.Scene | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let canceled = false;
    let game: PhaserType.Game | null = null;
    if (!host.current) return;
    void import("phaser").then(({ default: Phaser }) => {
      if (canceled || !host.current) return;
    class RaidScene extends Phaser.Scene {
      private boss!: Phaser.GameObjects.Container;
      private bossArt!: Phaser.GameObjects.Container;
      private fighters: Phaser.GameObjects.Container[] = [];
      private stars!: Phaser.GameObjects.Graphics;

      constructor() {
        super("raid");
      }

      create() {
        sceneRef.current = this;
        this.stars = this.add.graphics();
        this.boss = this.add.container(0, 0);
        this.bossArt = this.add.container(0, 0);
        const body = this.add.ellipse(0, 5, 164, 142, 0xb891ff).setStrokeStyle(4, 0xe8d9ff, 0.95);
        const shade = this.add.ellipse(0, 36, 118, 70, 0x704bd1, 0.3);
        const hornLeft = this.add.triangle(-53, -47, -17, 24, 19, 16, 0xe6d9ff);
        const hornRight = this.add.triangle(53, -47, -19, 24, 17, 16, 0xe6d9ff);
        const eyeLeft = this.add.ellipse(-28, -8, 19, 25, 0x2e1c5b);
        const eyeRight = this.add.ellipse(28, -8, 19, 25, 0x2e1c5b);
        const shineLeft = this.add.circle(-31, -14, 3, 0xffffff);
        const shineRight = this.add.circle(25, -14, 3, 0xffffff);
        const mouth = this.add.arc(0, 29, 15, 190, 350, false, 0x442879).setStrokeStyle(4, 0x442879);
        this.bossArt.add([body, shade, hornLeft, hornRight, eyeLeft, eyeRight, shineLeft, shineRight, mouth]);
        this.boss.add(this.bossArt);
        this.tweens.add({ targets: this.bossArt, y: { from: -6, to: 6 }, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.InOut" });

        const palette = [0xffc66d, 0x7fe0d1, 0xff91ad, 0x99b7ff, 0xffa66e, 0x9ee889, 0xd5a1ff, 0xffdf8a];
        this.fighters = palette.map((color, index) => {
          const fighter = this.add.container(0, 0);
          const legs = this.add.ellipse(0, 10, 19, 24, color);
          const face = this.add.circle(0, -7, 10, color).setStrokeStyle(2, 0xffffff, 0.8);
          const visor = this.add.rectangle(0, -8, 11, 3, 0x38285f);
          fighter.add([legs, face, visor]);
          this.tweens.add({ targets: fighter, y: { from: -2, to: 3 + (index % 3) * 2 }, duration: 380 + index * 90, yoyo: true, repeat: -1, ease: "Sine.InOut" });
          return fighter;
        });
        this.layout();
        this.scale.on("resize", this.layout, this);
        this.time.addEvent({ delay: 2500, loop: true, callback: () => this.pulse() });
      }

      private layout = () => {
        const width = this.scale.width;
        const height = this.scale.height;
        const centerX = width * 0.52;
        this.boss.setPosition(centerX, height * 0.48);
        this.boss.setScale(Math.max(0.62, Math.min(1, width / 900)));
        const count = Math.min(this.fighters.length, Math.max(4, Math.min(8, stateRef.current?.playerCount ?? 4)));
        this.fighters.forEach((fighter, index) => {
          fighter.setVisible(index < count);
          const step = width / (count + 1);
          fighter.setPosition(step * (index + 1), height * 0.78);
          fighter.setScale(Math.max(0.72, Math.min(1, width / 800)));
        });
        this.stars.clear();
        for (let i = 0; i < 35; i += 1) {
          const x = ((i * 137) % Math.max(1, width));
          const y = ((i * 71) % Math.max(1, height * 0.7));
          const alpha = 0.2 + ((i * 17) % 60) / 100;
          this.stars.fillStyle(0xffffff, alpha);
          this.stars.fillCircle(x, y, i % 5 === 0 ? 1.8 : 1);
        }
      };

      private pulse() {
        if (!this.boss || !this.boss.active) return;
        const x = this.boss.x + Phaser.Math.Between(-45, 45);
        const y = this.boss.y + Phaser.Math.Between(-30, 28);
        const spark = this.add.star(x, y, 4, 3, 8, 0xe5d4ff).setAlpha(0.95);
        this.tweens.add({ targets: spark, y: y - 35, alpha: 0, scale: 0.3, duration: 820, onComplete: () => spark.destroy() });
      }

      shutdown() {
        this.scale.off("resize", this.layout, this);
        sceneRef.current = null;
      }
    }

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 960,
      height: 450,
      transparent: true,
      antialias: true,
      scene: RaidScene,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { powerPreference: "high-performance" },
    });
    });
    return () => {
      canceled = true;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.game.scale.refresh();
  }, [state?.playerCount]);

  return <div className={`arena ${className}`} ref={host} aria-label="Jeu 2D : boss violet face aux joueurs" role="img" />;
}
