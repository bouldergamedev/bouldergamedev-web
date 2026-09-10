import assert from 'node:assert/strict';
import test from 'node:test';
import { createClimber, stepClimber, getLedges, getAnchor, useGrapple, releaseGrapple, jump, ledges, CHECKPOINT, SUMMIT, HEIGHT } from '../src/scripts/climb-physics.ts';

const dt = 1 / 120;

function belowPlatform(index = 1, offset = 25, facing = 1) {
	const player = createClimber();
	const ledge = getLedges(0)[index];
	// The projectile reaches the underside after travelling 38px on each axis.
	Object.assign(player, { x: ledge.x + offset - facing * 38, y: ledge.y + 80, grounded: false, platform: -1, facing });
	return player;
}

function latch(player) {
	assert.equal(useGrapple(player), 'fired');
	for (let frame = 0; frame < 120 && player.grapple?.phase === 'flying'; frame++) stepClimber(player, 0, dt);
	assert.equal(player.grapple?.phase, 'swinging');
}

test('Up jump lifts from a ledge and cannot be repeated in midair', () => {
	const player = createClimber(); jump(player); stepClimber(player, 0, dt);
	assert.ok(player.y < 702); assert.ok(player.vy < 0); assert.equal(player.platform, -1);
	for (let i = 0; i < 20; i++) stepClimber(player, 0, dt);
	const vy = player.vy; jump(player); stepClimber(player, 0, dt);
	assert.ok(player.vy > vy, 'a second press must not reset upward velocity');
});

test('progress follows altitude rather than platform order, with a working checkpoint and summit', () => {
	const player = createClimber();
	function touchDown(index) {
		const ledge = getLedges(player.elapsed)[index];
		Object.assign(player, { x: ledge.x + ledge.width / 2, y: ledge.y - 1, vx: 0, vy: 240, grounded: false, platform: -1 });
		return stepClimber(player, 0, dt);
	}
	touchDown(3); const lowAltitude = player.altitude;
	touchDown(2); assert.ok(player.altitude > lowAltitude);
	assert.ok(player.visited.includes(3) && player.visited.includes(2));
	assert.equal(touchDown(CHECKPOINT), 'checkpoint');
	player.y = HEIGHT + 100; player.grounded = false;
	assert.equal(stepClimber(player, 0, dt), 'fall');
	assert.equal(player.platform, CHECKPOINT);
	assert.equal(touchDown(SUMMIT), 'summit'); assert.ok(player.won);
});

test('shots travel at 45 degrees in both facing directions without homing', () => {
	for (const facing of [-1, 1]) {
		const player = createClimber(); Object.assign(player, { x: 450, y: 100, facing, grounded: false, platform: -1 });
		useGrapple(player);
		const x = player.grapple.hookX, y = player.grapple.hookY;
		for (let i = 0; i < 5; i++) stepClimber(player, -facing, dt);
		assert.ok(Math.abs((player.grapple.hookX - x) * facing + player.grapple.hookY - y) < .00001);
		assert.equal(Math.sign(player.grapple.vx), facing, 'turning after launch cannot steer the hook');
		assert.equal(player.grapple.platform, -1);
	}
});

test('hooks attach at distinct collision locations instead of platform centers', () => {
	const offsets = [];
	for (const offset of [23, 54]) {
		const player = belowPlatform(1, offset); latch(player);
		assert.equal(player.grapple.platform, 1);
		assert.ok(player.grapple.offsetY >= 0 && player.grapple.offsetY <= 20);
		offsets.push(player.grapple.offsetX);
	}
	assert.ok(Math.abs(offsets[0] - offsets[1]) > 20);
});

test('a left-facing hook can latch onto the platform behind the route direction', () => {
	const player = belowPlatform(2, 50, -1); latch(player);
	assert.equal(player.grapple.platform, 2);
});

test('the first platform surface hit stops the projectile even across a long simulation step', () => {
	const player = belowPlatform(1, 40); useGrapple(player);
	assert.equal(stepClimber(player, 0, .18), 'latched');
	assert.equal(player.grapple.platform, 1);
	assert.equal(player.grapple.phase, 'swinging');
});

