export const WIDTH = 900, HEIGHT = 800, STEP = 1 / 120, HAND_Y = 22;
const HOOK_SPEED = 900, HOOK_RANGE = 420, GRAVITY = 1050;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const course = [
	[110, 702, 130, 0, 0, 0], [285, 575, 105, 110, .9, 0],
	[105, 440, 90, 65, 1.05, 1.2], [520, 610, 100, 105, .8, 2],
	[420, 420, 110, 0, 0, 0], [695, 465, 95, 80, .95, 1],
	[270, 300, 85, 100, 1.1, 2.1], [560, 275, 90, 120, .85, 3.5],
	[90, 215, 90, 45, .9, 1.5], [715, 325, 85, 70, 1.15, .5],
	[390, 155, 85, 100, 1, 2.4], [735, 190, 90, 0, 0, 0],
];
export const ledges = course.map(([x, y, width, range, speed, phase]) => ({ x, y, width, range, speed, phase }));
export const CHECKPOINT = 4, SUMMIT = ledges.length - 1;
const platformX = (index: number, time: number) => {
	const p = ledges[index];
	return p.x + Math.sin(time * p.speed + p.phase) * p.range;
};
// Callers can reuse a buffer; the simulation swaps two instead of allocating per step.
export function getLedges(time: number, output = ledges.map(({ x, y, width }) => ({ x, y, width }))) {
	for (let i = 0; i < output.length; i++) output[i].x = platformX(i, time);
	return output;
}
type Grapple = {
	platform: number; phase: 'flying' | 'swinging'; hookX: number; hookY: number;
	vx: number; vy: number; distance: number; offsetX: number; offsetY: number; length: number;
};
export type GameEvent = 'fired' | 'launched' | 'checkpoint' | 'summit' | 'fall' | 'latched' | 'miss';
export function createClimber() {
	return {
		x: 170, y: 702, vx: 0, vy: 0, facing: 1, grounded: true, platform: 0, elapsed: 0,
		checkpoint: 0, altitude: 0, visited: [0], won: false, jumpBuffer: 0, coyote: .1,
		grapple: null as Grapple | null, platforms: getLedges(0), previousPlatforms: getLedges(0),
	};
}
export type Climber = ReturnType<typeof createClimber>;
export function getAnchor(hook: Grapple, time: number) {
	return { x: platformX(hook.platform, time) + hook.offsetX, y: ledges[hook.platform].y + hook.offsetY };
}
export function releaseGrapple(p: Climber) { p.grapple = null; }
export function jump(p: Climber) { if (!p.won) p.jumpBuffer = .14; }
export function useGrapple(p: Climber): GameEvent | undefined {
	if (p.won) return;
	if (p.grapple) {
		if (p.grapple.phase !== 'swinging') return;
		releaseGrapple(p); // Preserve world-space velocity, including the moving anchor's momentum.
		p.grounded = false; p.platform = -1; p.coyote = p.jumpBuffer = 0;
		return 'launched';
	}
	p.grapple = {
		platform: -1, phase: 'flying', hookX: p.x, hookY: p.y - HAND_Y,
		vx: p.facing * HOOK_SPEED / Math.SQRT2, vy: -HOOK_SPEED / Math.SQRT2,
		distance: 0, offsetX: 0, offsetY: 0, length: 0,
	};
	return 'fired';
}
// Allocation-free swept ray/rectangle intersection; Infinity means no contact.
function hitRect(x: number, y: number, dx: number, dy: number, left: number, top: number, width: number, height: number) {
	if ((!dx && (x < left || x > left + width)) || (!dy && (y < top || y > top + height))) return Infinity;
	const ax = dx ? (left - x) / dx : -Infinity, bx = dx ? (left + width - x) / dx : Infinity;
	const ay = dy ? (top - y) / dy : -Infinity, by = dy ? (top + height - y) / dy : Infinity;
	const enter = Math.max(0, Math.min(ax, bx), Math.min(ay, by));
	return enter <= Math.min(1, Math.max(ax, bx), Math.max(ay, by)) ? enter : Infinity;
}
function land(p: Climber, index: number): GameEvent | undefined {
	p.y = ledges[index].y; p.vy = 0; p.grounded = true; p.platform = index;
	p.altitude = Math.max(p.altitude, ledges[0].y - p.y);
	if (!p.visited.includes(index)) p.visited.push(index);
	if (index === CHECKPOINT && p.checkpoint !== CHECKPOINT) { p.checkpoint = CHECKPOINT; return 'checkpoint'; }
	if (index === SUMMIT) { p.won = true; p.vx = 0; p.grapple = null; return 'summit'; }
}
/** Fixed-step physics, with the climber's feet as the position origin. */
export function stepClimber(p: Climber, direction: number, dt: number, reel = 0): GameEvent | undefined {
	if (p.won) return;
	const oldX = p.x, oldY = p.y, previous = p.platforms;
	p.elapsed += dt;
	const current = p.platforms = getLedges(p.elapsed, p.previousPlatforms);
	p.previousPlatforms = previous;
	const carrierDx = p.grounded && p.platform >= 0 ? current[p.platform].x - previous[p.platform].x : 0;
	p.x += carrierDx;
	if (direction) p.facing = direction;
	p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
	p.coyote = p.grounded ? .1 : Math.max(0, p.coyote - dt);
	if (p.jumpBuffer > 0 && p.coyote > 0) {
		p.vy = -460; p.vx += carrierDx / dt; p.grounded = false; p.platform = -1; p.jumpBuffer = p.coyote = 0;
	}
	let event: GameEvent | undefined, hook = p.grapple;
	if (hook?.phase === 'flying') {
		const flight = Math.min(dt, (HOOK_RANGE - hook.distance) / HOOK_SPEED);
		const dx = hook.vx * flight, dy = hook.vy * flight;
		let first = Infinity, target = -1;
		for (let i = 0; i < previous.length; i++) {
			const ledge = previous[i], relativeDx = dx - (current[i].x - ledge.x) * flight / dt;
			const hit = Math.min(
				hitRect(hook.hookX, hook.hookY, relativeDx, dy, ledge.x - 5, ledge.y, ledge.width + 10, 10),
				hitRect(hook.hookX, hook.hookY, relativeDx, dy, ledge.x + 10, ledge.y + 10, ledge.width - 20, 10),
			);
			if (hit < first) { first = hit; target = i; }
		}
		if (target >= 0) {
			hook.platform = target; hook.phase = 'swinging';
			hook.offsetX = hook.hookX + dx * first - previous[target].x - (current[target].x - previous[target].x) * flight / dt * first;
			hook.offsetY = hook.hookY + dy * first - previous[target].y;
			hook.length = Math.max(25, Math.hypot(current[target].x + hook.offsetX - p.x, current[target].y + hook.offsetY - p.y + HAND_Y) * .95);
			p.grounded = false; p.platform = -1; p.coyote = 0; event = 'latched';
		} else {
			hook.hookX += dx; hook.hookY += dy; hook.distance += HOOK_SPEED * flight;
			if (hook.distance >= HOOK_RANGE || hook.hookX < 0 || hook.hookX > WIDTH || hook.hookY < 0) { p.grapple = hook = null; event = 'miss'; }
		}
	}
	const swinging = hook?.phase === 'swinging';
	if (swinging && hook) {
		hook.length = clamp(hook.length + clamp(reel, -1, 1) * 90 * dt, 25, HOOK_RANGE);
		hook.hookX = current[hook.platform].x + hook.offsetX; hook.hookY = current[hook.platform].y + hook.offsetY;
		p.vx = clamp(p.vx + direction * 680 * dt, -420, 420);
	} else if (p.grounded || direction) p.vx += (direction * 190 - p.vx) * Math.min(1, dt * (p.grounded ? 18 : 8));
	p.vy += (swinging ? 780 : GRAVITY) * dt;
	p.x = clamp(p.x + p.vx * dt, 12, WIDTH - 12); p.y += p.vy * dt;
	p.grounded = false; p.platform = -1;
	if (swinging && hook) {
		const dx = p.x - hook.hookX, dy = p.y - HAND_Y - hook.hookY, distance = Math.hypot(dx, dy);
		if (distance > hook.length) {
			const nx = dx / distance, ny = dy / distance;
			p.x = hook.hookX + nx * hook.length; p.y = hook.hookY + ny * hook.length + HAND_Y;
			const anchorVx = (current[hook.platform].x - previous[hook.platform].x) / dt;
			const outward = (p.vx - anchorVx) * nx + p.vy * ny;
			if (outward > 0) { p.vx -= outward * nx; p.vy -= outward * ny; }
		}
	} else if (p.vy >= 0) {
		let first = Infinity, landing = -1;
		for (let i = 0; i < current.length; i++) {
			const ledge = current[i];
			if (oldY > ledge.y + .001 || p.y < ledge.y || p.y <= oldY) continue;
			const fraction = Math.max(0, (ledge.y - oldY) / (p.y - oldY));
			const x = oldX + (p.x - oldX) * fraction, left = previous[i].x + (ledge.x - previous[i].x) * fraction;
			if (!fraction && (p.x + 7 <= ledge.x || p.x - 7 >= ledge.x + ledge.width)) continue;
			if (fraction < first && x + 7 > left && x - 7 < left + ledge.width) { first = fraction; landing = i; }
		}
		if (landing >= 0) event = land(p, landing) ?? event;
	}
	if (p.y > HEIGHT + 60) {
		const ledge = current[p.checkpoint];
		p.x = ledge.x + ledge.width / 2; p.y = ledge.y; p.vx = p.vy = p.jumpBuffer = 0; p.grapple = null;
		p.grounded = true; p.platform = p.checkpoint; p.coyote = .1; event = 'fall';
	}
	return event;
}
