import { App, PluginSettingTab, Setting } from 'obsidian';
import type TimeTrackerPlugin from '../main';
import { Project } from '../types';

export class SettingsTab extends PluginSettingTab {
	plugin: TimeTrackerPlugin;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

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
					});
					this.display();
				});
			});
	}

	private renderProject(container: HTMLElement, project: Project): void {
		const setting = new Setting(container);

		setting.setName(project.name);

		const dot = setting.nameEl.createSpan({ cls: 'color-dot' });
		dot.style.backgroundColor = project.color;
		setting.nameEl.prepend(dot);

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
				dot.style.backgroundColor = v;
			});
		});

		if (this.plugin.store.projects.length > 1) {
			setting.addButton(btn => {
				btn.setIcon('trash');
				btn.setWarning();
				btn.onClick(async () => {
					await this.plugin.store.deleteProject(project.id);
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