test('shots that miss all geometry expire and allow another shot', () => {
	const player = createClimber(); player.facing = -1; useGrapple(player);
	let missed = false;
	for (let i = 0; i < 100; i++) if (stepClimber(player, 0, dt) === 'miss') missed = true;
	assert.ok(missed); assert.equal(player.grapple, null);
	assert.equal(useGrapple(player), 'fired');
});

test('swinging follows the exact attachment offset on the moving platform', () => {
	const player = belowPlatform(2); latch(player);
	const offset = player.grapple.offsetX, positions = [];
	for (let frame = 0; frame < 600; frame++) {
		stepClimber(player, Math.floor(frame / 100) % 2 ? -1 : 1, dt);
		const anchor = getAnchor(player.grapple, player.elapsed);
		assert.equal(player.grapple.offsetX, offset);
		assert.equal(anchor.x, getLedges(player.elapsed)[2].x + offset);
		assert.ok(Math.hypot(player.x - anchor.x, player.y - 22 - anchor.y) <= player.grapple.length + .001);
		positions.push(player.x);
	}
	assert.ok(Math.max(...positions) - Math.min(...positions) > 40);
});

test('every ledge supports grappling and launching without snapping to its center', () => {
	for (let index = 0; index < ledges.length; index++) {
		const player = belowPlatform(index); latch(player);
		assert.equal(player.grapple.platform, index);
		const { x, y, vx, vy } = player;
		assert.equal(useGrapple(player), 'launched');
		assert.equal(player.grapple, null); assert.equal(player.platform, -1); assert.ok(!player.grounded);
		assert.deepEqual({ x: player.x, y: player.y, vx: player.vx, vy: player.vy }, { x, y, vx, vy });
	}
});

test('releasing preserves momentum and allows midair shots', () => {
	const player = belowPlatform(2); latch(player);
	for (let i = 0; i < 30; i++) stepClimber(player, 1, dt);
	const vx = player.vx, vy = player.vy; releaseGrapple(player);
	assert.equal(player.vx, vx); assert.equal(player.vy, vy); assert.equal(player.grapple, null);
	assert.equal(useGrapple(player), 'fired');
});

test('holding Up retracts the rope and pulls the climber toward the attachment', () => {
	const player = belowPlatform(2); latch(player);
	const initialLength = player.grapple.length;
	for (let i = 0; i < 30; i++) stepClimber(player, 0, dt, -1);
	assert.ok(Math.abs(player.grapple.length - (initialLength - 22.5)) < .001);
	const anchor = getAnchor(player.grapple, player.elapsed);
	assert.ok(Math.hypot(player.x - anchor.x, player.y - 22 - anchor.y) <= player.grapple.length + .001);
	assert.equal(player.grapple.phase, 'swinging');
});

test('holding Down extends the rope without releasing it, and length is bounded', () => {
	const player = belowPlatform(8); latch(player);
	const initialLength = player.grapple.length;
	for (let i = 0; i < 30; i++) stepClimber(player, 0, dt, 1);
	assert.ok(Math.abs(player.grapple.length - initialLength - 22.5) < .001);
	for (let i = 0; i < 700; i++) stepClimber(player, 0, dt, 1);
	assert.equal(player.grapple.length, 420);
	for (let i = 0; i < 700; i++) stepClimber(player, 0, dt, -1);
	assert.equal(player.grapple.length, 25);
	assert.equal(player.grapple.phase, 'swinging');
});

test('launching after reeling preserves the resulting swing velocity and allows another shot', () => {
	const player = belowPlatform(2); latch(player);
	const length = player.grapple.length;
	for (let i = 0; i < 30; i++) stepClimber(player, 1, dt, 0);
	assert.equal(player.grapple.length, length);
	for (let i = 0; i < 30; i++) stepClimber(player, 1, dt, -1);
	const vx = player.vx, vy = player.vy;
	assert.equal(useGrapple(player), 'launched');
	assert.equal(player.vx, vx); assert.equal(player.vy, vy); assert.equal(player.grapple, null);
	assert.equal(useGrapple(player), 'fired');
});

