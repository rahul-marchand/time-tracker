import { App, Modal, Notice } from 'obsidian';
import { Store } from '../store';
import { Session } from '../types';
import { formatHM } from '../utils';

export interface AddTimeModalOpts {
	projectId?: string;
	editIndex?: number;
	session?: Session;
	date?: Date;
}

export class AddTimeModal extends Modal {
	private opts: AddTimeModalOpts;
	private projectId: string;
	private date: string;
	private startTime: string;
	private endTime: string;
	private durationEl: HTMLElement | null = null;

	private get isEditing(): boolean {
		return this.opts.editIndex !== undefined && this.opts.session !== undefined;
	}

	constructor(app: App, private store: Store, opts?: AddTimeModalOpts) {
		super(app);
		this.opts = opts ?? {};

		if (this.isEditing) {
			const s = this.opts.session!;
			const start = new Date(s.start);
			const end = new Date(s.end);
			this.projectId = s.project;
			this.date = this.toDateStr(start);
			this.startTime = this.toTimeStr(start);
			this.endTime = this.toTimeStr(end);
		} else {
			const now = this.opts.date ?? new Date();
			this.projectId = this.opts.projectId ?? this.store.projects[0]?.id ?? '';
			this.date = this.toDateStr(now);
			const endHour = new Date().getHours();
			const startHour = Math.max(endHour - 1, 0);
			this.startTime = `${String(startHour).padStart(2, '0')}:00`;
			this.endTime = `${String(endHour).padStart(2, '0')}:00`;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('time-tracker-add-modal');
		contentEl.createEl('h3', { text: this.isEditing ? 'Edit Session' : 'Add Time' });

		const projGroup = contentEl.createDiv('add-modal-field');
		projGroup.createEl('label', { text: 'Project', cls: 'add-modal-label' });
		const select = projGroup.createEl('select', { cls: 'add-modal-select' });
		for (const p of this.store.projects) {
			const opt = select.createEl('option', { text: p.name, value: p.id });
			if (p.id === this.projectId) opt.selected = true;
		}
		select.addEventListener('change', () => { this.projectId = select.value; });

		const dateGroup = contentEl.createDiv('add-modal-field');
		dateGroup.createEl('label', { text: 'Date', cls: 'add-modal-label' });
		const dateInput = dateGroup.createEl('input', { cls: 'add-modal-input', type: 'date', value: this.date });
		dateInput.addEventListener('change', () => { this.date = dateInput.value; this.updateDuration(); });

		const timeGroup = contentEl.createDiv('add-modal-field');
		timeGroup.createEl('label', { text: 'Time', cls: 'add-modal-label' });
		const timeRow = timeGroup.createDiv('add-modal-time-row');
		const startInput = timeRow.createEl('input', { cls: 'add-modal-input', type: 'time', value: this.startTime });
		this.durationEl = timeRow.createEl('span', { cls: 'add-modal-duration' });
		const endInput = timeRow.createEl('input', { cls: 'add-modal-input', type: 'time', value: this.endTime });
		startInput.addEventListener('change', () => { this.startTime = startInput.value; this.updateDuration(); });
		endInput.addEventListener('change', () => { this.endTime = endInput.value; this.updateDuration(); });
		this.updateDuration();

		const btn = contentEl.createEl('button', {
			text: this.isEditing ? 'Save' : 'Add',
			cls: 'add-modal-submit mod-cta',
		});
		btn.addEventListener('click', () => this.submit());
	}

	// null when any field is empty or unparsable; an end at or before start rolls to the next day
	private parse(): { start: Date; end: Date } | null {
		if (!this.projectId || !this.date || !this.startTime || !this.endTime) return null;
		const start = new Date(`${this.date}T${this.startTime}`);
		let end = new Date(`${this.date}T${this.endTime}`);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
		if (end <= start) end = new Date(end.getTime() + 86400000);
		return { start, end };
	}

	private updateDuration(): void {
		const parsed = this.parse();
		this.durationEl?.setText(parsed ? formatHM(parsed.end.getTime() - parsed.start.getTime()) : '—');
	}

	private async submit(): Promise<void> {
		const parsed = this.parse();
		if (!parsed) {
			new Notice('Choose a project and enter a valid date and times.');
			return;
		}
		const session: Session = {
			project: this.projectId,
			start: parsed.start.toISOString(),
			end: parsed.end.toISOString(),
		};
		if (this.isEditing) {
			await this.store.updateSession(this.opts.editIndex!, session);
		} else {
			await this.store.addSession(session);
		}
		this.close();
	}

	private toDateStr(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	private toTimeStr(d: Date): string {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
