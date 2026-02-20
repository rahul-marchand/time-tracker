import { App, Modal } from 'obsidian';
import { Store } from '../store';
import { Session } from '../types';
import { formatHM, groupByProject } from '../utils';

export class StatsModal extends Modal {
	private store: Store;

	constructor(app: App, store: Store) {
		super(app);
		this.store = store;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('time-tracker-stats-modal');

		contentEl.createEl('h2', { text: 'Time Stats' });

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date(todayStart);
		todayEnd.setDate(todayEnd.getDate() + 1);

		const now = new Date();
		const dayOfWeek = (now.getDay() + 6) % 7;
		const weekStart = new Date(now);
		weekStart.setDate(now.getDate() - dayOfWeek);
		weekStart.setHours(0, 0, 0, 0);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 7);

		this.renderSection(contentEl, 'Today', this.store.getTodaySessions(), todayStart, todayEnd);
		this.renderSection(contentEl, 'This Week', this.store.getWeekSessions(), weekStart, weekEnd);
	}

	private renderSection(el: HTMLElement, title: string, sessions: Session[], rangeStart: Date, rangeEnd: Date): void {
		const section = el.createDiv('stats-section');
		section.createEl('h3', { text: title });

		const byProject = groupByProject(sessions);
		const total = this.store.getTotalTimeInRange(sessions, rangeStart, rangeEnd);

		if (Object.keys(byProject).length === 0) {
			section.createEl('p', { text: 'No time tracked', cls: 'muted' });
			return;
		}

		const list = section.createEl('ul', { cls: 'stats-list' });
		for (const [projectId, projectSessions] of Object.entries(byProject)) {
			const project = this.store.getProject(projectId);
			const time = this.store.getTotalTimeInRange(projectSessions, rangeStart, rangeEnd);
			const li = list.createEl('li');
			const dot = li.createSpan({ cls: 'color-dot' });
			dot.style.backgroundColor = project?.color ?? '#888';
			li.createSpan({ text: `${project?.name ?? projectId}: ${formatHM(time)}` });
		}

		section.createEl('p', { text: `Total: ${formatHM(total)}`, cls: 'stats-total' });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
