export const bindings = {
	ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
	ArrowUp: 'up', ArrowDown: 'down', Space: 'hook', KeyS: 'release',
} as const;
export const help = {
	ready: '← → / A D move · ↑ jump · Space fires 45° forward · Space again to launch.',
	swinging: '← → / A D swing · ↑ retract / ↓ extend cable · Space launch · S release.',
};
export const description = `${help.ready} While attached: ${help.swinging} Hooks attach wherever they hit a platform. Reach the summit flag; falls return you to the checkpoint.`;
