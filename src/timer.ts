import { Events } from 'obsidian';
import { TimerState, Session } from './types';
import { Store } from './store';

export class Timer extends Events {
	private state: TimerState = { status: 'idle', projectId: null, startTime: null };
	private store: Store;
	private persistState: (state: TimerState) => Promise<void>;

	constructor(store: Store, persistState: (state: TimerState) => Promise<void>) {
		super();
		this.store = store;
		this.persistState = persistState;
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
			await this.stop();
		}
		this.state = {
			status: 'running',
			projectId,
			startTime: new Date().toISOString(),
		};
		await this.persistState(this.state);
		this.trigger('change');
	}

	async stop(): Promise<void> {
		if (this.state.status === 'idle' || !this.state.projectId || !this.state.startTime) {
			return;
		}
		const session: Session = {
			project: this.state.projectId,
			start: this.state.startTime,
			end: new Date().toISOString(),
		};
		await this.store.addSession(session);
		this.state = { status: 'idle', projectId: null, startTime: null };
		await this.persistState(this.state);
		this.trigger('change');
	}

	async discard(): Promise<void> {
		this.state = { status: 'idle', projectId: null, startTime: null };
		await this.persistState(this.state);
		this.trigger('change');
	}

}
