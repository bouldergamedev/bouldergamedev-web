import { createClimber, stepClimber, getLedges, getAnchor, useGrapple, releaseGrapple, jump, ledges, CHECKPOINT, SUMMIT, WIDTH, HEIGHT } from './climb-physics';

export function initMountain() {
	const canvas = document.querySelector<HTMLCanvasElement>('#mountain-game');
	const context = canvas?.getContext('2d');
	if (!canvas || !context) return;
	const ctx = context;
	const againButton = document.querySelector<HTMLButtonElement>('#climb-again')!;
	const instructions = document.querySelector<HTMLElement>('#game-instructions')!;
	const status = document.querySelector<HTMLElement>('#game-status')!;
	const summit = document.querySelector<HTMLElement>('.summit-message')!;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let player = createClimber();
	let active = false;
	let visible = true;
	let lastTime = 0;
	let accumulator = 0;
	let time = 0;
	let frame = 0;
	const keys = new Set<string>();
	const background = document.createElement('canvas');
	const pixel = 5;
	background.width = WIDTH / pixel;
	background.height = HEIGHT / pixel;
	const art = background.getContext('2d')!;
	art.scale(1 / pixel, 1 / pixel);

	// A seeded landscape keeps the painting stable across redraws and screen sizes.
	let seed = 4817;
	function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
	function polygon(c: CanvasRenderingContext2D, points: number[][], fill: string) {
		const snap = (value: number) => Math.round(value / pixel) * pixel;
		c.beginPath();
		c.moveTo(snap(points[0][0]), snap(points[0][1]));
		// Trace stepped edges explicitly so the silhouette has clean, square pixels.
		for (let i = 0; i < points.length; i++) {
			const from = points[i], to = points[(i + 1) % points.length];
			const steps = Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) / 10);
			let previousY = snap(from[1]);
			for (let step = 1; step <= steps; step++) {
				const x = snap(from[0] + (to[0] - from[0]) * step / steps);
				const y = snap(from[1] + (to[1] - from[1]) * step / steps);
				c.lineTo(x, previousY); c.lineTo(x, y); previousY = y;
			}
		}
		c.closePath(); c.fillStyle = fill; c.fill();
	}
	function pine(x: number, y: number, height: number, color: string) {
		const unit = Math.max(5, Math.round(height / 100) * 5);
		x = Math.round(x / 5) * 5; y = Math.round(y / 5) * 5;
		art.fillStyle = '#103a36'; art.fillRect(x - unit / 2, y - height, unit, height);
		for (let j = 0; j < 7; j++) {
			const top = Math.round((y - height + j * height / 9) / 5) * 5;
			const width = Math.round((unit + j * height / 27) / 5) * 5;
			polygon(art, [[x - unit / 2, top], [x + unit / 2, top], [x + width, top + height / 6], [x + width, top + height / 5], [x - width, top + height / 5], [x - width, top + height / 6]], color);
			polygon(art, [[x - unit, top + 5], [x, top + 5], [x - width + unit, top + height / 6], [x - width + unit, top + height / 5], [x - width, top + height / 5], [x - width, top + height / 6]], '#52995a');
			art.fillStyle = '#12453b'; art.fillRect(x + unit, top + height / 7, Math.max(unit, width - unit), unit);
		}
	}

	function paintLandscape() {
		art.fillStyle = '#101f25'; art.fillRect(0, 0, WIDTH, HEIGHT);
		// Oversized, stair-stepped sunset bands echo the reference's arcade artwork.
		const sunset = ['#ff5033', '#ff772b', '#ffbb40', '#ffe568', '#ffed80', '#ffed80'];
		for (let y = 60; y < 660; y += 10) {
			if ((y - 60) % 100 >= 80) continue;
			const halfWidth = Math.floor(Math.sqrt(370 ** 2 - (y - 430) ** 2) / 10) * 10;
			art.fillStyle = sunset[Math.floor((y - 60) / 100)];
			art.fillRect(460 - halfWidth, y, halfWidth * 2, 10);
		}
		polygon(art, [[0, 620], [95, 533], [135, 549], [228, 443], [255, 452], [328, 358], [368, 437], [398, 425], [474, 532], [528, 461], [598, 539], [684, 432], [773, 514], [835, 484], [900, 575], [900, 800], [0, 800]], '#103a48');
		polygon(art, [[0, 668], [131, 594], [178, 532], [200, 555], [296, 411], [315, 434], [348, 554], [390, 584], [459, 472], [484, 505], [511, 556], [557, 589], [627, 510], [686, 579], [765, 509], [900, 634], [900, 800], [0, 800]], '#0a2938');
		// The near Flatirons: lit sandstone faces, cool fractures, and a playable ridge.
		polygon(art, [[79, 753], [170, 623], [197, 601], [303, 395], [322, 367], [339, 442], [370, 476], [472, 264], [493, 234], [514, 284], [535, 364], [569, 416], [698, 224], [774, 189], [801, 226], [836, 334], [900, 478], [900, 800], [79, 800]], '#082535');
		polygon(art, [[100, 736], [170, 623], [197, 601], [303, 395], [322, 367], [310, 457], [279, 553], [241, 636], [212, 729]], '#ffba72');
		polygon(art, [[244, 748], [311, 593], [373, 459], [472, 264], [493, 234], [479, 350], [456, 416], [422, 516], [388, 590], [367, 697]], '#ffc17a');
		polygon(art, [[424, 742], [487, 563], [549, 447], [620, 338], [698, 224], [774, 189], [746, 276], [706, 352], [660, 452], [630, 529], [568, 650], [552, 728]], '#ffbb73');
		polygon(art, [[774, 189], [801, 226], [836, 334], [900, 478], [900, 800], [754, 710], [715, 535], [736, 425], [751, 321]], '#082737');
		polygon(art, [[493, 234], [514, 284], [535, 364], [569, 416], [524, 509], [492, 421], [505, 352]], '#104154');
		polygon(art, [[322, 367], [339, 442], [370, 476], [329, 562], [316, 518]], '#103b4a');
		polygon(art, [[774, 215], [790, 290], [806, 352], [836, 420], [854, 465], [839, 455], [816, 417], [785, 349]], '#104154');
		polygon(art, [[288, 476], [282, 513], [255, 570], [242, 618], [224, 648], [233, 601], [248, 552]], '#e9924e');
		polygon(art, [[461, 352], [449, 412], [412, 476], [393, 544], [369, 585], [379, 535], [401, 471], [434, 411]], '#eb914b');
		polygon(art, [[728, 300], [711, 357], [681, 402], [664, 448], [638, 470], [650, 430], [674, 384], [704, 343]], '#ec924d');
		// Fine, broken sediment lines give the rock faces depth at full resolution.
		art.save();
		art.beginPath(); art.moveTo(424, 742); art.lineTo(549, 447); art.lineTo(698, 224); art.lineTo(774, 189); art.lineTo(746, 276); art.lineTo(552, 728); art.closePath(); art.clip();
		for (let i = 0; i < 45; i++) {
			const x = 400 + random() * 400, y = 210 + random() * 560;
			polygon(art, [[x, y], [x + 5, y], [x - 8, y + 25], [x - 13, y + 25]], random() > .5 ? '#ffd093' : '#f2a35e');
		}
		art.restore();
		for (let i = 0; i < 45; i++) {
			const x = random() * 900;
			pine(x, 690 + Math.sin(x / 120) * 23, 55 + random() * 75, '#367d4c');
		}
		polygon(art, [[0, 705], [90, 682], [164, 731], [250, 705], [355, 757], [460, 706], [570, 735], [708, 658], [900, 704], [900, 800], [0, 800]], '#0a2830');
		for (let i = 0; i < 25; i++) {
			const x = random() * 900;
			// Keep the trailhead clear so the climber is easy to spot.
			if (x > 95 && x < 245) continue;
			pine(x, 782 + random() * 40, 95 + random() * 155, i % 3 ? '#0b302e' : '#226344');
		}
		const bottomFade = art.createLinearGradient(0, 725, 0, 800);
		bottomFade.addColorStop(0, '#101f2500'); bottomFade.addColorStop(1, '#101f25'); art.fillStyle = bottomFade; art.fillRect(0, 725, 900, 75);
		const edgeFade = art.createLinearGradient(0, 0, 900, 0);
		edgeFade.addColorStop(0, '#101f25'); edgeFade.addColorStop(.05, '#101f2500'); edgeFade.addColorStop(.95, '#101f2500'); edgeFade.addColorStop(1, '#101f25'); art.fillStyle = edgeFade; art.fillRect(0, 0, 900, 800);
		const topFade = art.createLinearGradient(0, 0, 0, 120);
		topFade.addColorStop(0, '#101f25'); topFade.addColorStop(.45, '#101f2500'); topFade.addColorStop(1, '#101f2500'); art.fillStyle = topFade; art.fillRect(0, 0, 900, 120);
		// Subtle pigment-like grain, baked once rather than animated.
		for (let i = 0; i < 19000; i++) { art.fillStyle = random() > .5 ? '#f5e2be06' : '#07171d08'; art.fillRect(random() * 900, random() * 800, 1, 1); }
	}
	paintLandscape();

	function drawClimber() {
		const walking = player.grounded && Math.abs(player.vx) > 15;
		const stride = walking ? (Math.sin(time * 15) > 0 ? 3 : -3) : 0;
		ctx.save(); ctx.translate(Math.round(player.x), Math.round(player.y)); ctx.scale(player.facing, 1);
		const block = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
		block(-9, -34, 18, 30, '#071d2b');
		block(-11, -26, 6, 15, '#568551'); block(-11, -26, 3, 9, '#9ebc70');
		block(-6, -23, 15, 14, '#f25732'); block(-6, -23, 4, 12, '#ff8d49');
		block(-6 - stride, -10, 6, 8, '#214655'); block(3 + stride, -10, 6, 8, '#173a49');
		block(-9 - stride, -3, 9, 3, '#f4e5bd'); block(3 + stride, -3, 9, 3, '#f4e5bd');
		block(-3, -32, 12, 9, '#ffd29a'); block(6, -30, 3, 3, '#09232f');
		block(-6, -37, 12, 6, '#ffdd67'); block(-6, -34, 18, 3, '#ffe99a');
		block(6, player.grounded ? -21 : -30, 6, 9, '#ff8150');
		block(9, player.grounded ? -15 : -33, 3, 6, '#ffd29a');
		block(-12, -25, 9, 3, '#ffdf71');
		ctx.restore();
	}

	function draw() {
		ctx.clearRect(0, 0, WIDTH, HEIGHT);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
		const currentLedges = getLedges(player.elapsed);
		// Subtle motion trails make the wide, independent platform routes readable.
		if (active) {
			for (const age of [.28, .56, .84]) {
				const previous = getLedges(Math.max(0, player.elapsed - age));
				ctx.globalAlpha = .1 * (1 - age);
				ctx.fillStyle = '#ffd092';
				for (const [index, ledge] of previous.entries()) {
					if (![0, CHECKPOINT, SUMMIT].includes(index)) ctx.fillRect(Math.round(ledge.x), Math.round(ledge.y), ledge.width, 3);
				}
			}
			ctx.globalAlpha = 1;
		}
		for (const [index, ledge] of currentLedges.entries()) {
			// Translate the block-shaped platform as a whole for smooth, pixel-art motion.
			ctx.save(); ctx.translate(Math.round(ledge.x), ledge.y);
			ctx.fillStyle = '#0a2c3a'; ctx.fillRect(-5, 0, ledge.width + 10, 10); ctx.fillRect(10, 10, ledge.width - 20, 10);
			ctx.fillStyle = index === 0 || index === CHECKPOINT ? '#8bbd81' : '#ffd092'; ctx.fillRect(0, 0, ledge.width, 5);
			ctx.fillStyle = '#ad7848'; ctx.fillRect(10, 5, ledge.width - 20, 5);
			ctx.restore();
		}
		const checkpoint = currentLedges[CHECKPOINT];
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = i % 2 ? '#fff0bc' : '#b1bd8e';
			ctx.fillRect(checkpoint.x + checkpoint.width - 35 + i * 5, checkpoint.y - 5 - i * 5, 25 - i * 10, 5);
		}
		if (active && !player.won) {
			if (player.grapple && player.grapple.phase !== 'flying') {
				const anchor = getAnchor(player.grapple, player.elapsed);
				ctx.strokeStyle = '#092535'; ctx.lineWidth = 7; ctx.strokeRect(anchor.x - 7, anchor.y - 7, 14, 14);
				ctx.strokeStyle = '#fff0a5'; ctx.lineWidth = 3; ctx.strokeRect(anchor.x - 7, anchor.y - 7, 14, 14);
				ctx.fillStyle = '#fff0a5'; ctx.fillRect(anchor.x - 2, anchor.y - 2, 4, 4);
			} else if (!player.grapple) {
				// A short 45-degree sight line shows direction, never a selected target.
				ctx.fillStyle = '#fff0a599';
				for (let i = 2; i <= 5; i++) ctx.fillRect(player.x + player.facing * i * 8 - 1, player.y - 22 - i * 8 - 1, 3, 3);
			}
			if (player.grapple) {
				const hook = player.grapple;
				ctx.beginPath(); ctx.moveTo(player.x, player.y - 22); ctx.lineTo(hook.hookX, hook.hookY);
				ctx.strokeStyle = '#082535'; ctx.lineWidth = 6; ctx.stroke();
				ctx.strokeStyle = '#e9bd78'; ctx.lineWidth = 2; ctx.stroke();
				ctx.fillStyle = '#fff0bc'; ctx.fillRect(hook.hookX - 5, hook.hookY - 5, 10, 4); ctx.fillRect(hook.hookX - 5, hook.hookY - 5, 4, 10); ctx.fillRect(hook.hookX + 2, hook.hookY - 5, 4, 10);
			}
		}
		// Summit pennant; its motion is ambient only when motion is welcome.
		const summitLedge = currentLedges[SUMMIT];
		const flagX = summitLedge.x + summitLedge.width - 25, flagY = summitLedge.y - 45;
		ctx.fillStyle = '#fff0c9'; ctx.fillRect(flagX, flagY, 3, 45);
		const flutter = reducedMotion.matches ? 0 : Math.round(Math.sin(time * 3)) * 5;
		polygon(ctx, [[flagX + 3, flagY], [flagX + 28, flagY + flutter], [flagX + 28, flagY + 15 + flutter], [flagX + 3, flagY + 15]], '#ff5835');
		if (active) {
			for (let i = 1; i < ledges.length; i++) {
				const ledge = currentLedges[i];
				ctx.strokeStyle = player.visited.includes(i) ? '#8fd082' : '#fff1af'; ctx.globalAlpha = .55; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(ledge.x + 8, ledge.y - 1); ctx.lineTo(ledge.x + ledge.width - 8, ledge.y - 1); ctx.stroke();
			}
			ctx.globalAlpha = 1;
		} else {
			ctx.fillStyle = '#ffe58a';
			ctx.fillRect(player.x - 3, player.y - 54, 6, 6);
			ctx.fillRect(player.x - 6, player.y - 60, 12, 6);
		}
		drawClimber();
	}

	function resize() {
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		const width = canvas!.getBoundingClientRect().width;
		canvas!.width = Math.round(width * ratio);
		canvas!.height = Math.round(width * HEIGHT / WIDTH * ratio);
		ctx.setTransform(canvas!.width / WIDTH, 0, 0, canvas!.height / HEIGHT, 0, 0);
		draw();
	}
	new ResizeObserver(resize).observe(canvas);

	function clearInput() { keys.clear(); player.jumpBuffer = 0; }
	let lastMode = '';
	function updateGrappleUI() {
		const mode = player.won ? 'summit' : player.grapple?.phase ?? 'ready';
		if (mode === lastMode) return;
		lastMode = mode;
		if (!player.won) instructions.textContent = mode === 'swinging'
			? '← → swing · ↑ retract / ↓ extend cable · Space launch · S release.'
			: '← → / A D move · ↑ jump · Space fires 45° forward · Space again to launch.';
	}
	function grappleAction() {
		if (!active || player.won) return;
		const left = keys.has('ArrowLeft') || keys.has('KeyA');
		const right = keys.has('ArrowRight') || keys.has('KeyD');
		if (left !== right) player.facing = left ? -1 : 1;
		const result = useGrapple(player);
		if (result === 'fired') status.textContent = `Hook fired 45 degrees up and ${player.facing > 0 ? 'right' : 'left'}.`;
		if (result === 'launched') status.textContent = 'Launched off the rope with your swing momentum. Space can fire another hook.';
		updateGrappleUI();
	}
	function releaseAction() {
		if (!active || player.won || !player.grapple) return;
		releaseGrapple(player); status.textContent = 'Hook released. Your swing momentum carries you.'; updateGrappleUI();
	}
	function jumpAction() { if (active && player.grapple?.phase !== 'swinging') jump(player); }
	function start(focus = true) {
		player = createClimber(); active = true; accumulator = 0; clearInput();
		summit.hidden = true;
		lastMode = ''; updateGrappleUI();
		status.textContent = 'Climb started. Swing across the moving platforms to the flag at the upper right. The green ledge in the middle is a checkpoint. Up jumps, Space fires your hook, Up and Down adjust the cable, and Space again launches you with your swing momentum.';
		if (focus) canvas!.focus({ preventScroll: true });
		requestFrame();
	}
	againButton.addEventListener('click', () => start());
	const movementKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyS'];
	window.addEventListener('keydown', (event) => {
		// Play immediately from the page, while preserving focused links and buttons.
		if (event.target !== canvas && event.target !== document.body && event.target !== document.documentElement) return;
		if (!active || !visible || !movementKeys.includes(event.code)) return;
		event.preventDefault();
		keys.add(event.code);
		if (!event.repeat && event.code === 'Space') grappleAction();
		if (!event.repeat && event.code === 'ArrowUp') jumpAction();
		if (!event.repeat && event.code === 'KeyS') releaseAction();
	});
	window.addEventListener('keyup', (event) => keys.delete(event.code));
	canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
	canvas.addEventListener('blur', clearInput);
	window.addEventListener('blur', clearInput);

	function update(dt: number) {
		const right = keys.has('ArrowRight') || keys.has('KeyD');
		const left = keys.has('ArrowLeft') || keys.has('KeyA');
		const retract = keys.has('ArrowUp');
		const extend = keys.has('ArrowDown');
		const result = stepClimber(player, Number(right) - Number(left), dt, Number(extend) - Number(retract));
		if (result === 'checkpoint') status.textContent = 'Checkpoint saved at the central cairn. Choose your next swing toward the flag.';
		if (result === 'latched') status.textContent = 'Hook attached. Left and right to swing. Hold Up to retract the cable or Down to extend it. Space again to launch with your swing momentum. S to release.';
		if (result === 'miss') status.textContent = 'Hook missed. Reposition or jump, then fire again.';
		if (result === 'fall') status.textContent = player.checkpoint ? 'Back at the halfway checkpoint. Your hook is ready.' : 'Back at the trailhead. Your hook is ready.';
		if (result === 'summit') {
			summit.hidden = false;
			status.textContent = 'Summit reached! You swung across the mountain. Nice climb.';
			clearInput(); againButton.focus({ preventScroll: true });
		}
		updateGrappleUI();
	}
	function requestFrame() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }
	function tick(now: number) {
		frame = 0;
		const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
		lastTime = now; time += elapsed;
		if (active && !player.won) {
			accumulator += elapsed;
			while (accumulator >= 1 / 120) { update(1 / 120); accumulator -= 1 / 120; }
		}
		draw();
		if ((active && !player.won) || !reducedMotion.matches) requestFrame();
	}
	new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) { lastTime = 0; requestFrame(); } else { clearInput(); cancelAnimationFrame(frame); frame = 0; }
	}).observe(canvas);
	document.addEventListener('visibilitychange', () => {
		clearInput(); lastTime = 0;
		if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestFrame();
	});
	reducedMotion.addEventListener('change', requestFrame);
	resize(); start(false);
}
