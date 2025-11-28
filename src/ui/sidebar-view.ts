import { ItemView, WorkspaceLeaf, Menu, setIcon, Modal, Setting } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { Session } from '../types';
import type TimeTrackerPlugin from '../main';

export const VIEW_TYPE = 'time-tracker-sidebar';

type Tab = 'timer' | 'analytics';
type AnalyticsMode = 'week' | 'month';

export class SidebarView extends ItemView {
	private timer: Timer;
	private store: Store;
	private plugin: TimeTrackerPlugin;
	private interval: number | null = null;
	private activeTab: Tab = 'timer';
	private analyticsMode: AnalyticsMode = 'week';

	constructor(leaf: WorkspaceLeaf, timer: Timer, store: Store, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.timer = timer;
		this.store = store;
		this.plugin = plugin;
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
				btn.style.setProperty('--icon-color', this.getContrastColor(project.color));

				const icon = btn.createDiv('project-btn-icon');
				setIcon(icon, project.icon || 'play');

				const content = btn.createDiv('project-btn-content');
				content.createSpan('project-btn-name').setText(project.name);

				const addBtn = content.createDiv('project-btn-add');
				setIcon(addBtn, 'plus');
				addBtn.onClickEvent((e) => {
					e.stopPropagation();
					new QuickAddModal(this.app, this.store, project.id, project.name, () => this.render()).open();
				});

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

		this.renderChart(view);
		this.renderStats(view);
		this.renderProjectSummary(view);
	}

	private renderChart(container: HTMLElement): void {
		const section = container.createDiv('analytics-section');

		const sessions = this.analyticsMode === 'week'
			? this.store.getWeekSessions()
			: this.store.getMonthSessions();
		const totalMs = this.store.getTotalTime(sessions);

		const header = section.createDiv('analytics-header');

		// Toggle in header
		const toggle = header.createDiv('analytics-toggle');
		const weekBtn = toggle.createEl('button', { cls: 'toggle-btn', text: 'W' });
		if (this.analyticsMode === 'week') weekBtn.addClass('active');
		weekBtn.onClickEvent(() => { this.analyticsMode = 'week'; this.render(); });

		const monthBtn = toggle.createEl('button', { cls: 'toggle-btn', text: 'M' });
		if (this.analyticsMode === 'month') monthBtn.addClass('active');
		monthBtn.onClickEvent(() => { this.analyticsMode = 'month'; this.render(); });

		header.createSpan('analytics-total').setText(this.formatTimeHM(totalMs));

		const dailyData = this.analyticsMode === 'week'
			? this.getWeekDailyData()
			: this.getMonthDailyData();
		const maxMs = Math.max(...dailyData.map(d => d.total), 1);

		const chart = section.createDiv('week-chart');

		dailyData.forEach((day) => {
			const bar = chart.createDiv('week-bar');
			if (day.isToday) bar.addClass('today');

			const stack = bar.createDiv('week-bar-stack');
			stack.dataset.tooltip = this.formatTimeHM(day.total);

			// Stacked segments by project
			const heightPercent = (day.total / maxMs) * 100;
			stack.style.height = `${Math.max(heightPercent, day.total > 0 ? 4 : 2)}%`;

			if (day.total > 0) {
				for (const seg of day.projects) {
					const segment = stack.createDiv('stack-segment');
					segment.style.height = `${(seg.time / day.total) * 100}%`;
					segment.style.backgroundColor = seg.color;
				}
			}

			bar.createDiv('week-bar-label').setText(day.label);
		});
	}

	private renderStats(container: HTMLElement): void {
		const section = container.createDiv('analytics-section stats-section');

		const sessions = this.analyticsMode === 'week'
			? this.store.getWeekSessions()
			: this.store.getMonthSessions();
		const totalMs = this.store.getTotalTime(sessions);
		const daysInPeriod = this.analyticsMode === 'week' ? 7 : new Date().getDate();
		const avgMs = totalMs / daysInPeriod;
		const targetMs = this.plugin.settings.streakTargetMins * 60 * 1000;
		const streak = this.store.getStreak(targetMs);

		const stats = section.createDiv('stats-grid');

		const avgStat = stats.createDiv('stat-item');
		avgStat.createDiv('stat-value').setText(this.formatTimeHM(avgMs));
		avgStat.createDiv('stat-label').setText('Daily Avg');

		const streakStat = stats.createDiv('stat-item');
		streakStat.createDiv('stat-value').setText(`${streak}`);
		streakStat.createDiv('stat-label').setText(streak === 1 ? 'Day Streak' : 'Days Streak');
	}

