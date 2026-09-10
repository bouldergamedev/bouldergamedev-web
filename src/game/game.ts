import { createClimber, jump, releaseGrapple, STEP, stepClimber, useGrapple, type GameEvent } from './physics';
import { bindings, help, touchHelp } from './controls';
import { createRenderer } from './render';

const messages: Record<GameEvent, string> = {
	fired: 'Hook fired 45 degrees forward.', launched: 'Launched with your swing momentum. Your hook is ready again.',
	summit: 'Great climb! Play again?',
	fall: 'Back at the starting point. Your hook is ready.', latched: `Hook attached. ${help.swinging}`, miss: 'Hook missed. Reposition or jump, then fire again.',
};
export function initGame(root: HTMLElement) {
	const canvas = root.querySelector('canvas')!, renderer = createRenderer(canvas);
	if (!renderer) return;
	const instructions = root.querySelector<HTMLElement>('#game-instructions')!, status = root.querySelector<HTMLElement>('[role="status"]')!;
	const summit = root.querySelector<HTMLElement>('.summit-message')!, replay = summit.querySelector('button')!;
	const motion = matchMedia('(prefers-reduced-motion: reduce)'), keys = new Set<string>();
	const touchLayout = matchMedia('(max-width: 720px), (pointer: coarse)');
	type Action = typeof bindings[keyof typeof bindings];
	const buttons = root.querySelectorAll<HTMLButtonElement>('[data-action]');
	const pointers = new Map<number, { action: Action; button: HTMLButtonElement }>();
	const codes = Object.entries(bindings), held = (action: string) => codes.some(([code, name]) => name === action && keys.has(code)) || [...pointers.values()].some(input => input.action === action);
	let player = createClimber(), visible = false, frame = 0, last = 0, elapsed = 0, painted = 0;
	const clearInput = () => { keys.clear(); pointers.clear(); buttons.forEach(button => button.classList.remove('is-held')); player.jumpBuffer = 0; };
	function updateUI(event?: GameEvent) {
		const hints = touchLayout.matches ? touchHelp : help;
		const text = player.grapple?.phase === 'swinging' ? hints.swinging : hints.ready;
		if (instructions.textContent !== text) instructions.textContent = text;
		if (event) status.textContent = event === 'latched' ? `Hook attached. ${hints.swinging}` : messages[event];
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
	function activate(action: Action) {
		if (action === 'up' && player.grapple?.phase !== 'swinging') jump(player);
		if (action === 'hook') {
			if (held('left') !== held('right')) player.facing = held('left') ? -1 : 1;
			updateUI(useGrapple(player));
		}
		if (action === 'release' && player.grapple) { releaseGrapple(player); updateUI(); status.textContent = 'Hook released.'; }
	}
	buttons.forEach(button => {
		const action = button.dataset.action as Action;
		button.addEventListener('pointerdown', event => {
			if (event.button !== 0 || !visible || player.won) return;
			event.preventDefault();
			canvas.focus({ preventScroll: true });
			button.setPointerCapture(event.pointerId);
			pointers.set(event.pointerId, { action, button });
			button.classList.add('is-held');
			activate(action);
		});
		const release = (event: PointerEvent) => {
			pointers.delete(event.pointerId);
			if (![...pointers.values()].some(input => input.button === button)) button.classList.remove('is-held');
		};
		button.addEventListener('pointerup', release);
		button.addEventListener('pointercancel', release);
		button.addEventListener('lostpointercapture', release);
		button.addEventListener('contextmenu', event => event.preventDefault());
		button.addEventListener('click', event => {
			if (event.detail === 0 && visible && !player.won) activate(action);
		});
	});
	window.addEventListener('keydown', event => {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (![canvas, document.body, document.documentElement].includes(event.target as HTMLElement) || !visible || player.won) return;
		const action = bindings[event.code as keyof typeof bindings];
		if (!action) return;
		event.preventDefault(); keys.add(event.code);
		if (!event.repeat) activate(action);
	});
	window.addEventListener('keyup', event => keys.delete(event.code));
	window.addEventListener('blur', clearInput);
	canvas.addEventListener('blur', clearInput);
	canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
	document.addEventListener('visibilitychange', sync);
	motion.addEventListener('change', () => renderer.draw(player, motion.matches));
	touchLayout.addEventListener('change', () => { clearInput(); updateUI(); });
	replay.addEventListener('click', () => {
		player = createClimber(); summit.hidden = true; updateUI(); status.textContent = 'Climb restarted.';
		canvas.focus({ preventScroll: true }); sync();
	});
	updateUI(); renderer.resize(); renderer.draw(player, motion.matches);
}
