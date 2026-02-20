import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Timer } from '../timer';
import { Store } from '../store';
import type TimeTrackerPlugin from '../main';
import { TimerSection } from './timer-section';
import { SessionsSection } from './sessions-section';
import { AnalyticsSection } from './analytics-section';

export const VIEW_TYPE = 'time-tracker-sidebar';

type Tab = 'timer' | 'analytics';
type AnalyticsMode = 'week' | 'month';

export class SidebarView extends ItemView {
	private timer: Timer;
	private store: Store;
	private plugin: TimeTrackerPlugin;
	private interval: number | null = null;
	private activeTab: Tab = 'timer';
	private analyticsMode: AnalyticsMode = 'week';
	private viewDate: Date = new Date();

	private timerSection: TimerSection;
	private sessionsSection: SessionsSection;
	private analyticsSection: AnalyticsSection;

	constructor(leaf: WorkspaceLeaf, timer: Timer, store: Store, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.timer = timer;
		this.store = store;
		this.plugin = plugin;
		this.timerSection = new TimerSection(this.app, timer, store);
		this.sessionsSection = new SessionsSection(this.app, timer, store, plugin);
		this.analyticsSection = new AnalyticsSection(store);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return 'Time Tracker'; }
	getIcon(): string { return 'clock'; }

	async onOpen(): Promise<void> {
		this.timer.on('change', () => this.render());
		this.interval = window.setInterval(() => {
			if (this.timer.status === 'running') this.render();
		}, 1000);
		this.render();
	}

	async onClose(): Promise<void> {
		if (this.interval) window.clearInterval(this.interval);
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('time-tracker-sidebar');

		this.renderTabs(container);

		if (this.activeTab === 'timer') {
			const view = container.createDiv('timer-view');
			this.timerSection.render(view, this.viewDate);
			this.sessionsSection.render(view, this.viewDate, this.isViewingToday());
		} else {
			this.analyticsSection.render(container, this.analyticsMode, (m) => {
				this.analyticsMode = m;
				this.render();
			});
		}
	}

	private renderTabs(container: HTMLElement): void {
		const tabs = container.createDiv('sidebar-tabs');

		const timerTab = tabs.createDiv('sidebar-tab');
		timerTab.setText('Timer');
		if (this.activeTab === 'timer') timerTab.addClass('active');
		timerTab.onClickEvent(() => { this.activeTab = 'timer'; this.render(); });

		const analyticsTab = tabs.createDiv('sidebar-tab');
		analyticsTab.setText('Analytics');
		if (this.activeTab === 'analytics') analyticsTab.addClass('active');
		analyticsTab.onClickEvent(() => { this.activeTab = 'analytics'; this.render(); });
	}

	private isViewingToday(): boolean {
		const today = new Date();
		return (
			this.viewDate.getFullYear() === today.getFullYear() &&
			this.viewDate.getMonth() === today.getMonth() &&
			this.viewDate.getDate() === today.getDate()
		);
	}
}
