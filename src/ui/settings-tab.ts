import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { Project, AVAILABLE_ICONS } from '../types';
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
			.setDesc('Target minutes per day (S M T W T F S)');
		const row = goalSetting.controlEl.createDiv('daily-goal-row');
		const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
		const goals = this.plugin.settings.dailyGoalMins;
		for (let i = 0; i < 7; i++) {
			const col = row.createDiv('daily-goal-col');
			col.createEl('label', { text: days[i], cls: 'daily-goal-label' });
			const input = col.createEl('input', { cls: 'daily-goal-input' });
			input.type = 'number';
			input.min = '0';
			input.value = String(goals[i]);
			const idx = i;
			input.addEventListener('change', async () => {
				this.plugin.settings.dailyGoalMins[idx] = parseInt(input.value) || 0;
				await this.plugin.saveSettings();
			});
		}

		containerEl.createEl('h2', { text: 'Projects' });

		for (const project of this.plugin.store.projects) {
			this.renderProject(containerEl, project);
		}

		new Setting(containerEl)
			.addButton(btn => {
				btn.setButtonText('Add Project');
				btn.setCta();
				btn.onClick(async () => {
					const id = `project-${Date.now()}`;
					await this.plugin.store.addProject({
						id,
						name: 'New Project',
						color: this.randomColor(),
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

		const iconSpan = setting.nameEl.createSpan({ cls: 'project-icon' });
		setIcon(iconSpan, project.icon || 'folder');
		setting.nameEl.prepend(iconSpan);

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

	private renderProject(container: HTMLElement, project: Project): void {
		const setting = new Setting(container);

		setting.setName(project.name);

		const iconSpan = setting.nameEl.createSpan({ cls: 'project-icon' });
		setIcon(iconSpan, project.icon || 'folder');
		setting.nameEl.prepend(iconSpan);

		setting.addDropdown(dropdown => {
			for (const icon of AVAILABLE_ICONS) {
				dropdown.addOption(icon, icon);
			}
			dropdown.setValue(project.icon || 'folder');
			dropdown.onChange(async v => {
				await this.plugin.store.updateProject(project.id, { icon: v });
				iconSpan.empty();
				setIcon(iconSpan, v);
			});
		});

		setting.addText(text => {
			text.setValue(project.name);
			text.onChange(async v => {
				await this.plugin.store.updateProject(project.id, { name: v });
				setting.setName(v);
			});
		});

		setting.addText(text => {
			text.inputEl.type = 'color';
			text.inputEl.addClass('color-input');
			text.setValue(project.color);
			text.onChange(async v => {
				await this.plugin.store.updateProject(project.id, { color: v });
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

	private randomColor(): string {
		const hue = Math.floor(Math.random() * 360);
		return `hsl(${hue}, 60%, 50%)`;
	}
}
