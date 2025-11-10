import { create } from 'zustand';

type SettingsState = {
	llmApiKey: string;
	llmApiBase: string;
	amapKey: string;
	supabaseUrl: string;
	supabaseAnonKey: string;
	saveAll: (v: Partial<SettingsState>) => void;
};

const KEY = 'ai-travel-planner:settings';

function load(): Omit<SettingsState, 'saveAll'> {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { llmApiKey: '', llmApiBase: '', amapKey: '', supabaseUrl: '', supabaseAnonKey: '' };
		const v = JSON.parse(raw);
		return {
			llmApiKey: v.llmApiKey ?? '',
			llmApiBase: v.llmApiBase ?? '',
			amapKey: v.amapKey ?? '',
			supabaseUrl: v.supabaseUrl ?? '',
			supabaseAnonKey: v.supabaseAnonKey ?? ''
		};
	} catch {
		return { llmApiKey: '', llmApiBase: '', amapKey: '', supabaseUrl: '', supabaseAnonKey: '' };
	}
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
	...load(),
	saveAll(v) {
		const next = { ...get(), ...v };
		set(next);
		try {
			localStorage.setItem(KEY, JSON.stringify({
				llmApiKey: next.llmApiKey,
				llmApiBase: next.llmApiBase,
				amapKey: next.amapKey,
				supabaseUrl: next.supabaseUrl,
				supabaseAnonKey: next.supabaseAnonKey
			}));
		} catch {
			// ignore quota
		}
	}
}));


