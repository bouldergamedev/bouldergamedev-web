import { WIDTH, HEIGHT, HAND_Y, CHECKPOINT, SUMMIT, getLedges, type Climber } from './physics';

function sprite(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
	const canvas = document.createElement('canvas');
	canvas.width = width; canvas.height = height; paint(canvas.getContext('2d')!);
	return canvas;
}
function climberSprite(stride: number, airborne = false) {
	return sprite(32, 42, ctx => {
		ctx.translate(14, 40);
		const block = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
		block(-9, -34, 18, 30, '#071d2b');
		block(-11, -26, 6, 15, '#568551'); block(-11, -26, 3, 9, '#9ebc70');
		block(-6, -23, 15, 14, '#f25732'); block(-6, -23, 4, 12, '#ff8d49');
		block(-6 - stride, -10, 6, 8, '#214655'); block(3 + stride, -10, 6, 8, '#173a49');
		block(-9 - stride, -3, 9, 3, '#f4e5bd'); block(3 + stride, -3, 9, 3, '#f4e5bd');
		block(-3, -32, 12, 9, '#ffd29a'); block(6, -30, 3, 3, '#09232f');
		block(-6, -37, 12, 6, '#ffdd67'); block(-6, -34, 18, 3, '#ffe99a');
		block(6, airborne ? -30 : -21, 6, 9, '#ff8150'); block(9, airborne ? -33 : -15, 3, 6, '#ffd29a');
		block(-12, -25, 9, 3, '#ffdf71');
	});
}
export function createRenderer(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const trails = [.28, .56, .84].map(age => ({ age, positions: getLedges(0) }));
	const climbers = [climberSprite(0), climberSprite(-3), climberSprite(3), climberSprite(0, true)];
	const platforms = getLedges(0).map((p, i) => sprite(p.width + 10, 20, c => {
		c.fillStyle = '#0a2c3a'; c.fillRect(0, 0, p.width + 10, 10); c.fillRect(15, 10, p.width - 20, 10);
		c.fillStyle = i === 0 || i === CHECKPOINT ? '#8bbd81' : '#ffd092'; c.fillRect(5, 0, p.width, 5);
		c.fillStyle = '#ad7848'; c.fillRect(15, 5, p.width - 20, 5);
	}));
	return {
		resize() {
			// Pixel art needs no backing store larger than its logical world.
			canvas.width = Math.max(1, Math.min(WIDTH, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2))));
			canvas.height = Math.round(canvas.width * HEIGHT / WIDTH);
			ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
			ctx.imageSmoothingEnabled = false;
		},
		draw(p: Climber, reducedMotion: boolean) {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			if (!reducedMotion) for (const trail of trails) {
				getLedges(Math.max(0, p.elapsed - trail.age), trail.positions);
				ctx.globalAlpha = .1 * (1 - trail.age); ctx.fillStyle = '#ffd092';
				trail.positions.forEach((ledge, i) => { if (i !== 0 && i !== CHECKPOINT && i !== SUMMIT) ctx.fillRect(Math.round(ledge.x), ledge.y, ledge.width, 3); });
			}
			ctx.globalAlpha = 1;
			p.platforms.forEach((ledge, i) => {
				ctx.drawImage(platforms[i], Math.round(ledge.x) - 5, ledge.y);
				if (i) { ctx.globalAlpha = .55; ctx.fillStyle = p.visited.includes(i) ? '#8fd082' : '#fff1af'; ctx.fillRect(ledge.x + 8, ledge.y - 2, ledge.width - 16, 3); ctx.globalAlpha = 1; }
			});
			const checkpoint = p.platforms[CHECKPOINT], summit = p.platforms[SUMMIT];
			for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#fff0bc' : '#b1bd8e'; ctx.fillRect(checkpoint.x + checkpoint.width - 35 + i * 5, checkpoint.y - 5 - i * 5, 25 - i * 10, 5); }
			ctx.fillStyle = '#fff0c9'; ctx.fillRect(summit.x + summit.width - 25, summit.y - 45, 3, 45);
			ctx.fillStyle = '#ff5835'; ctx.fillRect(summit.x + summit.width - 22, summit.y - 45 + (reducedMotion ? 0 : Math.round(Math.sin(p.elapsed * 3)) * 5), 25, 15);
			const hook = p.grapple;
			if (hook) {
				ctx.beginPath(); ctx.moveTo(p.x, p.y - HAND_Y); ctx.lineTo(hook.hookX, hook.hookY);
				ctx.strokeStyle = '#082535'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#e9bd78'; ctx.lineWidth = 2; ctx.stroke();
				if (hook.phase === 'swinging') { ctx.strokeStyle = '#092535'; ctx.lineWidth = 7; ctx.strokeRect(hook.hookX - 7, hook.hookY - 7, 14, 14); ctx.strokeStyle = '#fff0a5'; ctx.lineWidth = 3; ctx.strokeRect(hook.hookX - 7, hook.hookY - 7, 14, 14); }
				ctx.fillStyle = '#fff0bc'; ctx.fillRect(hook.hookX - 5, hook.hookY - 5, 10, 4); ctx.fillRect(hook.hookX - 5, hook.hookY - 5, 4, 10); ctx.fillRect(hook.hookX + 2, hook.hookY - 5, 4, 10);
			} else if (!p.won) {
				ctx.fillStyle = '#fff0a599'; for (let i = 2; i <= 5; i++) ctx.fillRect(p.x + p.facing * i * 8 - 1, p.y - HAND_Y - i * 8 - 1, 3, 3);
			}
			const frame = !p.grounded ? 3 : Math.abs(p.vx) > 15 ? (Math.sin(p.elapsed * 15) > 0 ? 2 : 1) : 0;
			ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.scale(p.facing, 1); ctx.drawImage(climbers[frame], -14, -40); ctx.restore();
		},
	};
}
