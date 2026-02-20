import { EventRef, Plugin } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import { formatHMS } from '../utils';

export class StatusBar {
	private el: HTMLElement;
	private timer: Timer;
	private store: Store;
	private interval: number | null = null;
	private changeRef: EventRef;

	constructor(plugin: Plugin, timer: Timer, store: Store) {
		this.timer = timer;
		this.store = store;
		this.el = plugin.addStatusBarItem();
		this.el.addClass('time-tracker-status');
		this.el.onClickEvent(() => this.onClick());
		this.changeRef = this.timer.on('change', () => this.render());
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
		this.timer.offref(this.changeRef);
	}

	private render(): void {
		const { status, projectId } = this.timer;
		if (status === 'idle') {
			this.el.setText('⏱ No timer');
			this.el.removeClass('is-running');
		} else {
			const project = this.store.getProject(projectId!);
			const name = project?.name ?? projectId;
			const time = formatHMS(this.timer.elapsed);
			this.el.setText(`⏱ ${name} ${time}`);
			this.el.addClass('is-running');
		}
	}

	private onClick(): void {
		this.timer.trigger('status-bar-click');
	}
}
