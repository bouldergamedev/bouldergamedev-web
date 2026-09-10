export const WIDTH = 900;
export const HEIGHT = 800;
export const ledges = [
	{ x: 110, y: 702, width: 130 },
	{ x: 285, y: 575, width: 105 },
	{ x: 105, y: 440, width: 90 },
	{ x: 520, y: 610, width: 100 },
	{ x: 420, y: 420, width: 110 },
	{ x: 695, y: 465, width: 95 },
	{ x: 270, y: 300, width: 85 },
	{ x: 560, y: 275, width: 90 },
	{ x: 90, y: 215, width: 90 },
	{ x: 715, y: 325, width: 85 },
	{ x: 390, y: 155, width: 85 },
	{ x: 735, y: 190, width: 90 },
];
export const CHECKPOINT = 4;
export const SUMMIT = ledges.length - 1;
const motion = [
	{ x: 0, speed: 0, phase: 0 },
	{ x: 110, speed: .9, phase: 0 },
	{ x: 65, speed: 1.05, phase: 1.2 },
	{ x: 105, speed: .8, phase: 2 },
	{ x: 0, speed: 0, phase: 0 },
	{ x: 80, speed: .95, phase: 1 },
	{ x: 100, speed: 1.1, phase: 2.1 },
	{ x: 120, speed: .85, phase: 3.5 },
	{ x: 45, speed: .9, phase: 1.5 },
	{ x: 70, speed: 1.15, phase: .5 },
	{ x: 100, speed: 1, phase: 2.4 },
	{ x: 0, speed: 0, phase: 0 },
];

/** Wide horizontal sweeps create alternate swing paths at fixed heights. */
export function getLedges(time: number) {
	return ledges.map((ledge, index) => ({
		...ledge,
		x: ledge.x + Math.sin(time * motion[index].speed + motion[index].phase) * motion[index].x,
	}));
}

type Grapple = {
	platform: number; phase: 'flying' | 'swinging';
	hookX: number; hookY: number; length: number;
	vx: number; vy: number; distance: number; offsetX: number; offsetY: number;
};

export function createClimber() {
	return { x: 170, y: 702, vx: 0, vy: 0, facing: 1, grounded: true, platform: 0, elapsed: 0, checkpoint: 0, altitude: 0, visited: [0], won: false, jumpBuffer: 0, coyote: .1, grapple: null as Grapple | null };
}

export type Climber = ReturnType<typeof createClimber>;

export function getAnchor(grapple: Grapple, time: number) {
	const ledge = getLedges(time)[grapple.platform];
	return { x: ledge.x + grapple.offsetX, y: ledge.y + grapple.offsetY };
}

/** Swept point vs. rectangle: return the first contact along this frame's ray. */
function rayHit(x: number, y: number, dx: number, dy: number, left: number, top: number, width: number, height: number) {
	let enter = 0, exit = 1;
	for (const [origin, delta, min, max] of [[x, dx, left, left + width], [y, dy, top, top + height]]) {
		if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return null; continue; }
		const a = (min - origin) / delta, b = (max - origin) / delta;
		enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
		if (enter > exit) return null;
	}
	return enter;
}

export function useGrapple(player: Climber): 'fired' | 'launched' | undefined {
	if (player.won) return;
	if (player.grapple) {
		if (player.grapple.phase === 'swinging') {
			// Keep the world-space swing velocity: no aim correction or artificial boost.
			releaseGrapple(player);
			player.grounded = false; player.platform = -1; player.coyote = 0; player.jumpBuffer = 0;
			return 'launched';
		}
		return;
	}
	player.grapple = {
		platform: -1, phase: 'flying', hookX: player.x, hookY: player.y - 22, length: 0,
		vx: player.facing * 900 / Math.SQRT2, vy: -900 / Math.SQRT2,
		distance: 0, offsetX: 0, offsetY: 0,
	};
	return 'fired';
}

export function releaseGrapple(player: Climber) { player.grapple = null; }

export function jump(player: Climber) { if (!player.won) player.jumpBuffer = .14; }

function land(player: Climber, index: number): 'checkpoint' | 'summit' | undefined {
	const ledge = getLedges(player.elapsed)[index];
	player.y = ledge.y; player.vy = 0; player.grounded = true; player.platform = index;
	player.altitude = Math.max(player.altitude, Math.round(ledges[0].y - ledge.y));
	if (!player.visited.includes(index)) player.visited.push(index);
	if (index === CHECKPOINT && player.checkpoint !== CHECKPOINT) { player.checkpoint = CHECKPOINT; return 'checkpoint'; }
	if (index === SUMMIT) { player.won = true; player.vx = 0; player.grapple = null; return 'summit'; }
}

