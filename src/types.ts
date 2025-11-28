export interface Project {
	id: string;
	name: string;
	color: string;
	icon: string;
}

export interface Session {
	project: string;
	start: string;
	end: string;
}

export interface TimeData {
	projects: Project[];
	sessions: Session[];
}

export interface TimerState {
	status: 'idle' | 'running';
	projectId: string | null;
	startTime: string | null;
}

export interface TimeTrackerSettings {
	timerState: TimerState;
}

export const DEFAULT_SETTINGS: TimeTrackerSettings = {
	timerState: { status: 'idle', projectId: null, startTime: null },
};

export const DEFAULT_PROJECTS: Project[] = [
	{ id: 'work', name: 'Work', color: '#5f8eed', icon: 'briefcase' },
	{ id: 'personal', name: 'Personal', color: '#50c878', icon: 'home' },
];

export const AVAILABLE_ICONS = [
	'briefcase', 'home', 'book', 'code', 'coffee', 'heart', 'star', 'folder',
	'file-text', 'music', 'camera', 'globe', 'zap', 'sun', 'moon', 'cloud',
	'pen-tool', 'cpu', 'database', 'terminal', 'graduation-cap', 'dumbbell',
	'bike', 'car', 'plane', 'shopping-cart', 'dollar-sign', 'clock', 'calendar',
	'mail', 'phone', 'map-pin', 'users', 'user', 'settings', 'wrench',
];
