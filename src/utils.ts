import { Session } from './types';

export interface Range { start: Date; end: Date }

export const PROJECT_PALETTE = ['#5f8eed', '#50c878', '#f5a623', '#e05a5a', '#9b59b6', '#26a69a', '#e91e63', '#8d6e63'];

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

// Whole or half hours: "10h", "7.5h"
export function formatHours(ms: number): string {
	return `${Math.round(ms / 1.8e6) / 2}h`;
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

export function overlaps(session: Session, range: Range): boolean {
	return new Date(session.start).getTime() < range.end.getTime() &&
		new Date(session.end).getTime() > range.start.getTime();
}

export function clampedDuration(session: Session, rangeStart: Date, rangeEnd: Date): number {
	const start = Math.max(new Date(session.start).getTime(), rangeStart.getTime());
	const end = Math.min(new Date(session.end).getTime(), rangeEnd.getTime());
	return Math.max(end - start, 0);
}

export function dayRange(d: Date): Range {
	const start = new Date(d);
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { start, end };
}

// Monday-start
export function weekRange(d: Date): Range {
	const start = new Date(d);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	const end = new Date(start);
	end.setDate(end.getDate() + 7);
	return { start, end };
}

export function monthRange(d: Date): Range {
	return {
		start: new Date(d.getFullYear(), d.getMonth(), 1),
		end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
	};
}

export function daysIn(range: Range): number {
	return Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
}

// Fraction of the range that has elapsed, clamped to [0, 1]
export function elapsedFraction(range: Range, now = Date.now()): number {
	const f = (now - range.start.getTime()) / (range.end.getTime() - range.start.getTime());
	return Math.min(Math.max(f, 0), 1);
}

export function getContrastColor(color: string): string {
	let hex = color.trim().replace('#', '');
	if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
	if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#2e2e2e' : '#ffffff';
}
