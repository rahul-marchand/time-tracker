export interface Project {
	id: string;
	name: string;
	color: string;
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
	{ id: 'work', name: 'Work', color: '#5f8eed' },
	{ id: 'personal', name: 'Personal', color: '#50c878' },
];
