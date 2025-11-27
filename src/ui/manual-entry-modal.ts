import { App, Modal, Setting } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';

export class ManualEntryModal extends Modal {
	private timer: Timer;
	private store: Store;
	private projectId: string;
	private date: string;
	private startTime: string;
	private endTime: string;

	constructor(app: App, timer: Timer, store: Store) {
		super(app);
		this.timer = timer;
		this.store = store;

		const now = new Date();
		this.projectId = this.store.projects[0]?.id ?? '';
		this.date = now.toISOString().split('T')[0];
		this.startTime = '09:00';
		this.endTime = '10:00';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('time-tracker-manual-modal');

		contentEl.createEl('h3', { text: 'Add Time Manually' });

		new Setting(contentEl)
			.setName('Project')
			.addDropdown(dropdown => {
				for (const p of this.store.projects) {
					dropdown.addOption(p.id, p.name);
				}
				dropdown.setValue(this.projectId);
				dropdown.onChange(v => this.projectId = v);
			});

		new Setting(contentEl)
			.setName('Date')
			.addText(text => {
				text.inputEl.type = 'date';
				text.setValue(this.date);
				text.onChange(v => this.date = v);
			});

		new Setting(contentEl)
			.setName('Start Time')
			.addText(text => {
				text.inputEl.type = 'time';
				text.setValue(this.startTime);
				text.onChange(v => this.startTime = v);
			});

		new Setting(contentEl)
			.setName('End Time')
			.addText(text => {
				text.inputEl.type = 'time';
				text.setValue(this.endTime);
				text.onChange(v => this.endTime = v);
			});

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText('Add');
				btn.setCta();
				btn.onClick(() => this.submit());
			});
	}

	private async submit(): Promise<void> {
		const start = new Date(`${this.date}T${this.startTime}`);
		const end = new Date(`${this.date}T${this.endTime}`);

		if (end <= start) {
			return; // Invalid range
		}

		await this.timer.addManual(this.projectId, start, end);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
