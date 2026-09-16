import { Events, Notice, Plugin } from 'obsidian';
import { TimeData, Session, Project, DEFAULT_PROJECTS } from './types';
import { clampedDuration, overlaps, Range } from './utils';

const DATA_FILE = 'time-data.json';

// Emits 'change' after every successful save.
export class Store extends Events {
	private data: TimeData = { projects: [], sessions: [] };
	private unreadable = false;

	constructor(private plugin: Plugin) {
		super();
	}

	private get path(): string {
		return `${this.plugin.manifest.dir}/${DATA_FILE}`;
	}

	// Never writes on load: a missing file may be a sync race, and a corrupt one must be kept for recovery.
	async load(): Promise<void> {
		const { adapter } = this.plugin.app.vault;
		if (!(await adapter.exists(this.path))) {
			this.data = { projects: [...DEFAULT_PROJECTS], sessions: [] };
			return;
		}
		try {
			const raw = JSON.parse(await adapter.read(this.path));
			this.data = {
				projects: Array.isArray(raw.projects) ? raw.projects : [],
				sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
			};
		} catch {
			this.unreadable = true;
			new Notice(`Time Tracker: could not read ${DATA_FILE}. Changes will not be saved until it is fixed.`, 0);
		}
	}

	async save(): Promise<void> {
		if (this.unreadable) {
			new Notice(`Time Tracker: not saving over an unreadable ${DATA_FILE}.`);
			return;
		}
		await this.plugin.app.vault.adapter.write(this.path, JSON.stringify(this.data, null, '\t'));
		this.trigger('change');
	}

	// Projects (active only — pickers exclude archived)
	get projects(): Project[] {
		return this.data.projects.filter(p => !p.archived);
	}

	get archivedProjects(): Project[] {
		return this.data.projects.filter(p => p.archived);
	}

	// Searches all projects, including archived, so history resolves
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

	async archiveProject(id: string): Promise<void> {
		await this.updateProject(id, { archived: true });
	}

	async restoreProject(id: string): Promise<void> {
		await this.updateProject(id, { archived: false });
	}

	// Removes the project record only; sessions are always kept
	async deleteProject(id: string): Promise<void> {
		this.data.projects = this.data.projects.filter(p => p.id !== id);
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

	getSessionsWithIndices(range: Range): { index: number; session: Session }[] {
		return this.data.sessions
			.map((session, index) => ({ index, session }))
			.filter(({ session }) => overlaps(session, range));
	}

	getSessionsInRange(range: Range): Session[] {
		return this.data.sessions.filter(s => overlaps(s, range));
	}

	getTotalTimeInRange(sessions: Session[], range: Range): number {
		return sessions.reduce((sum, s) => sum + clampedDuration(s, range.start, range.end), 0);
	}
}
