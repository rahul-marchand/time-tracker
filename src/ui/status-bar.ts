import { Plugin } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';

export class StatusBar {
	private el: HTMLElement;
	private timer: Timer;
	private store: Store;
	private interval: number | null = null;

	constructor(plugin: Plugin, timer: Timer, store: Store) {
		this.timer = timer;
		this.store = store;
		this.el = plugin.addStatusBarItem();
		this.el.addClass('time-tracker-status');
		this.el.onClickEvent(() => this.onClick());
		this.timer.on('change', () => this.render());
		this.render();
		this.startInterval();
	}

	private startInterval(): void {
		this.interval = window.setInterval(() => {
			if (this.timer.status === 'running') this.render();
		}, 1000);
	}

	destroy(): void {
		if (this.interval) window.clearInterval(this.interval);
	}

	private render(): void {
		const { status, projectId } = this.timer;
		if (status === 'idle') {
			this.el.setText('⏱ Start timer');
			this.el.removeClass('is-running');
		} else {
			const project = this.store.getProject(projectId!);
			const name = project?.name ?? projectId;
			const time = this.formatTime(this.timer.elapsed);
			this.el.setText(`⏱ ${name} ${time}`);
			this.el.addClass('is-running');
		}
	}

	private formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
	}

	private onClick(): void {
		this.timer.trigger('status-bar-click');
	}
}
