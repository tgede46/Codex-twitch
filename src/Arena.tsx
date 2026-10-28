import { useEffect, useRef } from "react";
import type PhaserType from "phaser";
import type { GameId, SessionState } from "./types";

type ArenaSceneRef = PhaserType.Scene & { sync?: () => void };
const gameColors = [0x8f68e8, 0xf16da5, 0x54a6f0, 0x48c79b];

export function Arena({ state, className = "" }: { state: SessionState | null; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ArenaSceneRef | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let canceled = false;
    let game: PhaserType.Game | null = null;
    if (!host.current) return;
    void import("phaser").then(({ default: Phaser }) => {
      if (canceled || !host.current) return;

      class CrowdScene extends Phaser.Scene {
        private boss!: Phaser.GameObjects.Container;
        private bossArt!: Phaser.GameObjects.Container;
        private fighters: Phaser.GameObjects.Container[] = [];
        private stars!: Phaser.GameObjects.Graphics;
        private board!: Phaser.GameObjects.Container;
        private boardKey = "";

        constructor() { super("crowd-game"); }

        create() {
          sceneRef.current = this;
          this.stars = this.add.graphics();
          this.board = this.add.container(0, 0);
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
            fighter.add([this.add.ellipse(0, 10, 19, 24, color), this.add.circle(0, -7, 10, color).setStrokeStyle(2, 0xffffff, 0.8), this.add.rectangle(0, -8, 11, 3, 0x38285f)]);
            this.tweens.add({ targets: fighter, y: { from: -2, to: 3 + (index % 3) * 2 }, duration: 380 + index * 90, yoyo: true, repeat: -1, ease: "Sine.InOut" });
            this.boss.add(fighter);
            return fighter;
          });
          this.layout();
          this.scale.on("resize", this.resize, this);
          this.time.addEvent({ delay: 2500, loop: true, callback: () => this.pulse() });
          (this as ArenaSceneRef).sync = () => this.renderFromState();
          this.renderFromState();
        }

        private layout = () => {
          const width = this.scale.width;
          const height = this.scale.height;
          this.boss.setPosition(width * 0.52, height * 0.48);
          this.boss.setScale(Math.max(0.62, Math.min(1, width / 900)));
          const count = Math.min(this.fighters.length, Math.max(4, Math.min(8, stateRef.current?.playerCount ?? 4)));
          this.fighters.forEach((fighter, index) => {
            fighter.setVisible(index < count);
            fighter.setPosition(width / (count + 1) * (index + 1), height * 0.78);
            fighter.setScale(Math.max(0.72, Math.min(1, width / 800)));
          });
          this.stars.clear();
          for (let i = 0; i < 40; i += 1) {
            this.stars.fillStyle(0xffffff, 0.18 + ((i * 17) % 60) / 100);
            this.stars.fillCircle((i * 137) % Math.max(1, width), (i * 71) % Math.max(1, height), i % 5 === 0 ? 1.8 : 1);
          }
          this.board.setPosition(width / 2, height / 2);
        };

        private resize = () => {
          this.layout();
          if (stateRef.current?.gameId && stateRef.current.gameId !== "boss") {
            this.boardKey = "";
            this.renderFromState();
          }
        };

        private renderFromState() {
          const state = stateRef.current;
          const gameId: GameId = state?.gameId ?? "boss";
          this.boss.setVisible(gameId === "boss");
          this.board.setVisible(gameId !== "boss");
          this.fighters.forEach((fighter) => fighter.setVisible(gameId === "boss" && fighter.visible));
          if (gameId === "boss") {
            this.layout();
            return;
          }
          const key = `${gameId}|${state?.prompt}|${state?.target}|${state?.options.join(",")}`;
          if (key === this.boardKey) return;
          this.boardKey = key;
          this.drawMiniGame(gameId, state);
        }

        private drawMiniGame(gameId: GameId, state: SessionState | null) {
          this.board.removeAll(true);
          this.board.add(this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x291956, 0.97));
          for (let i = 0; i < 34; i += 1) this.board.add(this.add.circle((i * 127) % this.scale.width - this.scale.width / 2, (i * 71) % this.scale.height - this.scale.height / 2, i % 4 === 0 ? 2 : 1, 0xffffff, 0.3));
          const addText = (x: number, y: number, text: string, size: string, color = "#ffffff", weight = "700") => this.board.add(this.add.text(x, y, text, { fontFamily: "Inter, Arial, sans-serif", fontSize: size, color, fontStyle: weight, align: "center", wordWrap: { width: this.scale.width * 0.82 } }).setOrigin(0.5));
          const title = gameId === "quiz" ? "SPEED QUIZ SHOW" : gameId === "jump" ? "PIXEL JUMP ROYALE" : gameId === "marble" ? "MARBLE FALL 2D" : "ARENA ROYALE 2D";
          addText(0, -this.scale.height * 0.36, title, "15px", "#d4c3ff", "800");

          if (gameId === "quiz") {
            addText(0, -this.scale.height * 0.21, state?.prompt ?? "La question arrive…", "23px");
            (state?.options ?? []).forEach((option, index) => {
              const x = index % 2 === 0 ? -this.scale.width * 0.2 : this.scale.width * 0.2;
              const y = this.scale.height * 0.02 + Math.floor(index / 2) * 72;
              this.board.add(this.add.rectangle(x, y, this.scale.width * 0.36, 52, 0x6946b2, 1).setStrokeStyle(2, 0xbda3ff, 0.8));
              addText(x, y, `${index + 1}. ${option}`, "18px");
            });
          } else if (gameId === "jump") {
            const groundY = this.scale.height * 0.29;
            this.board.add(this.add.rectangle(0, groundY + 12, this.scale.width, 34, 0x54d6aa));
            this.board.add(this.add.rectangle(0, groundY + 31, this.scale.width, 45, 0x3b276f));
            for (let i = 0; i < 8; i += 1) {
              const x = -this.scale.width * 0.42 + i * this.scale.width * 0.12;
              const color = gameColors[i % gameColors.length];
              const runner = this.add.container(x, state?.target === "Obstacle" ? groundY - 42 : groundY - 10);
              runner.add([this.add.rectangle(0, 0, 19, 20, color), this.add.rectangle(0, -15, 15, 13, 0xffdbad), this.add.rectangle(5, -17, 3, 3, 0x38285f)]);
              this.board.add(runner);
              if (state?.status === "live") this.tweens.add({ targets: runner, y: runner.y - (state?.target === "Obstacle" ? 4 : 1), duration: 320, yoyo: true, repeat: -1, delay: i * 70 });
            }
            if (state?.target === "Obstacle") {
              for (let i = 0; i < 5; i += 1) this.board.add(this.add.triangle(this.scale.width * 0.15 + i * 24, groundY - 15, 0, 0, 21, 0, 10, -29, 0xff866e));
              addText(0, -this.scale.height * 0.15, "SAUTEZ !", "27px", "#ffe293", "800");
            } else addText(0, -this.scale.height * 0.15, "COURSE LIBRE · PRÉPAREZ-VOUS", "17px");
          } else if (gameId === "marble") {
            const laneWidth = this.scale.width * 0.54;
            for (let row = 0; row < 5; row += 1) {
              const y = -this.scale.height * 0.2 + row * 53;
              const offset = row % 2 === 0 ? -36 : 36;
              this.board.add(this.add.rectangle(offset, y, laneWidth, 6, 0xb99cff, 0.85));
              for (let pin = 0; pin < 7; pin += 1) this.board.add(this.add.circle(offset - laneWidth / 2 + 20 + pin * (laneWidth - 40) / 6, y + 18, 5, 0xf6d48e));
            }
            const marbles = Array.from({ length: 8 }, (_, i) => this.add.circle(-this.scale.width * 0.3 + i * 80, -this.scale.height * 0.3 - Phaser.Math.Between(0, 40), 10, gameColors[i % gameColors.length]).setStrokeStyle(2, 0xffffff));
            marbles.forEach((marble, i) => {
              this.board.add(marble);
              if (state?.status === "live") this.tweens.add({ targets: marble, y: this.scale.height * 0.29, x: marble.x + (state?.target === "Droite" ? 35 : -35), duration: 2100 + i * 190, delay: i * 120, repeat: -1, yoyo: false });
            });
            addText(0, -this.scale.height * 0.38, `BILLES EN COURSE · VIRAGE ${state?.target?.toUpperCase() ?? "…"}`, "16px");
          } else if (gameId === "arena") {
            this.board.add(this.add.ellipse(0, 30, this.scale.width * 0.52, this.scale.height * 0.7, 0x9b72e9, 0.18).setStrokeStyle(8, 0xd5c5ff, 0.9));
            this.board.add(this.add.ellipse(0, 30, this.scale.width * 0.39, this.scale.height * 0.5, 0x2c1d59, 0.75).setStrokeStyle(2, 0x9673d4, 0.8));
            for (let i = 0; i < 12; i += 1) {
              const angle = Math.PI * 2 * i / 12;
              const x = Math.cos(angle) * this.scale.width * 0.2;
              const y = 30 + Math.sin(angle) * this.scale.height * 0.23;
              const avatar = this.add.container(x, y);
              avatar.add([this.add.circle(0, 0, 12, gameColors[i % gameColors.length]).setStrokeStyle(2, 0xffffff), this.add.rectangle(3, -2, 3, 3, 0x312050)]);
              this.board.add(avatar);
              if (state?.status === "live") this.tweens.add({ targets: avatar, x: x + (i % 2 === 0 ? 11 : -11), duration: 500 + i * 60, yoyo: true, repeat: -1 });
            }
            addText(0, -this.scale.height * 0.38, "POUSSEZ LE PELOTON HORS DU RING", "16px");
            addText(0, this.scale.height * 0.34, state?.target?.toUpperCase() ?? "PRÊT", "15px", "#ffe293", "800");
          }
          this.layout();
        }

        private pulse() {
          if (!this.boss || !this.boss.active || !this.boss.visible) return;
          const spark = this.add.star(this.boss.x + Phaser.Math.Between(-45, 45), this.boss.y + Phaser.Math.Between(-30, 28), 4, 3, 8, 0xe5d4ff).setAlpha(0.95);
          this.tweens.add({ targets: spark, y: spark.y - 35, alpha: 0, scale: 0.3, duration: 820, onComplete: () => spark.destroy() });
        }

        shutdown() {
          this.scale.off("resize", this.resize, this);
          sceneRef.current = null;
        }
      }

      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 960, height: 450, transparent: true, antialias: true, scene: CrowdScene, scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { powerPreference: "high-performance" } });
    });
    return () => { canceled = true; sceneRef.current = null; game?.destroy(true); };
  }, []);

  useEffect(() => {
    sceneRef.current?.sync?.();
    sceneRef.current?.game.scale.refresh();
  }, [state?.gameId, state?.playerCount, state?.prompt, state?.target, state?.options]);

  return <div className={`arena ${className}`} ref={host} aria-label={`Jeu 2D ${state?.gameId ?? "Boss Raid"}`} role="img" />;
}
