import { ItemView, WorkspaceLeaf, Menu } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { Session } from '../types';

export const VIEW_TYPE = 'time-tracker-sidebar';

type Tab = 'timer' | 'analytics';

export class SidebarView extends ItemView {
	private timer: Timer;
	private store: Store;
	private interval: number | null = null;
	private activeTab: Tab = 'timer';

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
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('time-tracker-sidebar');

		this.renderTabs(container);

		if (this.activeTab === 'timer') {
			this.renderTimerView(container);
		} else {
			this.renderAnalyticsView(container);
		}
	}

	private renderTabs(container: HTMLElement): void {
		const tabs = container.createDiv('sidebar-tabs');

		const timerTab = tabs.createDiv('sidebar-tab');
		timerTab.setText('Timer');
		if (this.activeTab === 'timer') timerTab.addClass('active');
		timerTab.onClickEvent(() => {
			this.activeTab = 'timer';
			this.render();
		});

		const analyticsTab = tabs.createDiv('sidebar-tab');
		analyticsTab.setText('Analytics');
		if (this.activeTab === 'analytics') analyticsTab.addClass('active');
		analyticsTab.onClickEvent(() => {
			this.activeTab = 'analytics';
			this.render();
		});
	}

	private renderTimerView(container: HTMLElement): void {
		const view = container.createDiv('timer-view');
		this.renderTimer(view);
		this.renderToday(view);
	}

	private renderTimer(container: HTMLElement): void {
		const timerSection = container.createDiv('timer-section');

		if (this.timer.status === 'idle') {
			const projectList = timerSection.createDiv('project-buttons');
			for (const project of this.store.projects) {
				const btn = projectList.createEl('button', { cls: 'project-btn' });
				btn.style.setProperty('--project-color', project.color);

				const icon = btn.createDiv('project-btn-icon');
				icon.style.backgroundColor = project.color;
				icon.setText('▶');

				btn.createSpan('project-btn-name').setText(project.name);

				btn.onClickEvent(() => this.timer.start(project.id));
			}
		} else {
			const project = this.store.getProject(this.timer.projectId!);

			timerSection.addClass('running');
			timerSection.style.setProperty('--active-color', project?.color ?? '#888');

			const header = timerSection.createDiv('timer-active-header');
			header.createSpan('timer-active-label').setText('Tracking');
			header.createSpan('timer-active-project').setText(project?.name ?? 'Unknown');

			const display = timerSection.createDiv('timer-display');
			display.setText(this.formatTime(this.timer.elapsed));

			const actions = timerSection.createDiv('timer-actions');

			const stopBtn = actions.createEl('button', { cls: 'timer-btn stop' });
			stopBtn.createSpan('timer-btn-icon').setText('■');
			stopBtn.createSpan().setText('Stop');
			stopBtn.onClickEvent(() => this.timer.stop());

			const switchBtn = actions.createEl('button', { cls: 'timer-btn switch' });
			switchBtn.createSpan('timer-btn-icon').setText('↻');
			switchBtn.createSpan().setText('Switch');
			switchBtn.onClickEvent((evt) => this.showSwitchMenu(switchBtn, evt));
		}
	}

	private renderToday(container: HTMLElement): void {
		const todaySection = container.createDiv('today-section');

		const sessions = this.store.getTodaySessions();
		const totalMs = this.store.getTotalTime(sessions);
		const runningMs = this.timer.status === 'running' ? this.timer.elapsed : 0;
		const totalWithRunning = totalMs + runningMs;

		// Header with total
		const header = todaySection.createDiv('today-header');
		header.createSpan('today-label').setText('Today');
		header.createSpan('today-total').setText(this.formatTimeHM(totalWithRunning));

		// Progress bar
		const goalMs = 8 * 60 * 60 * 1000;
		const progress = Math.min(totalWithRunning / goalMs, 1);
		const progressBar = todaySection.createDiv('today-progress');
		const progressFill = progressBar.createDiv('today-progress-fill');
		progressFill.style.width = `${progress * 100}%`;

		// Only show breakdown when idle
		if (this.timer.status === 'idle') {
			const breakdown = todaySection.createDiv('today-breakdown');

			if (sessions.length === 0) {
				breakdown.createDiv('today-empty').setText('No sessions yet today');
			} else {
				const byProject = this.groupByProject(sessions);

				for (const [projectId, projectSessions] of Object.entries(byProject)) {
					const project = this.store.getProject(projectId);
					const time = this.store.getTotalTime(projectSessions);

					const row = breakdown.createDiv('today-row');
					const dot = row.createSpan('today-dot');
					dot.style.backgroundColor = project?.color ?? '#888';
					row.createSpan('today-name').setText(project?.name ?? projectId);
					row.createSpan('today-time').setText(this.formatTimeHM(time));
				}
			}
		}
	}

	private renderAnalyticsView(container: HTMLElement): void {
		const view = container.createDiv('analytics-view');

		// Week summary
		this.renderWeekChart(view);
		this.renderProjectBreakdown(view);
	}

	private renderWeekChart(container: HTMLElement): void {
		const section = container.createDiv('analytics-section');

		const weekSessions = this.store.getWeekSessions();
		const totalMs = this.store.getTotalTime(weekSessions);

		const header = section.createDiv('analytics-header');
		header.createSpan('analytics-label').setText('This Week');
		header.createSpan('analytics-total').setText(this.formatTimeHM(totalMs));

		// Get daily totals for the week
		const dailyTotals = this.getDailyTotals();
		const maxMs = Math.max(...dailyTotals.map(d => d.total), 1);

		const chart = section.createDiv('week-chart');
		const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

		dailyTotals.forEach((day, i) => {
			const bar = chart.createDiv('week-bar');
			const height = (day.total / maxMs) * 100;

			const fill = bar.createDiv('week-bar-fill');
			fill.style.height = `${Math.max(height, 2)}%`;
			if (day.isToday) fill.addClass('today');

			bar.createDiv('week-bar-label').setText(days[i]);
		});
	}

	private renderProjectBreakdown(container: HTMLElement): void {
		const section = container.createDiv('analytics-section');

		const header = section.createDiv('analytics-header');
		header.createSpan('analytics-label').setText('By Project');

		const weekSessions = this.store.getWeekSessions();
		const totalMs = this.store.getTotalTime(weekSessions);

		if (weekSessions.length === 0) {
			section.createDiv('analytics-empty').setText('No data this week');
			return;
		}

		const byProject = this.groupByProject(weekSessions);
		const breakdown = section.createDiv('project-breakdown');

		// Sort by time descending
		const sorted = Object.entries(byProject)
			.map(([id, sessions]) => ({ id, time: this.store.getTotalTime(sessions) }))
			.sort((a, b) => b.time - a.time);

		for (const { id, time } of sorted) {
			const project = this.store.getProject(id);
			const percent = totalMs > 0 ? (time / totalMs) * 100 : 0;

			const row = breakdown.createDiv('breakdown-row');

			const info = row.createDiv('breakdown-info');
			const dot = info.createSpan('breakdown-dot');
			dot.style.backgroundColor = project?.color ?? '#888';
			info.createSpan('breakdown-name').setText(project?.name ?? id);
			info.createSpan('breakdown-time').setText(this.formatTimeHM(time));

			const barContainer = row.createDiv('breakdown-bar');
			const barFill = barContainer.createDiv('breakdown-bar-fill');
			barFill.style.width = `${percent}%`;
			barFill.style.backgroundColor = project?.color ?? '#888';
		}
	}

	private getDailyTotals(): { total: number; isToday: boolean }[] {
		const today = new Date();
		const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0

		const result: { total: number; isToday: boolean }[] = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() - dayOfWeek + i);
			date.setHours(0, 0, 0, 0);

			const nextDate = new Date(date);
			nextDate.setDate(date.getDate() + 1);

			const sessions = this.store.getSessionsInRange(date, nextDate);
			const total = this.store.getTotalTime(sessions);

			result.push({
				total,
				isToday: i === dayOfWeek
			});
		}

		return result;
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
