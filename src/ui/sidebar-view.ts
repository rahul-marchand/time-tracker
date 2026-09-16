import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { TimerSection } from './timer-section';
import { SessionsSection } from './sessions-section';
import { AnalyticsSection } from './analytics-section';

export const VIEW_TYPE = 'time-tracker-sidebar';

type Tab = 'timer' | 'analytics';
type AnalyticsMode = 'week' | 'month';

export class SidebarView extends ItemView {
	private activeTab: Tab = 'timer';
	private analyticsMode: AnalyticsMode = 'week';
	private dayOffset = 0; // 0 = today; derived each render so midnight rolls over

	private timerSection: TimerSection;
	private sessionsSection: SessionsSection;
	private analyticsSection: AnalyticsSection;

	constructor(leaf: WorkspaceLeaf, private plugin: TimeTrackerPlugin) {
		super(leaf);
		this.timerSection = new TimerSection(plugin);
		this.sessionsSection = new SessionsSection(plugin);
		this.analyticsSection = new AnalyticsSection(plugin.store);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return 'Time Tracker'; }
	getIcon(): string { return 'clock'; }

	async onOpen(): Promise<void> {
		const { timer, store } = this.plugin;
		this.registerEvent(timer.on('change', () => this.render()));
		this.registerEvent(store.on('change', () => this.render()));
		this.registerInterval(window.setInterval(() => {
			if (timer.status === 'running') this.render();
		}, 1000));
		this.render();
	}

	private render(): void {
		const container = this.contentEl;
		const prevScroll = container.querySelector('.timer-view')?.scrollTop ?? 0;
		container.empty();
		container.addClass('time-tracker-sidebar');

		this.renderTabs(container);

		if (this.activeTab === 'timer') {
			const view = container.createDiv('timer-view');
			const viewDate = new Date();
			viewDate.setHours(0, 0, 0, 0);
			viewDate.setDate(viewDate.getDate() - this.dayOffset);
			this.timerSection.render(view, viewDate);
			this.sessionsSection.render(view, viewDate, this.dayOffset === 0, (delta) => {
				this.dayOffset = Math.max(this.dayOffset - delta, 0);
				this.render();
			});
			view.scrollTop = prevScroll;
		} else {
			this.analyticsSection.render(container, this.analyticsMode, (m) => {
				this.analyticsMode = m;
				this.render();
			});
		}
	}

	private renderTabs(container: HTMLElement): void {
		const tabs = container.createDiv('sidebar-tabs');
		tabs.setAttr('role', 'tablist');
		const add = (tab: Tab, label: string) => {
			const btn = tabs.createEl('button', { cls: 'sidebar-tab', text: label });
			btn.setAttr('role', 'tab');
			btn.setAttr('aria-selected', String(this.activeTab === tab));
			if (this.activeTab === tab) btn.addClass('active');
			btn.onClickEvent(() => { this.activeTab = tab; this.render(); });
		};
		add('timer', 'Timer');
		add('analytics', 'Analytics');
	}
}
