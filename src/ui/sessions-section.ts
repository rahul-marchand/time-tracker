import { Notice, setIcon } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { Session } from '../types';
import { formatHM, formatHHMM, dayRange, Range } from '../utils';
import { AddTimeModal } from './add-time-modal';

export class SessionsSection {
	private liveMs = 0;

	constructor(private plugin: TimeTrackerPlugin) {}

	render(container: HTMLElement, viewDate: Date, isToday: boolean, onNavigate: (delta: number) => void): void {
		const { timer, store } = this.plugin;
		const section = container.createDiv('today-section');
		const range = dayRange(viewDate);

		const indexed = store.getSessionsWithIndices(range);
		const totalMs = store.getTotalTimeInRange(indexed.map(e => e.session), range);

		const live = isToday && timer.status === 'running' && timer.startTime
			? { start: new Date(Math.max(timer.startTime.getTime(), range.start.getTime())), projectId: timer.projectId! }
			: null;
		const liveMs = live ? Date.now() - live.start.getTime() : 0;
		this.liveMs = liveMs;

		this.renderDateNav(section, viewDate, isToday, totalMs + liveMs, onNavigate);
		this.renderProgressBar(section, totalMs + liveMs, viewDate);

		const list = section.createDiv('today-breakdown');
		if (indexed.length === 0 && !live) {
			list.createDiv('today-empty').setText('No sessions');
			return;
		}
		const sorted = [...indexed].sort(
			(a, b) => new Date(a.session.start).getTime() - new Date(b.session.start).getTime()
		);
		for (const { index, session } of sorted) {
			this.renderSessionRow(list, index, session, range);
		}
		if (live) this.renderLiveRow(list, live.projectId, live.start, liveMs);
	}

	private renderDateNav(
		section: HTMLElement,
		viewDate: Date,
		isToday: boolean,
		totalMs: number,
		onNavigate: (delta: number) => void,
	): void {
		const header = section.createDiv('session-nav');

		const prevBtn = header.createEl('button', { cls: 'session-nav-btn' });
		prevBtn.setAttr('aria-label', 'Previous day');
		setIcon(prevBtn, 'chevron-left');
		prevBtn.onClickEvent(() => onNavigate(-1));

		header.createSpan('session-nav-label').setText(this.getDateLabel(viewDate, isToday));
		header.createSpan('session-nav-total').setText(formatHM(totalMs));
		header.dataset.baseMs = String(totalMs - this.liveMs);

		const nextBtn = header.createEl('button', { cls: 'session-nav-btn' });
		nextBtn.setAttr('aria-label', 'Next day');
		setIcon(nextBtn, 'chevron-right');
		nextBtn.disabled = isToday;
		nextBtn.onClickEvent(() => { if (!isToday) onNavigate(1); });
	}

	private renderProgressBar(section: HTMLElement, totalMs: number, viewDate: Date): void {
		const goalMs = this.plugin.settings.dailyGoalMins[viewDate.getDay()] * 60_000;
		const progress = goalMs > 0 ? Math.min(totalMs / goalMs, 1) : 0;
		const bar = section.createDiv('today-progress');
		bar.dataset.goalMs = String(goalMs);
		bar.createDiv('today-progress-fill').style.width = `${progress * 100}%`;
	}

	private renderSessionRow(container: HTMLElement, index: number, session: Session, range: Range): void {
		const { store } = this.plugin;
		const project = store.getProject(session.project);
		const rawStart = new Date(session.start);
		const rawEnd = new Date(session.end);
		const start = rawStart < range.start ? range.start : rawStart;
		const end = rawEnd > range.end ? range.end : rawEnd;

		const row = container.createDiv('session-row');
		row.createSpan('today-dot').style.backgroundColor = project?.color ?? '#888';

		const content = row.createDiv('session-content');
		const topRow = content.createDiv('session-top-row');
		topRow.createSpan('today-name').setText(project?.name ?? session.project);
		topRow.createSpan('today-time').setText(formatHM(end.getTime() - start.getTime()));
		content.createSpan('session-time-range').setText(`${formatHHMM(start)} – ${formatHHMM(end)}`);

		const delBtn = row.createDiv('session-delete');
		delBtn.setAttr('aria-label', 'Delete session');
		setIcon(delBtn, 'x');
		delBtn.onClickEvent(async (e) => {
			e.stopPropagation();
			const deleted = { ...session };
			await store.deleteSession(index);
			const notice = new Notice('Session deleted', 5000);
			const undoBtn = notice.noticeEl.createEl('a', { text: 'Undo', cls: 'session-undo' });
			undoBtn.onClickEvent(async () => {
				await store.addSession(deleted);
				notice.hide();
			});
		});

		row.onClickEvent(() => {
			new AddTimeModal(this.plugin.app, store, { editIndex: index, session }).open();
		});
	}

	private renderLiveRow(container: HTMLElement, projectId: string, start: Date, ms: number): void {
		const project = this.plugin.store.getProject(projectId);
		const row = container.createDiv('session-row live');
		row.createSpan('today-dot pulse').style.backgroundColor = project?.color ?? '#888';
		row.dataset.startMs = String(start.getTime());
		const content = row.createDiv('session-content');
		const topRow = content.createDiv('session-top-row');
		topRow.createSpan('today-name').setText(project?.name ?? projectId);
		topRow.createSpan('today-time live-time').setText(formatHM(ms));
		content.createSpan('session-time-range').setText(`${formatHHMM(start)} – now`);
		row.createDiv('session-delete session-delete--spacer'); // keeps columns aligned with finished rows
	}

	private getDateLabel(viewDate: Date, isToday: boolean): string {
		if (isToday) return 'Today';
		const diff = Math.round((dayRange(new Date()).start.getTime() - viewDate.getTime()) / 86400000);
		if (diff === 1) return 'Yesterday';
		return viewDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
}
