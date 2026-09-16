import { App, Modal } from 'obsidian';
import { Store } from '../store';
import { formatHM, groupByProject, dayRange, weekRange, Range } from '../utils';

export class StatsModal extends Modal {
	constructor(app: App, private store: Store) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('time-tracker-stats-modal');
		contentEl.createEl('h2', { text: 'Time Stats' });
		const now = new Date();
		this.renderSection(contentEl, 'Today', dayRange(now));
		this.renderSection(contentEl, 'This Week', weekRange(now));
	}

	private renderSection(el: HTMLElement, title: string, range: Range): void {
		const section = el.createDiv('stats-modal-section');
		section.createEl('h3', { text: title });

		const sessions = this.store.getSessionsInRange(range);
		const byProject = groupByProject(sessions);
		if (Object.keys(byProject).length === 0) {
			section.createEl('p', { text: 'No time tracked', cls: 'stats-modal-muted' });
			return;
		}

		const list = section.createEl('ul', { cls: 'stats-modal-list' });
		const rows = Object.entries(byProject)
			.map(([id, s]) => ({ id, time: this.store.getTotalTimeInRange(s, range) }))
			.sort((a, b) => b.time - a.time);
		for (const { id, time } of rows) {
			const project = this.store.getProject(id);
			const li = list.createEl('li');
			li.createSpan({ cls: 'color-dot' }).style.backgroundColor = project?.color ?? '#888';
			li.createSpan({ text: project?.name ?? id });
			li.createSpan({ text: formatHM(time), cls: 'stats-modal-time' });
		}
		section.createEl('p', { text: `Total: ${formatHM(this.store.getTotalTimeInRange(sessions, range))}`, cls: 'stats-modal-total' });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
