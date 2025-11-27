import { App, Modal } from 'obsidian';
import { Store } from '../store';
import { Session } from '../types';

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

		this.renderSection(contentEl, 'Today', this.store.getTodaySessions());
		this.renderSection(contentEl, 'This Week', this.store.getWeekSessions());
	}

	private renderSection(el: HTMLElement, title: string, sessions: Session[]): void {
		const section = el.createDiv('stats-section');
		section.createEl('h3', { text: title });

		const byProject = this.groupByProject(sessions);
		const total = this.store.getTotalTime(sessions);

		if (Object.keys(byProject).length === 0) {
			section.createEl('p', { text: 'No time tracked', cls: 'muted' });
			return;
		}

		const list = section.createEl('ul', { cls: 'stats-list' });
		for (const [projectId, projectSessions] of Object.entries(byProject)) {
			const project = this.store.getProject(projectId);
			const time = this.store.getTotalTime(projectSessions);
			const li = list.createEl('li');
			const dot = li.createSpan({ cls: 'color-dot' });
			dot.style.backgroundColor = project?.color ?? '#888';
			li.createSpan({ text: `${project?.name ?? projectId}: ${this.formatTime(time)}` });
		}

		section.createEl('p', { text: `Total: ${this.formatTime(total)}`, cls: 'stats-total' });
	}

	private groupByProject(sessions: Session[]): Record<string, Session[]> {
		const result: Record<string, Session[]> = {};
		for (const s of sessions) {
			(result[s.project] ??= []).push(s);
		}
		return result;
	}

	private formatTime(ms: number): string {
		const mins = Math.round(ms / 60000);
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
