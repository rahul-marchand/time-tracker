import { Session } from './types';

export function formatHMS(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function formatHM(ms: number): string {
	const mins = Math.round(ms / 60000);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function formatHHMM(d: Date): string {
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function groupByProject(sessions: Session[]): Record<string, Session[]> {
	const result: Record<string, Session[]> = {};
	for (const s of sessions) {
		(result[s.project] ??= []).push(s);
	}
	return result;
}

export function clampedDuration(session: Session, rangeStart: Date, rangeEnd: Date): number {
	const start = Math.max(new Date(session.start).getTime(), rangeStart.getTime());
	const end = Math.min(new Date(session.end).getTime(), rangeEnd.getTime());
	return Math.max(end - start, 0);
}

export function getContrastColor(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#2e2e2e' : '#ffffff';
}
