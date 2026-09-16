import { Plugin } from 'obsidian';
import { TimeTrackerSettings, DEFAULT_SETTINGS, TimerState } from './types';
import { Store } from './store';
import { Timer } from './timer';
import { StatusBar } from './ui/status-bar';
import { StatsModal } from './ui/stats-modal';
import { AddTimeModal } from './ui/add-time-modal';
import { SettingsTab } from './ui/settings-tab';
import { SidebarView, VIEW_TYPE } from './ui/sidebar-view';

export default class TimeTrackerPlugin extends Plugin {
	settings!: TimeTrackerSettings;
	store!: Store;
	timer!: Timer;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.store = new Store(this);
		await this.store.load();

		this.timer = new Timer(this.store, (state) => this.saveTimerState(state));
		this.timer.load(this.settings.timerState);

		this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this));
		new StatusBar(this);

		this.addCommand({
			id: 'open-tracker',
			name: 'Open Time Tracker',
			callback: () => this.activateSidebar(),
		});

		this.addCommand({
			id: 'start-stop',
			name: 'Start/Stop Timer',
			callback: async () => {
				if (this.timer.status === 'running') {
					await this.timer.stop();
				} else {
					await this.activateSidebar();
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
			callback: () => new AddTimeModal(this.app, this.store).open(),
		});

		this.addSettingTab(new SettingsTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.initSidebar());
	}

	async activateSidebar(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	// Create the view on startup if absent, but don't steal the sidebar
	private async initSidebar(): Promise<void> {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
		await this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE });
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) ?? {};
		const raw = saved.dailyGoalMins;
		const goals: unknown[] = Array.isArray(raw) ? raw : Array(7).fill(raw);
		this.settings = {
			timerState: saved.timerState ?? { ...DEFAULT_SETTINGS.timerState },
			dailyGoalMins: DEFAULT_SETTINGS.dailyGoalMins.map((d, i) => (typeof goals[i] === 'number' ? (goals[i] as number) : d)),
			pillLabelChars: typeof saved.pillLabelChars === 'number' && saved.pillLabelChars > 0 ? saved.pillLabelChars : DEFAULT_SETTINGS.pillLabelChars,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async saveTimerState(state: TimerState): Promise<void> {
		this.settings.timerState = state;
		await this.saveSettings();
	}
}
