import { Plugin, WorkspaceLeaf } from 'obsidian';
import { TimeTrackerSettings, DEFAULT_SETTINGS, TimerState } from './types';
import { Store } from './store';
import { Timer } from './timer';
import { StatusBar } from './ui/status-bar';
import { StatsModal } from './ui/stats-modal';
import { ManualEntryModal } from './ui/manual-entry-modal';
import { SettingsTab } from './ui/settings-tab';
import { SidebarView, VIEW_TYPE } from './ui/sidebar-view';

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

		// Register sidebar view
		this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this.timer, this.store, this));

		this.statusBar = new StatusBar(this, this.timer, this.store);

		// Status bar click opens sidebar
		this.timer.on('status-bar-click', () => this.activateSidebar());

		this.addCommand({
			id: 'open-tracker',
			name: 'Open Time Tracker',
			callback: () => this.activateSidebar(),
		});

		this.addCommand({
			id: 'start-stop',
			name: 'Start/Stop Timer',
			callback: () => {
				if (this.timer.status === 'running') {
					this.timer.stop();
				} else {
					this.activateSidebar();
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

		// Open sidebar on startup if configured
		this.app.workspace.onLayoutReady(() => this.initSidebar());
	}

	onunload(): void {
		this.statusBar?.destroy();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	async activateSidebar(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	private async initSidebar(): Promise<void> {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
			await this.activateSidebar();
		}
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
