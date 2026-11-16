import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export interface KingdomSceneProps {
  restored?: boolean;
  reducedMotion?: boolean;
  variant?: 'garden' | 'night' | 'crystal';
  compact?: boolean;
}

/** Decorative Phaser world; the note cards and every essential action live in accessible DOM. */
export default function KingdomScene({ restored = false, reducedMotion = false, variant = 'garden', compact = false }: KingdomSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    class TonterraScene extends Phaser.Scene {
      constructor() { super('tonterra'); }
      create() {
        const graphics = this.add.graphics();
        const night = variant === 'night';
        const mint = night ? 0x6caeac : 0x91c9b7;
        const grass = night ? 0x8dc5c1 : 0xb9e2cb;
        const navy = 0x253b4b;
        const lavender = variant === 'crystal' ? 0x8e85d2 : 0xb5a4df;
        const polygon = (points: number[], color: number, alpha = 1) => {
          graphics.fillStyle(color, alpha);
          graphics.fillPoints(points.reduce<Phaser.Geom.Point[]>((out, n, i) => { if (i % 2 === 0) out.push(new Phaser.Geom.Point(n, points[i + 1])); return out; }, []), true);
        };
        // Long peach cloud wisps keep the silhouette airy.
        graphics.fillStyle(0xf4d9cb, night ? 0.2 : 0.7);
        [[87, 94, 98, 15], [417, 94, 122, 18], [373, 42, 63, 10], [93, 165, 50, 8]].forEach(([x, y, w, h]) => graphics.fillEllipse(x, y, w, h));
        graphics.fillStyle(0xd6e2da, 0.5);
        graphics.fillEllipse(260, 269, 274, 18);
        // Floating island and individually lit rock facets.
        polygon([92, 168, 175, 145, 332, 143, 435, 169, 403, 203, 337, 228, 259, 256, 187, 231, 122, 211], mint);
        polygon([92, 168, 151, 183, 187, 231, 122, 211], 0x6ba997);
        polygon([151, 183, 239, 194, 259, 256, 187, 231], 0x80bca8);
        polygon([239, 194, 326, 184, 337, 228, 259, 256], 0x659e93);
        polygon([326, 184, 435, 169, 403, 203, 337, 228], 0x76afa0);
        polygon([92, 165, 159, 141, 237, 137, 334, 141, 435, 165, 394, 183, 259, 198, 151, 183], grass);
        graphics.lineStyle(2, 0xe0f3df, 0.9);
        graphics.lineBetween(153, 179, 239, 192);
        graphics.lineBetween(337, 180, 395, 172);
        // Stone path and courtyard.
        graphics.fillStyle(0xe8e0c9);
        graphics.fillEllipse(272, 158, 100, 21);
        polygon([257, 163, 282, 163, 325, 183, 305, 187], 0xe8e0c9);
        graphics.lineStyle(1, 0xc3cdb8);
        [[268, 168, 287, 168], [278, 174, 300, 174], [290, 180, 312, 180]].forEach(([x1, y1, x2, y2]) => graphics.lineBetween(x1, y1, x2, y2));
        // Castle: two towers, inset stone, crenellations and delicate windows.
        graphics.fillStyle(navy);
        graphics.fillRoundedRect(228, 88, 75, 71, 3);
        graphics.fillRect(221, 81, 18, 77);
        graphics.fillRect(292, 73, 19, 85);
        [219, 227, 235].forEach(x => graphics.fillRect(x, 74, 5, 12));
        [290, 298, 306].forEach(x => graphics.fillRect(x, 66, 5, 12));
        polygon([218, 75, 230, 55, 242, 75], lavender);
        polygon([287, 66, 301, 43, 315, 66], lavender);
        graphics.fillStyle(0x3a5261);
        graphics.fillRect(241, 92, 45, 64);
        graphics.fillStyle(0xe8e7d8);
        graphics.fillRoundedRect(254, 129, 18, 28, { tl: 9, tr: 9, bl: 0, br: 0 });
        graphics.fillStyle(restored ? 0xf8e6a6 : 0xb8dbcb);
        [231, 300].forEach((x, i) => { graphics.fillRoundedRect(x - 3, i ? 86 : 98, 6, 13, 3); });
        graphics.fillRoundedRect(258, 100, 10, 15, 5);
        graphics.lineStyle(1, 0x657686);
        [[241, 120, 253, 120], [275, 138, 286, 138], [242, 145, 249, 145], [279, 108, 286, 108]].forEach(([a, b, c, d]) => graphics.lineBetween(a, b, c, d));
        // Flag.
        graphics.lineStyle(2, navy);
        graphics.lineBetween(301, 43, 301, 22);
        polygon([302, 22, 322, 27, 302, 33], 0xdba599);
        // Tiny garden gate and lantern.
        graphics.fillStyle(0x3d675a);
        graphics.fillRect(147, 135, 5, 25); graphics.fillRect(173, 135, 5, 25);
        graphics.lineStyle(4, 0x3d675a); graphics.strokeEllipse(162, 140, 31, 30);
        graphics.fillStyle(grass); graphics.fillRect(149, 146, 26, 15);
        graphics.lineStyle(2, 0x3d675a); graphics.lineBetween(147, 145, 177, 145);
        // Sprouting bushes and unmistakable crystal clusters.
        const bush = (x: number, y: number, size: number) => {
          graphics.fillStyle(0x6cae92); graphics.fillEllipse(x, y, size * 1.6, size);
          graphics.fillStyle(0x92c6a8); graphics.fillCircle(x - size * 0.35, y - size * 0.3, size * 0.45); graphics.fillCircle(x + size * 0.3, y - size * 0.3, size * 0.5);
        };
        [[125, 164, 14], [367, 161, 17], [346, 146, 9], [200, 159, 10]].forEach(([x, y, s]) => bush(x, y, s));
        [[191, 138, 11], [355, 182, 12], [379, 153, 9]].forEach(([x, y, size]) => {
          polygon([x, y - size * 2, x + size * 0.6, y - size, x + size * 0.4, y, x - size * 0.5, y], lavender);
          polygon([x, y - size * 2, x, y, x - size * 0.5, y], 0x9380c5);
          graphics.lineStyle(1, 0xdad0ec); graphics.lineBetween(x, y - size * 2, x + size * 0.6, y - size);
        });
        // The seven-note core floats above the castle.
        const core = this.add.container(266, 60);
        const halo = this.add.graphics();
        halo.fillStyle(0xb8a6e7, restored ? 0.2 : 0.1); halo.fillCircle(0, 0, 29);
        halo.lineStyle(1, 0xb6a4d5, 0.6); halo.strokeCircle(0, 0, 24);
        halo.fillStyle(restored ? 0xd9b76c : 0xa996ce); halo.fillPoints([{ x: 0, y: -18 }, { x: 11, y: 0 }, { x: 0, y: 18 }, { x: -11, y: 0 }], true);
        halo.fillStyle(restored ? 0xffe7aa : 0xd6c9ee); halo.fillPoints([{ x: 0, y: -18 }, { x: 11, y: 0 }, { x: 0, y: 5 }], true);
        core.add(halo);
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2;
          const mote = this.add.circle(266 + Math.cos(angle) * 37, 60 + Math.sin(angle) * 27, 2, i % 2 ? 0xbaa5de : 0xe4c68d, 0.9);
          if (!reducedMotion) this.tweens.add({ targets: mote, alpha: 0.25, duration: 1100 + i * 90, yoyo: true, repeat: -1 });
        }
        if (!reducedMotion) this.tweens.add({ targets: core, y: 54, duration: 2100, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
        // Small fireflies and botanicals have no interaction targets.
        [[114, 123], [399, 132], [329, 88], [181, 91], [374, 71]].forEach(([x, y], i) => {
          const star = this.add.star(x, y, 4, 1.8, 4, i % 2 ? 0xc7afdc : 0xd7b875, 0.9);
          if (!reducedMotion) this.tweens.add({ targets: star, alpha: 0.35, duration: 1600 + i * 100, repeat: -1, yoyo: true });
        });
        graphics.lineStyle(1.5, 0x508c73);
        [[213, 176], [334, 165], [141, 172]].forEach(([x, y]) => { graphics.lineBetween(x, y, x, y - 8); graphics.lineBetween(x, y - 4, x - 4, y - 7); graphics.lineBetween(x, y - 2, x + 4, y - 5); });
        graphics.fillStyle(0xe7b9a4);
        [[215, 167], [333, 156], [140, 164]].forEach(([x, y]) => graphics.fillCircle(x, y, 2.5));
      }
    }
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: 520,
      height: 285,
      transparent: true,
      scene: TonterraScene,
      render: { antialias: true, pixelArt: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      fps: { target: reducedMotion ? 15 : 30, forceSetTimeOut: true },
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      banner: false,
    });
    return () => { game.destroy(true); };
  }, [restored, reducedMotion, variant]);
  return <div className={`kingdom-scene${compact ? ' compact' : ''}`} ref={host} aria-hidden="true" style={{ width: '100%', height: compact ? 180 : 270, pointerEvents: 'none' }} />;
}
