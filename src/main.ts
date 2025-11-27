import { Plugin } from 'obsidian';
import { TimeTrackerSettings, DEFAULT_SETTINGS, TimerState } from './types';
import { Store } from './store';
import { Timer } from './timer';
import { StatusBar } from './ui/status-bar';
import { ProjectModal } from './ui/project-modal';
import { StatsModal } from './ui/stats-modal';
import { ManualEntryModal } from './ui/manual-entry-modal';
import { SettingsTab } from './ui/settings-tab';

export default class TimeTrackerPlugin extends Plugin {
	settings!: TimeTrackerSettings;
	store!: Store;
	timer!: Timer;
	private statusBar!: StatusBar;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.store = new Store(this);
		await this.store.load();

		this.timer = new Timer(this.store, (state) => this.saveTimerState(state));
		this.timer.load(this.settings.timerState);

		this.statusBar = new StatusBar(this, this.timer, this.store);

		this.timer.on('status-bar-click', () => {
			new ProjectModal(this.app, this.timer, this.store).open();
		});

		this.addCommand({
			id: 'start-stop',
			name: 'Start/Stop Timer',
			callback: () => {
				if (this.timer.status === 'running') {
					this.timer.stop();
				} else {
					new ProjectModal(this.app, this.timer, this.store).open();
				}
			},
		});

		this.addCommand({
			id: 'show-stats',
			name: 'Show Stats',
			callback: () => new StatsModal(this.app, this.store).open(),
		});

		this.addCommand({
			id: 'add-manual',
			name: 'Add Time Manually',
			callback: () => new ManualEntryModal(this.app, this.timer, this.store).open(),
		});

		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload(): void {
		this.statusBar?.destroy();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async saveTimerState(state: TimerState): Promise<void> {
		this.settings.timerState = state;
		await this.saveSettings();
	}
}
