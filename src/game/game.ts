import { createClimber, jump, releaseGrapple, STEP, stepClimber, useGrapple, type GameEvent } from './physics';
import { bindings, help } from './controls';
import { createRenderer } from './render';

const messages: Record<GameEvent, string> = {
	fired: 'Hook fired 45 degrees forward.', launched: 'Launched with your swing momentum. Space can fire another hook.',
	checkpoint: 'Checkpoint saved at the central cairn.', summit: 'Summit reached! Nice climb.',
	fall: 'Back at your checkpoint. Your hook is ready.', latched: `Hook attached. ${help.swinging}`, miss: 'Hook missed. Reposition or jump, then fire again.',
};
export function initGame(root: HTMLElement) {
	const canvas = root.querySelector('canvas')!, renderer = createRenderer(canvas);
	if (!renderer) return;
	const instructions = root.querySelector<HTMLElement>('#game-instructions')!, status = root.querySelector<HTMLElement>('[role="status"]')!;
	const summit = root.querySelector<HTMLElement>('.summit-message')!, replay = summit.querySelector('button')!;
	const motion = matchMedia('(prefers-reduced-motion: reduce)'), keys = new Set<string>();
	const codes = Object.entries(bindings), held = (action: string) => codes.some(([code, name]) => name === action && keys.has(code));
	let player = createClimber(), visible = false, frame = 0, last = 0, elapsed = 0, painted = 0;
	const clearInput = () => { keys.clear(); player.jumpBuffer = 0; };
	function updateUI(event?: GameEvent) {
		const text = player.grapple?.phase === 'swinging' ? help.swinging : help.ready;
		if (instructions.textContent !== text) instructions.textContent = text;
		if (event) status.textContent = messages[event];
		if (event === 'summit') { summit.hidden = false; clearInput(); replay.focus({ preventScroll: true }); }
	}
	function tick(now: number) {
		frame = 0;
		elapsed += last ? Math.min((now - last) / 1000, .05) : 0; last = now;
		while (elapsed >= STEP && !player.won) {
			const event = stepClimber(player, Number(held('right')) - Number(held('left')), STEP, Number(held('down')) - Number(held('up')));
			if (event) updateUI(event);
			elapsed -= STEP;
		}
		if (player.won || now - painted >= 1000 / 60) { renderer!.draw(player, motion.matches); painted = now - (now - painted) % (1000 / 60); }
		if (!player.won) frame = requestAnimationFrame(tick);
	}
	function sync() {
		cancelAnimationFrame(frame); frame = last = elapsed = 0; clearInput();
		if (visible && !document.hidden && !player.won) frame = requestAnimationFrame(tick);
	}
	const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
	observer.observe(canvas);
	const resize = new ResizeObserver(() => { renderer!.resize(); renderer!.draw(player, motion.matches); });
	resize.observe(canvas);
	window.addEventListener('keydown', event => {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (![canvas, document.body, document.documentElement].includes(event.target as HTMLElement) || !visible || player.won) return;
		const action = bindings[event.code as keyof typeof bindings];
		if (!action) return;
		event.preventDefault(); keys.add(event.code);
		if (event.repeat) return;
		if (action === 'up' && player.grapple?.phase !== 'swinging') jump(player);
		if (action === 'hook') {
			if (held('left') !== held('right')) player.facing = held('left') ? -1 : 1;
			updateUI(useGrapple(player));
		}
		if (action === 'release' && player.grapple) { releaseGrapple(player); updateUI(); status.textContent = 'Hook released.'; }
	});
	window.addEventListener('keyup', event => keys.delete(event.code));
	window.addEventListener('blur', clearInput);
	canvas.addEventListener('blur', clearInput);
	canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
	document.addEventListener('visibilitychange', sync);
	motion.addEventListener('change', () => renderer.draw(player, motion.matches));
	replay.addEventListener('click', () => {
		player = createClimber(); summit.hidden = true; updateUI(); status.textContent = 'Climb restarted.';
		canvas.focus({ preventScroll: true }); sync();
	});
	renderer.resize(); renderer.draw(player, motion.matches);
}
