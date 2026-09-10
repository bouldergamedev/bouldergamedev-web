export const bindings = {
	ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
	ArrowUp: 'up', ArrowDown: 'down', Space: 'hook', KeyS: 'release',
} as const;
export const help = {
	ready: '← → / A D move · ↑ jump · Space fires 45° forward · Space again to launch.',
	swinging: '← → / A D swing · ↑ retract / ↓ extend cable · Space launch · S release.',
};
export const touchHelp = {
	ready: 'Hold ← → to move · ↑ to jump · A fires a hook 45° forward; tap A again to launch.',
	swinging: 'Hold ← → to swing · ↑ pulls cable in / ↓ lets it out · A launches you.',
};
export const description = `${help.ready} While attached: ${help.swinging} Hooks attach wherever they hit a platform. Reach the summit flag; falls return you to the starting point.`;