/** Fixed-step platform physics. Positions use the character's feet as the origin. */
export function stepClimber(player: Climber, direction: number, dt: number, reel = 0): 'checkpoint' | 'summit' | 'fall' | 'latched' | 'miss' | undefined {
	if (player.won) return;
	const previousX = player.x, previousY = player.y;
	const previousLedges = getLedges(player.elapsed);
	player.elapsed += dt;
	const currentLedges = getLedges(player.elapsed);
	if (player.grounded && player.platform >= 0) {
		player.x += currentLedges[player.platform].x - previousLedges[player.platform].x;
		player.y += currentLedges[player.platform].y - previousLedges[player.platform].y;
	}
	if (direction) player.facing = direction;
	player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
	player.coyote = player.grounded ? .1 : Math.max(0, player.coyote - dt);
	if (player.jumpBuffer > 0 && player.coyote > 0) {
		player.vy = -460;
		if (player.grounded && player.platform >= 0) {
			player.vx += (currentLedges[player.platform].x - previousLedges[player.platform].x) / dt;
			player.vy += (currentLedges[player.platform].y - previousLedges[player.platform].y) / dt;
		}
		player.grounded = false; player.platform = -1;
		player.jumpBuffer = 0; player.coyote = 0;
	}
	let event: 'checkpoint' | 'summit' | 'fall' | 'latched' | 'miss' | undefined;
	let grapple = player.grapple;
	if (grapple) {
		if (grapple.phase === 'flying') {
			const travelTime = Math.min(dt, (420 - grapple.distance) / 900);
			const dx = grapple.vx * travelTime, dy = grapple.vy * travelTime;
			let firstHit = 2, hitPlatform = -1;
			for (const [index, ledge] of previousLedges.entries()) {
				// Test in the moving platform's frame so fast shots cannot tunnel through it.
				const platformDx = (currentLedges[index].x - ledge.x) * travelTime / dt;
				const platformDy = (currentLedges[index].y - ledge.y) * travelTime / dt;
				for (const [left, top, width, height] of [
					[ledge.x - 5, ledge.y, ledge.width + 10, 10],
					[ledge.x + 10, ledge.y + 10, ledge.width - 20, 10],
				]) {
					const hit = rayHit(grapple.hookX, grapple.hookY, dx - platformDx, dy - platformDy, left, top, width, height);
					if (hit !== null && hit < firstHit) { firstHit = hit; hitPlatform = index; }
				}
			}
			if (hitPlatform >= 0) {
				const previous = previousLedges[hitPlatform], current = currentLedges[hitPlatform];
				grapple.platform = hitPlatform;
				grapple.offsetX = grapple.hookX + dx * firstHit - (previous.x + (current.x - previous.x) * travelTime / dt * firstHit);
				grapple.offsetY = grapple.hookY + dy * firstHit - (previous.y + (current.y - previous.y) * travelTime / dt * firstHit);
				grapple.phase = 'swinging';
				const anchor = getAnchor(grapple, player.elapsed);
				grapple.length = Math.max(25, Math.hypot(anchor.x - player.x, anchor.y - (player.y - 22)) * .95);
				player.grounded = false; player.platform = -1; player.coyote = 0; event = 'latched';
			} else {
				grapple.hookX += dx; grapple.hookY += dy; grapple.distance += 900 * travelTime;
				if (grapple.distance >= 420 || grapple.hookX < 0 || grapple.hookX > WIDTH || grapple.hookY < 0) {
					player.grapple = null; grapple = null; event = 'miss';
				}
			}
		}
		if (grapple && grapple.phase !== 'flying') {
			const anchor = getAnchor(grapple, player.elapsed);
			grapple.hookX = anchor.x; grapple.hookY = anchor.y;
		}
	}
	const swinging = grapple?.phase === 'swinging';
	if (swinging && grapple) grapple.length = Math.max(25, Math.min(420, grapple.length + Math.max(-1, Math.min(1, reel)) * 90 * dt));
	if (swinging) player.vx = Math.max(-420, Math.min(420, player.vx + direction * 680 * dt));
	else if (player.grounded) player.vx += (direction * 190 - player.vx) * Math.min(1, dt * 18);
	else if (direction) player.vx += (direction * 190 - player.vx) * Math.min(1, dt * 8);
	player.vy += (swinging ? 780 : 1050) * dt;
	player.x = Math.max(12, Math.min(WIDTH - 12, player.x + player.vx * dt));
	player.y += player.vy * dt;
	player.grounded = false;
	player.platform = -1;
	if (swinging && grapple) {
		const anchor = getAnchor(grapple, player.elapsed);
		const previousAnchor = getAnchor(grapple, player.elapsed - dt);
		const dx = player.x - anchor.x, dy = player.y - 22 - anchor.y;
		const distance = Math.hypot(dx, dy);
		if (distance > grapple.length) {
			const nx = dx / distance, ny = dy / distance;
			player.x = anchor.x + nx * grapple.length; player.y = anchor.y + ny * grapple.length + 22;
			// Remove only outward velocity, preserving the tangent that creates the swing.
			const anchorVx = (anchor.x - previousAnchor.x) / dt;
			const anchorVy = (anchor.y - previousAnchor.y) / dt;
			const outward = (player.vx - anchorVx) * nx + (player.vy - anchorVy) * ny;
			if (outward > 0) { player.vx -= outward * nx; player.vy -= outward * ny; }
		}
	} else {
		let firstLanding = 2, landing = -1, landingX = player.x;
		for (const [index, ledge] of currentLedges.entries()) {
			const previous = previousLedges[index];
			const start = previousY - previous.y, end = player.y - ledge.y;
			if (start <= .001 && end >= 0 && end > start) {
				const fraction = Math.max(0, -start / (end - start));
				const x = previousX + (player.x - previousX) * fraction;
				const platformX = previous.x + (ledge.x - previous.x) * fraction;
				if (fraction === 0 && (player.x + 7 <= ledge.x || player.x - 7 >= ledge.x + ledge.width)) continue;
				if (fraction < firstLanding && x + 7 > platformX && x - 7 < platformX + ledge.width) {
					firstLanding = fraction; landing = index;
					landingX = player.x;
				}
			}
		}
		if (landing >= 0) { player.x = landingX; event = land(player, landing) ?? event; }
	}
	if (player.y > HEIGHT + 60) {
		const ledge = currentLedges[player.checkpoint];
		player.x = ledge.x + ledge.width / 2;
		player.y = ledge.y;
		player.vx = player.vy = 0; player.grapple = null;
		player.jumpBuffer = 0; player.coyote = .1;
		player.grounded = true;
		player.platform = player.checkpoint;
		event = 'fall';
	}
	return event;
}
