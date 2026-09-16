import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { Project, AVAILABLE_ICONS } from '../types';
import { PROJECT_PALETTE } from '../utils';
import { ConfirmModal } from './confirm-modal';

export class SettingsTab extends PluginSettingTab {
	plugin: TimeTrackerPlugin;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'General' });

		const goalSetting = new Setting(containerEl)
			.setName('Daily goal')
			.setDesc('Hours per day, Sunday to Saturday');
		const row = goalSetting.controlEl.createDiv('daily-goal-row');
		const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
		for (let i = 0; i < 7; i++) {
			const col = row.createDiv('daily-goal-col');
			col.createEl('label', { text: days[i], cls: 'daily-goal-label' });
			const input = col.createEl('input', { cls: 'daily-goal-input', type: 'number' });
			input.min = '0';
			input.step = '0.5';
			input.value = String(this.plugin.settings.dailyGoalMins[i] / 60);
			input.addEventListener('change', async () => {
				this.plugin.settings.dailyGoalMins[i] = Math.max(Math.round((parseFloat(input.value) || 0) * 60), 0);
				await this.plugin.saveSettings();
			});
		}

		new Setting(containerEl)
			.setName('Pill label length')
			.setDesc('Longer project names are shortened with … on the timer pills; the full name shows on hover.')
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.min = '4';
				text.inputEl.addClass('target-input');
				text.setValue(String(this.plugin.settings.pillLabelChars));
				text.inputEl.addEventListener('change', async () => {
					const n = parseInt(text.getValue());
					if (n >= 4) {
						this.plugin.settings.pillLabelChars = n;
						await this.plugin.saveSettings();
						this.plugin.store.trigger('change');
					}
				});
			});

		containerEl.createEl('h2', { text: 'Projects' });
		containerEl.createEl('p', { text: 'Weekly target in hours drives the week view: bar fill, pace marker and zero warnings.', cls: 'setting-item-description' });

		for (const project of this.plugin.store.projects) {
			this.renderProject(containerEl, project);
		}

		new Setting(containerEl).addButton(btn => {
			btn.setButtonText('Add project');
			btn.setCta();
			btn.onClick(async () => {
				const n = this.plugin.store.projects.length + this.plugin.store.archivedProjects.length;
				await this.plugin.store.addProject({
					id: `project-${Date.now()}`,
					name: 'New project',
					color: PROJECT_PALETTE[n % PROJECT_PALETTE.length],
					icon: 'folder',
				});
				this.display();
			});
		});

		const archived = this.plugin.store.archivedProjects;
		if (archived.length > 0) {
			containerEl.createEl('h2', { text: 'Archived', cls: 'archived-heading' });
			for (const project of archived) {
				this.renderArchivedProject(containerEl, project);
			}
		}
	}

	private renderArchivedProject(container: HTMLElement, project: Project): void {
		const setting = new Setting(container);
		setting.settingEl.addClass('archived-project');
		setting.setName(project.name);
		setIcon(setting.nameEl.createSpan({ cls: 'project-icon' }), project.icon || 'folder');

		setting.addButton(btn => {
			btn.setButtonText('Restore');
			btn.onClick(async () => {
				await this.plugin.store.restoreProject(project.id);
				this.display();
			});
		});

		setting.addButton(btn => {
			btn.setIcon('trash');
			btn.setTooltip('Delete permanently');
			btn.setWarning();
			btn.onClick(() => {
				const count = this.plugin.store.sessions.filter(s => s.project === project.id).length;
				new ConfirmModal(
					this.app,
					`Delete "${project.name}" permanently?`,
					`Its ${count} logged sessions are kept, but will display as grey "Unknown" without the project's name and colour. This cannot be undone.`,
					'Delete permanently',
					async () => {
						await this.plugin.store.deleteProject(project.id);
						this.display();
					}
				).open();
			});
		});
	}

	// Saves on change/blur, not per keystroke, so the data file is rewritten once per edit
	private renderProject(container: HTMLElement, project: Project): void {
		const setting = new Setting(container);
		setting.settingEl.addClass('project-setting');
		const iconSpan = setting.nameEl.createSpan({ cls: 'project-icon' });
		setIcon(iconSpan, project.icon || 'folder');

		setting.addDropdown(dropdown => {
			for (const icon of AVAILABLE_ICONS) dropdown.addOption(icon, icon);
			dropdown.setValue(project.icon || 'folder');
			dropdown.onChange(async v => {
				await this.plugin.store.updateProject(project.id, { icon: v });
				iconSpan.empty();
				setIcon(iconSpan, v);
			});
		});

		setting.addText(text => {
			text.setPlaceholder('Name');
			text.setValue(project.name);
			text.inputEl.addClass('project-name-input');
			text.inputEl.addEventListener('change', async () => {
				const v = text.getValue().trim();
				if (v) await this.plugin.store.updateProject(project.id, { name: v });
			});
		});

		const wrap = setting.controlEl.createSpan('target-wrap');
		const target = wrap.createEl('input', { cls: 'target-input', type: 'number' });
		target.min = '0';
		target.step = '0.5';
		target.placeholder = '–';
		target.setAttr('aria-label', 'Weekly target, hours');
		if (project.weeklyTargetMins) target.value = String(project.weeklyTargetMins / 60);
		target.addEventListener('change', async () => {
			const h = parseFloat(target.value);
			await this.plugin.store.updateProject(project.id, { weeklyTargetMins: h > 0 ? Math.round(h * 60) : undefined });
		});

		setting.addText(text => {
			text.inputEl.type = 'color';
			text.inputEl.addClass('color-input');
			text.setValue(project.color);
			text.inputEl.addEventListener('change', async () => {
				await this.plugin.store.updateProject(project.id, { color: text.getValue() });
			});
		});

		if (this.plugin.store.projects.length > 1) {
			setting.addButton(btn => {
				btn.setIcon('archive');
				btn.setTooltip('Archive (keeps history)');
				btn.onClick(async () => {
					await this.plugin.store.archiveProject(project.id);
					this.display();
				});
			});
		}
	}
}
