import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { formatHM, formatHMS } from '../utils';
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
		this.registerInterval(window.setInterval(() => this.tick(), 1000));
		// Pace marker and daily average drift with the clock; a redraw every 5 min is plenty
		this.registerInterval(window.setInterval(() => {
			if (this.activeTab === 'analytics' && timer.status !== 'running') this.render();
		}, 5 * 60_000));
		this.render();
	}

	// Updates the ticking numbers in place; a full render each second would swallow clicks mid-press
	private tick(): void {
		const { timer } = this.plugin;
		if (timer.status !== 'running' || this.activeTab !== 'timer') return;
		const el = this.contentEl;
		el.querySelector('.timer-display')?.setText(formatHMS(timer.elapsed));

		const live = el.querySelector<HTMLElement>('.session-row.live');
		const nav = el.querySelector<HTMLElement>('.session-nav');
		const bar = el.querySelector<HTMLElement>('.today-progress');
		if (!live || !nav || !bar) return;
		const liveMs = Date.now() - Number(live.dataset.startMs);
		const totalMs = Number(nav.dataset.baseMs) + liveMs;
		live.querySelector('.live-time')?.setText(formatHM(liveMs));
		nav.querySelector('.session-nav-total')?.setText(formatHM(totalMs));
		const goalMs = Number(bar.dataset.goalMs);
		const fill = bar.querySelector<HTMLElement>('.today-progress-fill');
		if (fill) fill.style.width = `${goalMs > 0 ? Math.min(totalMs / goalMs, 1) * 100 : 0}%`;
	}

	private render(): void {
		const container = this.contentEl;
		const prevScroll = container.querySelector('.timer-view, .analytics-view')?.scrollTop ?? 0;
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
			const view = container.querySelector('.analytics-view');
			if (view) view.scrollTop = prevScroll;
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