	private renderProjectSummary(container: HTMLElement): void {
		const section = container.createDiv('analytics-section');

		const header = section.createDiv('analytics-header');
		header.createSpan('analytics-label').setText('By Project');

		const sessions = this.analyticsMode === 'week'
			? this.store.getWeekSessions()
			: this.store.getMonthSessions();
		const totalMs = this.store.getTotalTime(sessions);

		if (sessions.length === 0) {
			section.createDiv('analytics-empty').setText('No data');
			return;
		}

		const byProject = this.groupByProject(sessions);
		const breakdown = section.createDiv('project-breakdown');

		const sorted = Object.entries(byProject)
			.map(([id, s]) => ({ id, time: this.store.getTotalTime(s) }))
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

	private getWeekDailyData(): { label: string; total: number; isToday: boolean; projects: { color: string; time: number }[] }[] {
		const today = new Date();
		const dayOfWeek = (today.getDay() + 6) % 7;
		const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
		const result: { label: string; total: number; isToday: boolean; projects: { color: string; time: number }[] }[] = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() - dayOfWeek + i);
			date.setHours(0, 0, 0, 0);

			const nextDate = new Date(date);
			nextDate.setDate(date.getDate() + 1);

			const sessions = this.store.getSessionsInRange(date, nextDate);
			const total = this.store.getTotalTime(sessions);
			const projects = this.getProjectBreakdown(sessions);

			result.push({ label: days[i], total, isToday: i === dayOfWeek, projects });
		}

		return result;
	}

	private getMonthDailyData(): { label: string; total: number; isToday: boolean; projects: { color: string; time: number }[] }[] {
		const today = new Date();
		const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
		const result: { label: string; total: number; isToday: boolean; projects: { color: string; time: number }[] }[] = [];

		for (let i = 1; i <= daysInMonth; i++) {
			const date = new Date(today.getFullYear(), today.getMonth(), i);
			const nextDate = new Date(today.getFullYear(), today.getMonth(), i + 1);

			const sessions = this.store.getSessionsInRange(date, nextDate);
			const total = this.store.getTotalTime(sessions);
			const projects = this.getProjectBreakdown(sessions);

			result.push({ label: i.toString(), total, isToday: i === today.getDate(), projects });
		}

		return result;
	}

	private getProjectBreakdown(sessions: Session[]): { color: string; time: number }[] {
		const byProject = this.groupByProject(sessions);
		return Object.entries(byProject)
			.map(([id, s]) => ({
				color: this.store.getProject(id)?.color ?? '#888',
				time: this.store.getTotalTime(s)
			}))
			.sort((a, b) => b.time - a.time);
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

	private getContrastColor(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#2e2e2e' : '#ffffff';
	}
}

class QuickAddModal extends Modal {
	private store: Store;
	private projectId: string;
	private projectName: string;
	private onSave: () => void;
	private minutes = 30;

	constructor(app: import('obsidian').App, store: Store, projectId: string, projectName: string, onSave: () => void) {
		super(app);
		this.store = store;
		this.projectId = projectId;
		this.projectName = projectName;
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('quick-add-modal');

		contentEl.createEl('h3', { text: `Add time to ${this.projectName}` });

		new Setting(contentEl)
			.setName('Minutes')
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.setValue('30');
				text.onChange(v => this.minutes = parseInt(v) || 30);
				text.inputEl.focus();
				text.inputEl.select();
			});

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText('Add');
				btn.setCta();
				btn.onClick(() => this.save());
			});
	}

	private async save(): Promise<void> {
		const end = new Date();
		const start = new Date(end.getTime() - this.minutes * 60 * 1000);

		await this.store.addSession({
			project: this.projectId,
			start: start.toISOString(),
			end: end.toISOString(),
		});

		this.onSave();
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
