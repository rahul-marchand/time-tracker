import { Menu, setIcon } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { Timer } from '../timer';
import { Store } from '../store';
import { formatHMS, getContrastColor } from '../utils';
import { AddTimeModal } from './add-time-modal';

export class TimerSection {
	private viewDate?: Date;

	private timer: Timer;
	private store: Store;

	constructor(private plugin: TimeTrackerPlugin) {
		this.timer = plugin.timer;
		this.store = plugin.store;
	}

	private get app() { return this.plugin.app; }

	private label(name: string): string {
		const max = this.plugin.settings.pillLabelChars;
		return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
	}

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
			btn.setAttr('aria-label', `Start ${project.name}`);
			btn.style.setProperty('--project-color', project.color);
			btn.style.setProperty('--icon-color', getContrastColor(project.color));
			btn.setAttr('title', project.name);
			setIcon(btn.createDiv('project-btn-icon'), project.icon || 'play');
			btn.createSpan('project-btn-name').setText(this.label(project.name));
			btn.onClickEvent(() => this.timer.start(project.id));
		}

		const addBtn = projectList.createEl('button', { cls: 'project-btn project-btn--add' });
		addBtn.setAttr('aria-label', 'Add time manually');
		setIcon(addBtn.createDiv('project-btn-icon'), 'plus');
		addBtn.createSpan('project-btn-name').setText('Add time');
		addBtn.onClickEvent(() => new AddTimeModal(this.app, this.store, { date: this.viewDate }).open());
	}

	private renderRunning(section: HTMLElement): void {
		const project = this.store.getProject(this.timer.projectId!);

		section.addClass('running');
		section.style.setProperty('--active-color', project?.color ?? '#888');

		const header = section.createDiv('timer-active-header');
		header.createSpan('timer-active-dot');
		header.createSpan('timer-active-project').setText(project?.name ?? 'Unknown');

		section.createDiv('timer-display').setText(formatHMS(this.timer.elapsed));

		const actions = section.createDiv('timer-actions');

		const stopBtn = actions.createEl('button', { cls: 'timer-btn stop' });
		setIcon(stopBtn.createSpan(), 'square');
		stopBtn.createSpan().setText('Stop');
		stopBtn.onClickEvent(() => this.timer.stop());

		const switchBtn = actions.createEl('button', { cls: 'timer-btn switch' });
		setIcon(switchBtn.createSpan(), 'arrow-left-right');
		switchBtn.createSpan().setText('Switch');
		switchBtn.onClickEvent((evt) => this.showSwitchMenu(evt));
	}

	private showSwitchMenu(evt: MouseEvent): void {
		const menu = new Menu();
		for (const project of this.store.projects) {
			if (project.id === this.timer.projectId) continue;
			menu.addItem((item) => {
				item.setTitle(project.name);
				item.setIcon(project.icon || 'folder');
				item.onClick(() => this.timer.start(project.id));
			});
		}
		menu.showAtMouseEvent(evt);
	}
}
