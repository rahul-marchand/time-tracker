import { Store } from '../store';
import { Session } from '../types';
import { formatHM, groupByProject, clampedDuration } from '../utils';

type AnalyticsMode = 'week' | 'month';

interface DayData {
	label: string;
	total: number;
	isToday: boolean;
	projects: { color: string; time: number }[];
}

export class AnalyticsSection {
	constructor(private store: Store) {}

	render(container: HTMLElement, mode: AnalyticsMode, onModeChange: (m: AnalyticsMode) => void): void {
		const view = container.createDiv('analytics-view');
		this.renderChart(view, mode, onModeChange);
		this.renderStats(view, mode);
		this.renderProjectSummary(view, mode);
	}

	private renderChart(container: HTMLElement, mode: AnalyticsMode, onModeChange: (m: AnalyticsMode) => void): void {
		const section = container.createDiv('analytics-section');

		const { start: periodStart, end: periodEnd } = this.getPeriodRange(mode);
		const sessions = this.getSessions(mode);
		const totalMs = this.store.getTotalTimeInRange(sessions, periodStart, periodEnd);

		const header = section.createDiv('analytics-header');

		const toggle = header.createDiv('analytics-toggle');
		const weekBtn = toggle.createEl('button', { cls: 'toggle-btn', text: 'W' });
		if (mode === 'week') weekBtn.addClass('active');
		weekBtn.onClickEvent(() => onModeChange('week'));

		const monthBtn = toggle.createEl('button', { cls: 'toggle-btn', text: 'M' });
		if (mode === 'month') monthBtn.addClass('active');
		monthBtn.onClickEvent(() => onModeChange('month'));

		header.createSpan('analytics-total').setText(formatHM(totalMs));

		const dailyData = mode === 'week' ? this.getWeekDailyData() : this.getMonthDailyData();
		const maxMs = Math.max(...dailyData.map(d => d.total), 1);

		const chart = section.createDiv('week-chart');
		if (mode === 'month') chart.addClass('week-chart--month');

		for (const day of dailyData) {
			const col = chart.createDiv('week-col');

			const bar = col.createDiv('week-bar');
			bar.dataset.tooltip = formatHM(day.total);

			const stack = bar.createDiv('week-bar-stack');
			const heightPercent = (day.total / maxMs) * 100;
			stack.style.height = `${Math.max(heightPercent, day.total > 0 ? 4 : 2)}%`;

			if (day.total > 0) {
				for (const seg of day.projects) {
					const segment = stack.createDiv('stack-segment');
					segment.style.height = `${(seg.time / day.total) * 100}%`;
					segment.style.backgroundColor = seg.color;
				}
			}

			const lbl = col.createDiv('week-label');
			if (day.isToday) lbl.addClass('today');
			lbl.setText(day.label);
		}
	}

	private renderStats(container: HTMLElement, mode: AnalyticsMode): void {
		const section = container.createDiv('analytics-section stats-section');

		const { start: periodStart, end: periodEnd } = this.getPeriodRange(mode);
		const sessions = this.getSessions(mode);
		const totalMs = this.store.getTotalTimeInRange(sessions, periodStart, periodEnd);
		const today = new Date();
		const daysInPeriod = mode === 'week'
			? ((today.getDay() + 6) % 7) + 1
			: today.getDate();
		const avgMs = totalMs / daysInPeriod;

		const stats = section.createDiv('stats-grid');

		const avgStat = stats.createDiv('stat-item');
		avgStat.createDiv('stat-value').setText(formatHM(avgMs));
		avgStat.createDiv('stat-label').setText('Daily Avg');
	}

	private renderProjectSummary(container: HTMLElement, mode: AnalyticsMode): void {
		const section = container.createDiv('analytics-section');

		const header = section.createDiv('analytics-header');
		header.createSpan('analytics-label').setText('By Project');

		const { start: periodStart, end: periodEnd } = this.getPeriodRange(mode);
		const sessions = this.getSessions(mode);
		const totalMs = this.store.getTotalTimeInRange(sessions, periodStart, periodEnd);

		if (sessions.length === 0) {
			section.createDiv('analytics-empty').setText('No data');
			return;
		}

		const byProject = groupByProject(sessions);
		const breakdown = section.createDiv('project-breakdown');

		const sorted = Object.entries(byProject)
			.map(([id, s]) => ({ id, time: this.store.getTotalTimeInRange(s, periodStart, periodEnd) }))
			.sort((a, b) => b.time - a.time);

		for (const { id, time } of sorted) {
			const project = this.store.getProject(id);
			const percent = totalMs > 0 ? (time / totalMs) * 100 : 0;

			const row = breakdown.createDiv('breakdown-row');
			const info = row.createDiv('breakdown-info');
			const dot = info.createSpan('breakdown-dot');
			dot.style.backgroundColor = project?.color ?? '#888';
			info.createSpan('breakdown-name').setText(project?.name ?? id);
			info.createSpan('breakdown-time').setText(formatHM(time));

			const barContainer = row.createDiv('breakdown-bar');
			const barFill = barContainer.createDiv('breakdown-bar-fill');
			barFill.style.width = `${percent}%`;
			barFill.style.backgroundColor = project?.color ?? '#888';
		}
	}

	private getSessions(mode: AnalyticsMode): Session[] {
		return mode === 'week' ? this.store.getWeekSessions() : this.store.getMonthSessions();
	}

	private getPeriodRange(mode: AnalyticsMode): { start: Date; end: Date } {
		const now = new Date();
		if (mode === 'week') {
			const dayOfWeek = (now.getDay() + 6) % 7;
			const start = new Date(now);
			start.setDate(now.getDate() - dayOfWeek);
			start.setHours(0, 0, 0, 0);
			const end = new Date(start);
			end.setDate(end.getDate() + 7);
			return { start, end };
		}
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		return { start, end };
	}

	private getWeekDailyData(): DayData[] {
		const today = new Date();
		const dayOfWeek = (today.getDay() + 6) % 7;
		const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
		const result: DayData[] = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() - dayOfWeek + i);
			date.setHours(0, 0, 0, 0);
			const nextDate = new Date(date);
			nextDate.setDate(date.getDate() + 1);

			const sessions = this.store.getSessionsInRange(date, nextDate);
			const total = this.store.getTotalTimeInRange(sessions, date, nextDate);
			const projects = this.getProjectBreakdown(sessions, date, nextDate);
			result.push({ label: days[i], total, isToday: i === dayOfWeek, projects });
		}
		return result;
	}

	private getMonthDailyData(): DayData[] {
		const today = new Date();
		const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
		const result: DayData[] = [];

		for (let i = 1; i <= daysInMonth; i++) {
			const date = new Date(today.getFullYear(), today.getMonth(), i);
			const nextDate = new Date(today.getFullYear(), today.getMonth(), i + 1);

			const sessions = this.store.getSessionsInRange(date, nextDate);
			const total = this.store.getTotalTimeInRange(sessions, date, nextDate);
			const projects = this.getProjectBreakdown(sessions, date, nextDate);
			result.push({ label: i.toString(), total, isToday: i === today.getDate(), projects });
		}
		return result;
	}

	private getProjectBreakdown(sessions: Session[], start: Date, end: Date): { color: string; time: number }[] {
		const byProject = groupByProject(sessions);
		return Object.entries(byProject)
			.map(([id, s]) => ({
				color: this.store.getProject(id)?.color ?? '#888',
				time: this.store.getTotalTimeInRange(s, start, end)
			}))
			.sort((a, b) => b.time - a.time);
	}
}
