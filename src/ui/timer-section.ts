import { App, Menu, setIcon } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { formatHMS, getContrastColor } from '../utils';
import { AddTimeModal } from './add-time-modal';

export class TimerSection {
	private viewDate?: Date;

	constructor(
		private app: App,
		private timer: Timer,
		private store: Store,
	) {}

	render(container: HTMLElement, viewDate?: Date): void {
		this.viewDate = viewDate;
		const section = container.createDiv('timer-section');

		if (this.timer.status === 'idle') {
			this.renderIdle(section);
		} else {
			this.renderRunning(section);
		}
	}

	private renderIdle(section: HTMLElement): void {
		const projectList = section.createDiv('project-buttons');
		for (const project of this.store.projects) {
			const btn = projectList.createEl('button', { cls: 'project-btn' });
			btn.style.setProperty('--project-color', project.color);
			btn.style.setProperty('--icon-color', getContrastColor(project.color));

			const icon = btn.createDiv('project-btn-icon');
			setIcon(icon, project.icon || 'play');

			const content = btn.createDiv('project-btn-content');
			content.createSpan('project-btn-name').setText(project.name);

			const addBtn = content.createDiv('project-btn-add');
			setIcon(addBtn, 'plus');
			addBtn.onClickEvent((e) => {
				e.stopPropagation();
				new AddTimeModal(this.app, this.timer, this.store, { projectId: project.id, date: this.viewDate }).open();
			});

			btn.onClickEvent(() => this.timer.start(project.id));
		}
	}

	private renderRunning(section: HTMLElement): void {
		const project = this.store.getProject(this.timer.projectId!);

		section.addClass('running');
		section.style.setProperty('--active-color', project?.color ?? '#888');

		const header = section.createDiv('timer-active-header');
		header.createSpan('timer-active-label').setText('Tracking');
		header.createSpan('timer-active-project').setText(project?.name ?? 'Unknown');

		const display = section.createDiv('timer-display');
		display.setText(formatHMS(this.timer.elapsed));

		const actions = section.createDiv('timer-actions');

		const stopBtn = actions.createEl('button', { cls: 'timer-btn stop' });
		stopBtn.createSpan('timer-btn-icon').setText('■');
		stopBtn.createSpan().setText('Stop');
		stopBtn.onClickEvent(() => this.timer.stop());

		const switchBtn = actions.createEl('button', { cls: 'timer-btn switch' });
		switchBtn.createSpan('timer-btn-icon').setText('↻');
		switchBtn.createSpan().setText('Switch');
		switchBtn.onClickEvent((evt) => this.showSwitchMenu(evt));
	}

	private showSwitchMenu(evt: MouseEvent): void {
		const menu = new Menu();
		for (const project of this.store.projects) {
			if (project.id === this.timer.projectId) continue;
			menu.addItem((item) => {
				item.setTitle(project.name);
				item.onClick(() => this.timer.start(project.id));
			});
		}
		menu.showAtMouseEvent(evt);
	}
}
