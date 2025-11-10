import { create } from 'zustand';
import { useAuth } from './supabase';

export type Plan = {
	id: string;
	user_id: string;
	title: string;
	raw_text: string;
	summary_json: any | null;
	created_at?: string;
};

export type Expense = {
	id: string;
	user_id: string;
	plan_id: string | null;
	category: string; // 交通/住宿/餐饮/门票/其他
	amount: number;
	note?: string;
	created_at?: string;
};

type DbState = {
	plans: Plan[];
	expenses: Expense[];
	loadPlans: () => Promise<void>;
	createPlan: (p: Omit<Plan, 'id' | 'user_id' | 'created_at'>) => Promise<Plan>;
	loadExpenses: (planId?: string) => Promise<void>;
	addExpense: (e: Omit<Expense, 'id' | 'user_id' | 'created_at'>) => Promise<Expense>;
};

export const useDb = create<DbState>((set, get) => ({
	plans: [],
	expenses: [],
	async loadPlans() {
		const { client, user } = useAuth.getState();
		if (!client || !user) return;
		const { data, error } = await client.from('plans').select('*').order('created_at', { ascending: false });
		if (error) throw error;
		set({ plans: data as any });
	},
	async createPlan(p) {
		const { client, user } = useAuth.getState();
		if (!client || !user) throw new Error('未登录');
		const payload = { ...p, user_id: user.id };
		const { data, error } = await client.from('plans').insert(payload).select('*').single();
		if (error) throw error;
		const created = data as Plan;
		set({ plans: [created, ...get().plans] });
		return created;
	},
	async loadExpenses(planId) {
		const { client, user } = useAuth.getState();
		if (!client || !user) return;
		let query = client.from('expenses').select('*').order('created_at', { ascending: false });
		if (planId) query = query.eq('plan_id', planId);
		const { data, error } = await query;
		if (error) throw error;
		set({ expenses: data as any });
	},
	async addExpense(e) {
		const { client, user } = useAuth.getState();
		if (!client || !user) throw new Error('未登录');
		const payload = { ...e, user_id: user.id };
		const { data, error } = await client.from('expenses').insert(payload).select('*').single();
		if (error) throw error;
		const created = data as Expense;
		set({ expenses: [created, ...get().expenses] });
		return created;
	}
}));


