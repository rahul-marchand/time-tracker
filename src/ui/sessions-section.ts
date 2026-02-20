import { App, Notice, setIcon } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { Session } from '../types';
import { formatHM, formatHHMM } from '../utils';
import { AddTimeModal } from './add-time-modal';
import type TimeTrackerPlugin from '../main';

export class SessionsSection {
	constructor(
		private app: App,
		private timer: Timer,
		private store: Store,
		private plugin: TimeTrackerPlugin,
	) {}

	render(container: HTMLElement, viewDate: Date, isToday: boolean): void {
		const section = container.createDiv('today-section');

		const dayStart = new Date(viewDate);
		dayStart.setHours(0, 0, 0, 0);
		const dayEnd = new Date(dayStart);
		dayEnd.setDate(dayEnd.getDate() + 1);

		const indexed = this.store.getSessionsWithIndices(dayStart, dayEnd);
		const sessions = indexed.map(e => e.session);
		const totalMs = this.store.getTotalTimeInRange(sessions, dayStart, dayEnd);
		let runningMs = 0;
		if (isToday && this.timer.status === 'running' && this.timer.startTime) {
			const clampedStart = Math.max(this.timer.startTime.getTime(), dayStart.getTime());
			runningMs = Date.now() - clampedStart;
		}
		const totalWithRunning = totalMs + runningMs;

		this.renderDateNav(section, viewDate, isToday, totalWithRunning);
		this.renderProgressBar(section, totalWithRunning, viewDate);

		if (this.timer.status === 'idle') {
			const list = section.createDiv('today-breakdown');
			if (indexed.length === 0) {
				list.createDiv('today-empty').setText('No sessions');
			} else {
				const sorted = [...indexed].sort(
					(a, b) => new Date(a.session.start).getTime() - new Date(b.session.start).getTime()
				);
				for (const { index, session } of sorted) {
					this.renderSessionRow(list, index, session, dayStart, dayEnd);
				}
			}
		}
	}

	private renderDateNav(
		section: HTMLElement,
		viewDate: Date,
		isToday: boolean,
		totalWithRunning: number,
	): void {
		const header = section.createDiv('session-nav');

		const prevBtn = header.createEl('button', { cls: 'session-nav-btn' });
		setIcon(prevBtn, 'chevron-left');
		prevBtn.onClickEvent(() => {
			viewDate.setDate(viewDate.getDate() - 1);
			this.timer.trigger('change');
		});

		header.createSpan('session-nav-label').setText(this.getDateLabel(viewDate, isToday));
		header.createSpan('session-nav-total').setText(formatHM(totalWithRunning));

		const nextBtn = header.createEl('button', { cls: 'session-nav-btn' });
		setIcon(nextBtn, 'chevron-right');
		if (isToday) {
			nextBtn.disabled = true;
			nextBtn.addClass('disabled');
		}
		nextBtn.onClickEvent(() => {
			if (!isToday) {
				viewDate.setDate(viewDate.getDate() + 1);
				this.timer.trigger('change');
			}
		});
	}

	private renderProgressBar(section: HTMLElement, totalWithRunning: number, viewDate: Date): void {
		const goalMs = this.plugin.settings.dailyGoalMins[viewDate.getDay()] * 60_000;
		const progress = Math.min(totalWithRunning / goalMs, 1);
		const progressBar = section.createDiv('today-progress');
		const progressFill = progressBar.createDiv('today-progress-fill');
		progressFill.style.width = `${progress * 100}%`;
	}

	private renderSessionRow(container: HTMLElement, index: number, session: Session, dayStart: Date, dayEnd: Date): void {
		const project = this.store.getProject(session.project);
		const rawStart = new Date(session.start);
		const rawEnd = new Date(session.end);
		const start = rawStart < dayStart ? dayStart : rawStart;
		const end = rawEnd > dayEnd ? dayEnd : rawEnd;
		const durationMs = end.getTime() - start.getTime();

		const row = container.createDiv('session-row');

		const dot = row.createSpan('today-dot');
		dot.style.backgroundColor = project?.color ?? '#888';

		const content = row.createDiv('session-content');
		const topRow = content.createDiv('session-top-row');
		topRow.createSpan('today-name').setText(project?.name ?? session.project);
		topRow.createSpan('today-time').setText(formatHM(durationMs));
		content.createSpan('session-time-range').setText(`${formatHHMM(start)} – ${formatHHMM(end)}`);

		const delBtn = row.createDiv('session-delete');
		setIcon(delBtn, 'x');
		delBtn.onClickEvent(async (e) => {
			e.stopPropagation();
			const deleted = { ...session };
			await this.store.deleteSession(index);
			this.timer.trigger('change');
			const notice = new Notice('Session deleted', 5000);
			const undoBtn = notice.noticeEl.createEl('a', { text: 'Undo', cls: 'session-undo' });
			undoBtn.onClickEvent(async () => {
				await this.store.addSession(deleted);
				this.timer.trigger('change');
				notice.hide();
			});
		});

		row.onClickEvent(() => {
			new AddTimeModal(this.app, this.timer, this.store, { editIndex: index, session }).open();
		});
	}

	private getDateLabel(viewDate: Date, isToday: boolean): string {
		if (isToday) return 'Today';
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const view = new Date(viewDate);
		view.setHours(0, 0, 0, 0);
		const diff = Math.round((today.getTime() - view.getTime()) / 86400000);
		if (diff === 1) return 'Yesterday';
		return view.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
}
