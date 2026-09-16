import { setIcon } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { formatHMS } from '../utils';

export class StatusBar {
	private el: HTMLElement;
	private textEl: HTMLElement;

	constructor(private plugin: TimeTrackerPlugin) {
		this.el = plugin.addStatusBarItem();
		this.el.addClass('time-tracker-status');
		this.el.setAttr('aria-label', 'Time Tracker');
		setIcon(this.el.createSpan('time-tracker-status-icon'), 'clock');
		this.textEl = this.el.createSpan('time-tracker-status-text');
		this.el.onClickEvent(() => plugin.activateSidebar());

		plugin.registerEvent(plugin.timer.on('change', () => this.render()));
		plugin.registerEvent(plugin.store.on('change', () => this.render()));
		plugin.registerInterval(window.setInterval(() => {
			if (plugin.timer.status === 'running') this.render();
		}, 1000));
		this.render();
	}

	private render(): void {
		const { timer, store } = this.plugin;
		if (timer.status === 'idle') {
			this.textEl.setText('');
			this.el.removeClass('is-running');
			return;
		}
		const name = store.getProject(timer.projectId!)?.name ?? timer.projectId;
		this.textEl.setText(`${name} ${formatHMS(timer.elapsed)}`);
		this.el.addClass('is-running');
	}
}
