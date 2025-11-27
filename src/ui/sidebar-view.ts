import { ItemView, WorkspaceLeaf, Menu } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { Session } from '../types';

export const VIEW_TYPE = 'time-tracker-sidebar';

export class SidebarView extends ItemView {
	private timer: Timer;
	private store: Store;
	private interval: number | null = null;

	constructor(leaf: WorkspaceLeaf, timer: Timer, store: Store) {
		super(leaf);
		this.timer = timer;
		this.store = store;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Time Tracker';
	}

	getIcon(): string {
		return 'clock';
	}

	async onOpen(): Promise<void> {
		this.timer.on('change', () => this.render());
		this.startInterval();
		this.render();
	}

	async onClose(): Promise<void> {
		if (this.interval) window.clearInterval(this.interval);
	}

	private startInterval(): void {
		this.interval = window.setInterval(() => {
			if (this.timer.status === 'running') this.render();
		}, 1000);
	}

	private render(): void {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('time-tracker-sidebar');

		this.renderTimer(container as HTMLElement);
		this.renderToday(container as HTMLElement);
	}

	private renderTimer(container: HTMLElement): void {
		const timerSection = container.createDiv('timer-section');

		if (this.timer.status === 'idle') {
			timerSection.createDiv('timer-idle-text').setText('No timer running');

			const projectList = timerSection.createDiv('timer-project-list');
			for (const project of this.store.projects) {
				const btn = projectList.createEl('button', { cls: 'timer-start-btn' });
				const dot = btn.createSpan('color-dot');
				dot.style.backgroundColor = project.color;
				btn.createSpan().setText(project.name);
				btn.onClickEvent(() => this.timer.start(project.id));
			}
		} else {
			const project = this.store.getProject(this.timer.projectId!);

			const header = timerSection.createDiv('timer-header');
			const dot = header.createSpan('color-dot large');
			dot.style.backgroundColor = project?.color ?? '#888';
			header.createSpan('timer-project-name').setText(project?.name ?? 'Unknown');

			const display = timerSection.createDiv('timer-display');
			display.setText(this.formatTime(this.timer.elapsed));
			display.addClass('running');

			const actions = timerSection.createDiv('timer-actions');

			const stopBtn = actions.createEl('button', { text: 'Stop', cls: 'mod-warning' });
			stopBtn.onClickEvent(() => this.timer.stop());

			const switchBtn = actions.createEl('button', { text: 'Switch' });
			switchBtn.onClickEvent((evt) => this.showSwitchMenu(switchBtn, evt));
		}
	}

	private renderToday(container: HTMLElement): void {
		const todaySection = container.createDiv('today-section');
		todaySection.createEl('h3', { text: 'Today' });

		const sessions = this.store.getTodaySessions();
		const totalMs = this.store.getTotalTime(sessions);

		// Add current running time if active
		const runningMs = this.timer.status === 'running' ? this.timer.elapsed : 0;
		const totalWithRunning = totalMs + runningMs;

		// Progress bar
		const goalMs = 8 * 60 * 60 * 1000; // 8 hours default goal
		const progress = Math.min(totalWithRunning / goalMs, 1);

		const progressContainer = todaySection.createDiv('progress-container');
		const progressBar = progressContainer.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		progressFill.style.width = `${progress * 100}%`;

		const progressText = progressContainer.createDiv('progress-text');
		progressText.setText(this.formatTimeHM(totalWithRunning));

		// Timeline
		if (sessions.length === 0 && this.timer.status === 'idle') {
			todaySection.createDiv('no-sessions').setText('No sessions yet');
		} else {
			const timeline = todaySection.createDiv('timeline');

			// Group sessions by project for summary
			const byProject = this.groupByProject(sessions);

			for (const [projectId, projectSessions] of Object.entries(byProject)) {
				const project = this.store.getProject(projectId);
				const time = this.store.getTotalTime(projectSessions);

				const row = timeline.createDiv('timeline-row');
				const dot = row.createSpan('color-dot');
				dot.style.backgroundColor = project?.color ?? '#888';
				row.createSpan('timeline-name').setText(project?.name ?? projectId);
				row.createSpan('timeline-time').setText(this.formatTimeHM(time));
			}

			// Show running session
			if (this.timer.status === 'running') {
				const project = this.store.getProject(this.timer.projectId!);
				const row = timeline.createDiv('timeline-row current');
				const dot = row.createSpan('color-dot pulse');
				dot.style.backgroundColor = project?.color ?? '#888';
				row.createSpan('timeline-name').setText(project?.name ?? 'Unknown');
				row.createSpan('timeline-time').setText(this.formatTimeHM(this.timer.elapsed));
			}
		}
	}

	private showSwitchMenu(anchor: HTMLElement, evt: MouseEvent): void {
		const menu = new Menu();

		for (const project of this.store.projects) {
			if (project.id === this.timer.projectId) continue;

			menu.addItem((item) => {
				item.setTitle(project.name);
				item.onClick(() => this.timer.start(project.id));
			});
		}

		menu.showAtMouseEvent(evt);
	}

	private groupByProject(sessions: Session[]): Record<string, Session[]> {
		const result: Record<string, Session[]> = {};
		for (const s of sessions) {
			(result[s.project] ??= []).push(s);
		}
		return result;
	}

	private formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
	}

	private formatTimeHM(ms: number): string {
		const mins = Math.round(ms / 60000);
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}
}
