import { useEffect, useMemo, useState } from 'react';
import { useDb, Expense } from '@/services/db';
import { useDb as usePlansDb } from '@/services/db';
import VoiceInput from '@/components/VoiceInput';
import { estimateBudgetFromPlan } from '@/services/llm';

export default function Budget() {
	const { expenses, loadExpenses, addExpense } = useDb();
	const { plans, loadPlans } = usePlansDb();
	const [planId, setPlanId] = useState<string | undefined>(undefined);
	const [category, setCategory] = useState('餐饮');
	const [amount, setAmount] = useState<string>('');
	const [note, setNote] = useState('');
	const [msg, setMsg] = useState('');
	const [aiBudget, setAiBudget] = useState<{ total: number; items: { category: string; amount: number; note?: string }[] } | null>(null);
	const [estimating, setEstimating] = useState(false);

	useEffect(() => {
		loadPlans().catch(() => {});
	}, [loadPlans]);
	useEffect(() => {
		loadExpenses(planId).catch(() => {});
	}, [planId, loadExpenses]);

	const total = useMemo(() => expenses.reduce((s, e) => s + (e.amount ?? 0), 0), [expenses]);
	const byCategory = useMemo(() => {
		const map = new Map<string, number>();
		for (const e of expenses) {
			const k = e.category || '其他';
			map.set(k, (map.get(k) || 0) + (e.amount ?? 0));
		}
		return Array.from(map.entries()).map(([k, v]) => ({ category: k, amount: v }));
	}, [expenses]);
	const maxAmount = useMemo(() => Math.max(1, ...byCategory.map(x => x.amount)), [byCategory]);
	const compare = useMemo(() => {
		// 形成 {category -> {actual, planned, delta}}
		const result: { category: string; actual: number; planned: number; delta: number }[] = [];
		const categories = new Set<string>([
			...byCategory.map(x => x.category),
			...(aiBudget?.items?.map(i => i.category) ?? [])
		]);
		for (const c of categories) {
			const actual = byCategory.find(x => x.category === c)?.amount ?? 0;
			const planned = aiBudget?.items?.find(i => i.category === c)?.amount ?? 0;
			result.push({ category: c, actual, planned, delta: actual - planned });
		}
		return result;
	}, [byCategory, aiBudget]);

	function formatDate(value?: string | null) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value ?? '';
		return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	}

	async function save() {
		setMsg('');
		const n = Number(amount);
		if (!n || n <= 0) return setMsg('请输入有效金额');
		try {
			await addExpense({ plan_id: planId ?? null, category, amount: n, note });
			setAmount(''); setNote(''); setMsg('已记录');
		} catch (e: any) {
			setMsg(e?.message ?? '保存失败');
		}
	}

	function parseVoice(text: string) {
		// 智能解析：“今天地铁5元”、“滴滴打车28 去酒店”、“午餐 36 牛肉面”、“住如家 268”
		try {
			const lower = text.toLowerCase();
			// 类别关键词
			const rules: { key: string; cat: string }[] = [
				{ key: '地铁', cat: '交通' }, { key: '公交', cat: '交通' }, { key: '打车', cat: '交通' }, { key: '滴滴', cat: '交通' }, { key: '高铁', cat: '交通' }, { key: '动车', cat: '交通' }, { key: '飞机', cat: '交通' },
				{ key: '早餐', cat: '餐饮' }, { key: '午餐', cat: '餐饮' }, { key: '晚餐', cat: '餐饮' }, { key: '咖啡', cat: '餐饮' }, { key: '奶茶', cat: '餐饮' }, { key: '小吃', cat: '餐饮' }, { key: '美食', cat: '餐饮' },
				{ key: '酒店', cat: '住宿' }, { key: '民宿', cat: '住宿' }, { key: '青旅', cat: '住宿' },
				{ key: '门票', cat: '门票' }, { key: '景区', cat: '门票' }, { key: '乐园', cat: '门票' },
			];
			let detected: string | null = null;
			for (const r of rules) {
				if (text.includes(r.key)) { detected = r.cat; break; }
			}
			if (!detected) {
				const explicit = text.match(/(交通|住宿|餐饮|门票|其他)/);
				if (explicit) detected = explicit[1];
			}
			if (detected) setCategory(detected);
			const amtMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(元|块|人民币)?/);
			if (amtMatch) setAmount(amtMatch[1]);
			const afterAmtIndex = amtMatch ? (text.indexOf(amtMatch[0]) + amtMatch[0].length) : -1;
			if (afterAmtIndex >= 0) {
				const rest = text.slice(afterAmtIndex).trim();
				if (rest) setNote(rest || text);
			} else {
				// 回退到空格切分
				const parts = text.trim().split(/\s+/);
				if (parts.length >= 2) {
					if (!detected) setCategory(parts[0]);
					const n = parseFloat(parts[1]);
					if (!isNaN(n)) setAmount(String(n));
					if (parts[2]) setNote(parts.slice(2).join(' '));
				}
			}
		} catch {}
	}

	async function runEstimate() {
		setEstimating(true); setMsg('');
		try {
			const plan = plans.find(p => p.id === (planId ?? '')) || null;
			const source = plan?.summary_json ? JSON.stringify(plan.summary_json) : (plan?.raw_text || '无行程文本');
			const res = await estimateBudgetFromPlan(source);
			setAiBudget(res);
		} catch (e: any) {
			setMsg(e?.message ?? 'AI 估算失败');
		} finally {
			setEstimating(false);
		}
	}

	return (
		<div className="page budget-page">
			<section className="card surface input-card">
				<header className="card-header">
					<div>
						<h2 className="card-heading">预算与开销</h2>
						<p className="card-subheading">用语音或手动记录每笔消费，随时查看分类汇总与 AI 预算对比</p>
					</div>
				</header>
				<div className="input-stack">
					<label className="label">关联行程</label>
					<select className="text-input" value={planId ?? ''} onChange={(e) => setPlanId(e.target.value || undefined)}>
						<option value="">不关联（通用预算）</option>
						{plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
					</select>
					<label className="label">记录一笔开销</label>
					<div className="input-row">
						<select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
							<option>交通</option>
							<option>住宿</option>
							<option>餐饮</option>
							<option>门票</option>
							<option>其他</option>
						</select>
						<input className="text-input" placeholder="金额" value={amount} onChange={(e) => setAmount(e.target.value)} />
						<input className="text-input" placeholder="备注 / 内容" value={note} onChange={(e) => setNote(e.target.value)} />
						<VoiceInput onResult={parseVoice} />
					</div>
					<div className="input-actions">
						<button className="btn primary" onClick={save}>保存记录</button>
						<button className="btn ghost" onClick={runEstimate} disabled={estimating || !planId}>
							{estimating ? 'AI 估算中…' : 'AI 估算预算'}
						</button>
						{!planId && <div className="hint">请选择一个行程以进行预算估算</div>}
					</div>
					{msg && <div className="hint">{msg}</div>}
				</div>
			</section>

			<section className="dashboard-grid budget-layout">
				<div className="card surface budget-summary-card">
					<div className="stat-highlight">
						<span className="stat-label">累计支出</span>
						<span className="stat-value">¥{total.toFixed(2)}</span>
					</div>
					<div className="label">分类汇总</div>
					{byCategory.length === 0 ? (
						<div className="empty-state">暂无消费记录</div>
					) : (
						<div className="progress-list">
							{byCategory.map(item => (
								<div className="progress-item" key={item.category}>
									<div className="progress-meta">
										<span>{item.category}</span>
										<strong>¥{item.amount.toFixed(2)}</strong>
									</div>
									<div className="progress-bar">
										<span style={{ width: `${(item.amount / maxAmount) * 100}%` }} />
									</div>
								</div>
							))}
						</div>
					)}
					{aiBudget && (
						<div className="compare-card">
							<div className="compare-header">
								<span>AI 估算对比</span>
								<strong>总额 ¥{(aiBudget.total ?? 0).toFixed(2)}</strong>
							</div>
							<div className="compare-grid">
								{compare.map(row => (
									<div className="compare-row" key={row.category}>
										<span className="compare-label">{row.category}</span>
										<span className="compare-plan">计划 ¥{row.planned.toFixed(2)}</span>
										<span className="compare-actual">实际 ¥{row.actual.toFixed(2)}</span>
										<span className={`compare-delta ${row.delta > 0 ? 'over' : 'under'}`}>
											{row.delta > 0 ? '+' : ''}¥{row.delta.toFixed(2)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
				<div className="card surface budget-list-card">
					<div className="card-title">记录列表</div>
					<div className="record-list">
						{expenses.length === 0 ? (
							<div className="empty-state">暂无记录</div>
						) : (
							expenses.map((e: Expense) => (
								<div className="record-item" key={e.id}>
									<div className="record-main">
										<div className="record-amount">¥{Number(e.amount ?? 0).toFixed(2)}</div>
										<div className="record-meta-tags">
											<span className="record-tag">{e.category}</span>
											{e.note && <span className="record-note">{e.note}</span>}
										</div>
									</div>
									<div className="record-time">{formatDate(e.created_at)}</div>
								</div>
							))
						)}
					</div>
				</div>
			</section>
		</div>
	);
}


