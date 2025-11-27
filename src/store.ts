import { Plugin } from 'obsidian';
import { TimeData, Session, Project, DEFAULT_PROJECTS } from './types';

const DATA_FILE = 'time-data.json';

export class Store {
	private plugin: Plugin;
	private data: TimeData = { projects: [], sessions: [] };

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	private get path(): string {
		return `${this.plugin.manifest.dir}/${DATA_FILE}`;
	}

	async load(): Promise<void> {
		const { adapter } = this.plugin.app.vault;
		if (await adapter.exists(this.path)) {
			this.data = JSON.parse(await adapter.read(this.path));
		} else {
			this.data = { projects: [...DEFAULT_PROJECTS], sessions: [] };
			await this.save();
		}
	}

	async save(): Promise<void> {
		await this.plugin.app.vault.adapter.write(
			this.path,
			JSON.stringify(this.data, null, '\t')
		);
	}

	// Projects
	get projects(): Project[] {
		return this.data.projects;
	}

	getProject(id: string): Project | undefined {
		return this.data.projects.find(p => p.id === id);
	}

	async addProject(project: Project): Promise<void> {
		this.data.projects.push(project);
		await this.save();
	}

	async updateProject(id: string, updates: Partial<Project>): Promise<void> {
		const project = this.getProject(id);
		if (project) {
			Object.assign(project, updates);
			await this.save();
		}
	}

	async deleteProject(id: string): Promise<void> {
		this.data.projects = this.data.projects.filter(p => p.id !== id);
		this.data.sessions = this.data.sessions.filter(s => s.project !== id);
		await this.save();
	}

	// Sessions
	get sessions(): Session[] {
		return this.data.sessions;
	}

	async addSession(session: Session): Promise<void> {
		this.data.sessions.push(session);
		await this.save();
	}

	async updateSession(index: number, session: Session): Promise<void> {
		if (index >= 0 && index < this.data.sessions.length) {
			this.data.sessions[index] = session;
			await this.save();
		}
	}

	async deleteSession(index: number): Promise<void> {
		if (index >= 0 && index < this.data.sessions.length) {
			this.data.sessions.splice(index, 1);
			await this.save();
		}
	}

	// Queries
	getSessionsInRange(start: Date, end: Date): Session[] {
		return this.data.sessions.filter(s => {
			const t = new Date(s.start).getTime();
			return t >= start.getTime() && t < end.getTime();
		});
	}

	getTotalTime(sessions: Session[]): number {
		return sessions.reduce((sum, s) => {
			return sum + new Date(s.end).getTime() - new Date(s.start).getTime();
		}, 0);
	}

	getTodaySessions(): Session[] {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return this.getSessionsInRange(start, end);
	}

	getWeekSessions(): Session[] {
		const now = new Date();
		const start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		end.setDate(end.getDate() + 7);
		return this.getSessionsInRange(start, end);
	}
}
