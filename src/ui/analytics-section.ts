import { Store } from '../store';
import { Session } from '../types';
import {
	formatHM, formatHours, groupByProject, dayRange, weekRange, monthRange, daysIn, elapsedFraction, Range,
} from '../utils';

type AnalyticsMode = 'week' | 'month';

interface Period {
	mode: AnalyticsMode;
	range: Range;
	sessions: Session[];
	totalMs: number;
}

interface DayData {
	label: string;
	tooltip: string;
	total: number;
	isToday: boolean;
	projects: { color: string; time: number }[];
}

export class AnalyticsSection {
	constructor(private store: Store) {}

	render(container: HTMLElement, mode: AnalyticsMode, onModeChange: (m: AnalyticsMode) => void): void {
		const now = new Date();
		const range = mode === 'week' ? weekRange(now) : monthRange(now);
		const sessions = this.store.getSessionsInRange(range);
		const period: Period = { mode, range, sessions, totalMs: this.store.getTotalTimeInRange(sessions, range) };

		const view = container.createDiv('analytics-view');
		this.renderChart(view, period, onModeChange);
		this.renderStats(view, period);
		this.renderProjectSummary(view, period);
	}

	private renderChart(container: HTMLElement, p: Period, onModeChange: (m: AnalyticsMode) => void): void {
		const section = container.createDiv('analytics-section');
		const header = section.createDiv('analytics-header');

		const periodName = p.mode === 'week' ? 'This week' : p.range.start.toLocaleDateString(undefined, { month: 'long' });
		header.createSpan('analytics-label').setText(periodName);

		const right = header.createDiv('analytics-header-right');
		const toggle = right.createDiv('analytics-toggle');
		for (const [m, label] of [['week', 'W'], ['month', 'M']] as const) {
			const btn = toggle.createEl('button', { cls: 'toggle-btn', text: label });
			btn.setAttr('aria-label', m === 'week' ? 'This week' : 'This month');
			if (p.mode === m) btn.addClass('active');
			btn.onClickEvent(() => onModeChange(m));
		}
		right.createSpan('analytics-total').setText(formatHM(p.totalMs));

		const days = this.getDailyData(p);
		const maxMs = Math.max(...days.map(d => d.total), 1);

		const chart = section.createDiv('week-chart');
		if (p.mode === 'month') chart.addClass('week-chart--month');

		for (const day of days) {
			const col = chart.createDiv('week-col');
			if (day.isToday) col.addClass('today');

			const bar = col.createDiv('week-bar');
			bar.dataset.tooltip = day.tooltip;

			const stack = bar.createDiv('week-bar-stack');
			const heightPercent = (day.total / maxMs) * 100;
			stack.style.height = `${Math.max(heightPercent, day.total > 0 ? 4 : 2)}%`;
			for (const seg of day.projects) {
				const segment = stack.createDiv('stack-segment');
				segment.style.height = `${(seg.time / day.total) * 100}%`;
				segment.style.backgroundColor = seg.color;
			}

			col.createDiv('week-label').setText(day.label);
		}
	}

	private renderStats(container: HTMLElement, p: Period): void {
		const section = container.createDiv('analytics-section analytics-stats');
		const elapsedDays = elapsedFraction(p.range) * daysIn(p.range);
		const avgMs = elapsedDays > 0 ? p.totalMs / elapsedDays : 0;

		const stats = section.createDiv('stats-grid');
		const avgStat = stats.createDiv('stat-item');
		avgStat.createDiv('stat-value').setText(formatHM(avgMs));
		avgStat.createDiv('stat-label').setText('Daily avg');
	}