test('launch follows the actual swing momentum in either direction, regardless of facing', () => {
	for (const direction of [-1, 1]) {
		for (const frames of [15, 45, 90, 150]) {
			const player = belowPlatform(2); latch(player);
			for (let i = 0; i < frames; i++) stepClimber(player, direction, dt);
			const { x, y, vx, vy } = player;
			player.facing = -Math.sign(vx);
			assert.equal(useGrapple(player), 'launched');
			for (let i = 0; i < 5; i++) stepClimber(player, 0, dt);
			assert.ok(Math.abs(player.x - (x + vx * dt * 5)) < .00001);
			assert.ok(Math.abs(player.y - (y + vy * dt * 5 + 1050 * dt * dt * 15)) < .00001);
			assert.equal(player.vx, vx);
		}
	}
});

test('a second press during hook flight does not prematurely launch or jump', () => {
	const player = createClimber(); useGrapple(player); stepClimber(player, 0, dt);
	assert.equal(useGrapple(player), undefined); assert.equal(player.grapple.phase, 'flying');
	assert.equal(player.y, 702);
});

test('moving ledges carry riders while resting points remain stationary', () => {
	for (const index of [0, CHECKPOINT, SUMMIT]) assert.deepEqual(getLedges(0)[index], getLedges(2)[index]);
	const player = createClimber(), platform = getLedges(0)[2];
	Object.assign(player, { x: platform.x + 25, y: platform.y, platform: 2 });
	for (let frame = 0; frame < 1800; frame++) {
		stepClimber(player, 0, dt);
		assert.equal(player.platform, 2);
		assert.ok(Math.abs(player.x - getLedges(player.elapsed)[2].x - 25) < .0001);
		assert.ok(Math.abs(player.y - getLedges(player.elapsed)[2].y) < .0001);
	}
});

test('the climber can walk off a moving platform instead of sticking to its edge', () => {
	const player = createClimber();
	for (let i = 0; i < 100; i++) stepClimber(player, 1, dt);
	assert.ok(player.x > ledges[0].x + ledges[0].width + 7);
	assert.equal(player.platform, -1);
});

test('jumping inherits the moving platform velocity', () => {
	const player = createClimber(), ledge = getLedges(0)[2], next = getLedges(dt)[2];
	Object.assign(player, { x: ledge.x + 30, y: ledge.y, platform: 2 });
	jump(player); stepClimber(player, 0, dt);
	assert.ok(Math.abs(player.vx - (next.x - ledge.x) / dt) < .0001);
	assert.ok(Math.abs(player.vy - (-460 + (next.y - ledge.y) / dt + 1050 * dt)) < .0001);
});

test('a moving platform catches a descending climber at the swept top surface', () => {
	const player = createClimber(), ledge = getLedges(0)[2];
	Object.assign(player, { x: ledge.x + 30, y: ledge.y - .1, vy: 20, grounded: false, platform: -1 });
	stepClimber(player, 0, dt);
	assert.equal(player.platform, 2);
	assert.equal(player.y, getLedges(player.elapsed)[2].y);
});

test('falling and restarting clear grapple and jump state', () => {
	for (const checkpoint of [0, 4]) {
		const player = createClimber();
		Object.assign(player, { checkpoint, y: HEIGHT + 70, grounded: false, platform: -1, coyote: 0 });
		useGrapple(player); jump(player);
		assert.equal(stepClimber(player, 0, dt), 'fall');
		assert.equal(player.platform, checkpoint); assert.equal(player.grapple, null); assert.equal(player.jumpBuffer, 0);
	}
	assert.equal(createClimber().grapple, null);
});

test('winning freezes physics and ignores jump and hook inputs', () => {
	const player = createClimber(); player.won = true;
	const before = { ...player }; jump(player); useGrapple(player); stepClimber(player, 1, dt);
	assert.deepEqual(player, before);
});
