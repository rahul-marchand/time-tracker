import { Events } from 'obsidian';
import { TimerState } from './types';
import { Store } from './store';

export class Timer extends Events {
	private state: TimerState = { status: 'idle', projectId: null, startTime: null };

	constructor(
		private store: Store,
		private persistState: (state: TimerState) => Promise<void>,
	) {
		super();
	}

	load(state: TimerState): void {
		this.state = state;
	}

	get status(): 'idle' | 'running' {
		return this.state.status;
	}

	get projectId(): string | null {
		return this.state.projectId;
	}

	get startTime(): Date | null {
		return this.state.startTime ? new Date(this.state.startTime) : null;
	}

	get elapsed(): number {
		if (this.state.status === 'idle' || !this.state.startTime) return 0;
		return Date.now() - new Date(this.state.startTime).getTime();
	}

	async start(projectId: string): Promise<void> {
		if (this.state.status === 'running') {
			if (this.state.projectId === projectId) return;
			await this.stop();
		}
		this.state = { status: 'running', projectId, startTime: new Date().toISOString() };
		this.trigger('change');
		await this.persistState(this.state);
	}

	async stop(): Promise<void> {
		const { status, projectId, startTime } = this.state;
		if (status === 'idle' || !projectId || !startTime) return;
		// Flip state and notify before awaiting, so the UI responds at once and a second call is a no-op
		this.state = { status: 'idle', projectId: null, startTime: null };
		this.trigger('change');
		await this.persistState(this.state);
		await this.store.addSession({ project: projectId, start: startTime, end: new Date().toISOString() });
	}

	async discard(): Promise<void> {
		this.state = { status: 'idle', projectId: null, startTime: null };
		this.trigger('change');
		await this.persistState(this.state);
	}
}
