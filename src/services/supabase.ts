import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { useSettingsStore } from './storage';

type AuthState = {
	client: SupabaseClient | null;
	session: Session | null;
	user: User | null;
	initClient: () => void;
	signInWithEmail: (email: string, password: string) => Promise<void>;
	signUpWithEmail: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
	client: null,
	session: null,
	user: null,
	initClient() {
		const { supabaseUrl, supabaseAnonKey } = useSettingsStore.getState();
		if (!supabaseUrl || !supabaseAnonKey) {
			set({ client: null, session: null, user: null });
			return;
		}
		const client = createClient(supabaseUrl, supabaseAnonKey);
		set({ client });
		client.auth.getSession().then(({ data }) => {
			set({ session: data.session ?? null, user: data.session?.user ?? null });
		});
		client.auth.onAuthStateChange((_event, session) => {
			set({ session: session ?? null, user: session?.user ?? null });
		});
	},
	async signInWithEmail(email: string, password: string) {
		const client = get().client;
		if (!client) throw new Error('未配置 Supabase URL/anon key');
		const { error } = await client.auth.signInWithPassword({ email, password });
		if (error) throw error;
	},
	async signUpWithEmail(email: string, password: string) {
		const client = get().client;
		if (!client) throw new Error('未配置 Supabase URL/anon key');
		const { error } = await client.auth.signUp({ email, password });
		if (error) throw error;
	},
	async signOut() {
		const client = get().client;
		if (!client) return;
		await client.auth.signOut();
	}
}));


