import { App, Modal } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';

export class ProjectModal extends Modal {
	private timer: Timer;
	private store: Store;

	constructor(app: App, timer: Timer, store: Store) {
		super(app);
		this.timer = timer;
		this.store = store;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('time-tracker-project-modal');

		if (this.timer.status === 'running') {
			this.renderRunning(contentEl);
		} else {
			this.renderIdle(contentEl);
		}
	}

	private renderIdle(el: HTMLElement): void {
		el.createEl('h3', { text: 'Start Timer' });
		const list = el.createDiv('project-list');

		for (const project of this.store.projects) {
			const btn = list.createEl('button', { text: project.name, cls: 'project-btn' });
			btn.style.setProperty('--project-color', project.color);
			btn.onClickEvent(async () => {
				await this.timer.start(project.id);
				this.close();
			});
		}
	}

	private renderRunning(el: HTMLElement): void {
		const project = this.store.getProject(this.timer.projectId!);
		el.createEl('h3', { text: `Tracking: ${project?.name ?? this.timer.projectId}` });

		const actions = el.createDiv('actions');

		const stopBtn = actions.createEl('button', { text: 'Stop', cls: 'mod-warning' });
		stopBtn.onClickEvent(async () => {
			await this.timer.stop();
			this.close();
		});

		const discardBtn = actions.createEl('button', { text: 'Discard' });
		discardBtn.onClickEvent(async () => {
			await this.timer.discard();
			this.close();
		});

		const switchEl = el.createDiv('switch-section');
		switchEl.createEl('h4', { text: 'Switch to:' });
		const list = switchEl.createDiv('project-list');

		for (const p of this.store.projects) {
			if (p.id === this.timer.projectId) continue;
			const btn = list.createEl('button', { text: p.name, cls: 'project-btn' });
			btn.style.setProperty('--project-color', p.color);
			btn.onClickEvent(async () => {
				await this.timer.start(p.id);
				this.close();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