	// Week mode measures against each active project's weekly target; month mode shows share of total.
	private renderProjectSummary(container: HTMLElement, p: Period): void {
		const section = container.createDiv('analytics-section');
		const header = section.createDiv('analytics-header');
		header.createSpan('analytics-label').setText('By project');

		const byProject = groupByProject(p.sessions);
		const timeFor = (id: string) =>
			byProject[id] ? this.store.getTotalTimeInRange(byProject[id], p.range) : 0;

		const targetById = new Map<string, number>();
		if (p.mode === 'week') {
			for (const proj of this.store.projects) {
				if (proj.weeklyTargetMins) targetById.set(proj.id, proj.weeklyTargetMins * 60000);
			}
		}
		const useTargets = targetById.size > 0;

		if (useTargets) {
			const targetTotal = [...targetById.values()].reduce((a, b) => a + b, 0);
			const trackedTotal = [...targetById.keys()].reduce((a, id) => a + timeFor(id), 0);
			const total = header.createSpan('analytics-total');
			total.setText(formatHM(trackedTotal));
			total.createSpan('breakdown-target').setText(formatHours(targetTotal));
		} else if (p.sessions.length === 0) {
			section.createDiv('analytics-empty').setText('No data');
			return;
		}

		const ids = new Set<string>([...Object.keys(byProject), ...targetById.keys()]);
		const rows = [...ids]
			.map(id => ({ id, time: timeFor(id), target: targetById.get(id) ?? 0 }))
			.filter(r => r.time > 0 || r.target > 0)
			.sort((a, b) => b.time - a.time);

		const pace = elapsedFraction(p.range);
		const dayIdx = (new Date().getDay() + 6) % 7; // 0 = Monday
		const breakdown = section.createDiv('project-breakdown');

		for (const { id, time, target } of rows) {
			const project = this.store.getProject(id);
			const color = project?.color ?? '#888';
			const row = breakdown.createDiv('breakdown-row');

			const info = row.createDiv('breakdown-info');
			info.createSpan('breakdown-dot').style.backgroundColor = color;
			info.createSpan('breakdown-name').setText(project?.name ?? id);
			info.createSpan('breakdown-time').setText(formatHM(time));
			if (target > 0) info.createSpan('breakdown-target').setText(formatHours(target));

			const barContainer = row.createDiv('breakdown-bar');
			const barFill = barContainer.createDiv('breakdown-bar-fill');
			const percent = target > 0
				? Math.min((time / target) * 100, 100)
				: p.totalMs > 0 ? (time / p.totalMs) * 100 : 0;
			barFill.style.width = `${percent}%`;
			barFill.style.backgroundColor = color;

			if (target > 0) {
				barContainer.createDiv('breakdown-pace').style.left = `${pace * 100}%`;
				// Red only once the week is well under way; before that a zero is just a quiet row.
				if (time >= target) row.addClass('breakdown-row--met');
				else if (time === 0 && dayIdx >= 2) row.addClass('breakdown-row--zero');
				else if (dayIdx >= 1 && time < target * pace * 0.5) row.addClass('breakdown-row--behind');
			}
		}
	}

	private getDailyData(p: Period): DayData[] {
		const today = dayRange(new Date()).start.getTime();
		const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
		const result: DayData[] = [];
		const n = daysIn(p.range);

		for (let i = 0; i < n; i++) {
			const date = new Date(p.range.start);
			date.setDate(date.getDate() + i);
			const day = dayRange(date);
			const sessions = this.store.getSessionsInRange(day);
			const total = this.store.getTotalTimeInRange(sessions, day);
			const isToday = day.start.getTime() === today;

			let label: string;
			if (p.mode === 'week') {
				label = weekLabels[i];
			} else {
				const d = i + 1;
				const isTick = d === 1 || d % 5 === 0;
				const nextToToday = isToday ? false : Math.abs(day.start.getTime() - today) <= 86400000;
				label = isToday || (isTick && !nextToToday) ? String(d) : '';
			}
			const dateLabel = date.toLocaleDateString(undefined, p.mode === 'week'
				? { weekday: 'short', day: 'numeric' }
				: { day: 'numeric', month: 'short' });

			result.push({
				label,
				tooltip: `${dateLabel} · ${formatHM(total)}`,
				total,
				isToday,
				projects: this.getProjectBreakdown(sessions, day),
			});
		}
		return result;
	}

	private getProjectBreakdown(sessions: Session[], range: Range): { color: string; time: number }[] {
		return Object.entries(groupByProject(sessions))
			.map(([id, s]) => ({
				color: this.store.getProject(id)?.color ?? '#888',
				time: this.store.getTotalTimeInRange(s, range),
			}))
			.sort((a, b) => b.time - a.time);
	}
}
