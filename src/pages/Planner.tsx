import { useState } from 'react';
import VoiceInput from '@/components/VoiceInput';
import MapView from '@/components/MapView';
import { planItinerary } from '@/services/llm';
import { useSettingsStore } from '@/services/storage';
import { useAuth } from '@/services/supabase';
import { useDb, Plan } from '@/services/db';
import { geocodePois } from '@/services/amap';

export default function Planner() {
	const [prompt, setPrompt] = useState('');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<string>('');
	const { llmApiBase } = useSettingsStore();
	const { user } = useAuth();
	const { plans, loadPlans, createPlan } = useDb();
	const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
	const [markers, setMarkers] = useState<{ lng: number; lat: number; name?: string; day?: number }[]>([]);
	const [summary, setSummary] = useState<any | null>(null);

	function extractJsonSummary(text: string): any | null {
		// 尝试抓取最后一个 JSON 代码块或大括号对象
		try {
			const fenceMatch = text.match(/```json([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/);
			if (fenceMatch && fenceMatch[1]) {
				return JSON.parse(fenceMatch[1]);
			}
		} catch {}
		try {
			// 粗略匹配最后一个 { ... } 块
			const lastBrace = text.lastIndexOf('{');
			if (lastBrace >= 0) {
				const candidate = text.slice(lastBrace);
				// 简单闭合：找到最后一个 }
				const lastClose = candidate.lastIndexOf('}');
				if (lastClose > 0) {
					const jsonStr = candidate.slice(0, lastClose + 1);
					return JSON.parse(jsonStr);
				}
			}
		} catch {}
		return null;
	}

	function buildDayIndex(summary: any | null): Map<string, number> {
		const map = new Map<string, number>();
		if (!summary || !Array.isArray(summary.days)) return map;
		for (let i = 0; i < summary.days.length; i++) {
			const d = summary.days[i];
			const dayNum = d?.day ?? i + 1;
			const points: any[] = Array.isArray(d?.poiList) ? d.poiList : (Array.isArray(d?.items) ? d.items : []);
			for (const p of points) {
				if (p?.name) map.set(String(p.name).toLowerCase(), dayNum);
			}
		}
		return map;
	}

	function refreshMarkersFromSummary(summary: any | null) {
		if (!summary || !Array.isArray(summary.poiList)) {
			setMarkers([]);
			return;
		}
		const dayIndex = buildDayIndex(summary);
		const initial = summary.poiList.map((p: any) => ({
			lng: typeof p.lng === 'number' ? p.lng : NaN,
			lat: typeof p.lat === 'number' ? p.lat : NaN,
			name: p.name,
			day: p.day ?? (p?.name ? dayIndex.get(String(p.name).toLowerCase()) : undefined),
			city: p.city
		}));
		const withCoords = initial.filter((m: any) => !Number.isNaN(m.lng) && !Number.isNaN(m.lat));
		const needGeocode = initial.filter((m: any) => Number.isNaN(m.lng) || Number.isNaN(m.lat));
		// 对已有坐标的标记也进行去重（按名称）
		const coordMap = new Map<string, any>();
		for (const m of withCoords) {
			const nameKey = String(m.name || '').toLowerCase().trim();
			if (nameKey && !coordMap.has(nameKey)) {
				coordMap.set(nameKey, { lng: m.lng, lat: m.lat, name: m.name, day: m.day });
			}
		}
		setMarkers(Array.from(coordMap.values()));
		if (needGeocode.length) {
			geocodePois(needGeocode.map((x: any) => ({ name: x.name, city: x.city }))).then((geo) => {
				if (!geo?.length) return;
				setMarkers((prev) => {
					const plus = geo.map((g) => {
						const d = initial.find((i: any) => i.name === g.name)?.day;
						return { lng: g.lng, lat: g.lat, name: g.name, day: d };
					});
					// 改进的去重：按名称分组，如果同一名称有多个坐标，优先保留第一个（通常是最准确的）
					const nameMap = new Map<string, any>();
					// 先处理已有标记
					for (const m of prev) {
						const nameKey = String(m.name || '').toLowerCase().trim();
						if (nameKey && !nameMap.has(nameKey)) {
							nameMap.set(nameKey, m);
						}
					}
					// 再处理新地理编码的结果（如果名称已存在，不覆盖，避免错误坐标覆盖正确坐标）
					for (const m of plus) {
						const nameKey = String(m.name || '').toLowerCase().trim();
						if (nameKey && !nameMap.has(nameKey)) {
							nameMap.set(nameKey, m);
						}
					}
					return Array.from(nameMap.values());
				});
			});
		}
	}

	async function handlePlan() {
		setLoading(true);
		try {
			const response = await planItinerary(prompt, llmApiBase);
			setResult(response);
			const s = extractJsonSummary(response);
			setSummary(s);
			refreshMarkersFromSummary(s);
		} catch (e: any) {
			setResult(`规划失败：${e?.message ?? '未知错误'}`);
		} finally {
			setLoading(false);
		}
	}

	async function handleSavePlan() {
		if (!user) {
			alert('请先登录后再保存行程');
			return;
		}
		if (!result) return;
		try {
			const s = extractJsonSummary(result);
			const firstLine = result.split('\n').find(l => l.trim().length > 0) || '未命名行程';
			const title = firstLine.replace(/^#+\s*/, '').slice(0, 60);
			const created = await createPlan({ title, raw_text: result, summary_json: s });
			setSelectedPlan(created);
			setSummary(s);
			refreshMarkersFromSummary(s);
			alert('已保存到云端');
		} catch (e: any) {
			alert(e?.message ?? '保存失败');
		}
	}

	function handleSelectPlan(id: string) {
		const p = plans.find(x => x.id === id) || null;
		setSelectedPlan(p);
		const s = p?.summary_json ?? null;
		setSummary(s);
		refreshMarkersFromSummary(s);
		setResult(p?.raw_text ?? '');
	}

	// 首次或登录变化时加载计划列表
	useState(() => {
		loadPlans().catch(() => {});
	});

	return (
		<div className="page planner-page">
			<section className="card surface input-card">
				<header className="card-header">
					<div>
						<h2 className="card-heading">智能行程规划</h2>
						<p className="card-subheading">用语音或文字描述旅行需求，AI 会生成逐日行程与地图标记</p>
					</div>
				</header>
				<div className="input-stack">
					<label className="label">旅行需求</label>
					<div className="input-row">
						<input
							className="text-input text-input--grow"
							placeholder="例如：我想去日本，5天，预算1万元，喜欢美食和动漫，带孩子"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
						/>
						<VoiceInput onResult={setPrompt} />
					</div>
					<div className="input-actions">
						<button className="btn primary" onClick={handlePlan} disabled={!prompt || loading}>
							{loading ? '规划中…' : '生成行程'}
						</button>
						<button className="btn ghost" onClick={handleSavePlan} disabled={!result}>保存到云端</button>
					</div>
				</div>
			</section>

			<section className="planner-layout">
				<div className="planner-left">
					<div className="card surface panel-card">
						<div className="card-title">我的行程</div>
						<p className="card-hint">切换或回顾之前保存的行程规划。</p>
						<select className="text-input" onChange={(e) => handleSelectPlan(e.target.value)} value={selectedPlan?.id ?? ''}>
							<option value="">选择一个已保存的行程</option>
							{plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
						</select>
					</div>
					<div className="card surface map-card">
						<div className="card-title">行程地图</div>
						<div className="map-shell">
							<MapView
								markers={markers}
								onSelectPlace={(p) => {
									// 将搜索选中的点暂时加入地图（不改变云端数据）
									setMarkers((prev) => [...prev, { ...p }]);
								}}
								autoDrawRoute={true}
							/>
						</div>
					</div>
				</div>
				<div className="card surface itinerary-card">
					<div className="card-title">行程规划</div>
					{result ? (
						<div className="itinerary-content">
							<pre className="result">{result}</pre>
							{summary && Array.isArray(summary.days) && (
								<div className="itinerary-summary">
									<div className="itinerary-summary-title">快速概览</div>
									<div className="itinerary-list">
										{summary.days.map((d: any, idx: number) => {
											const dayNo = d?.day ?? idx + 1;
											const morning = Array.isArray(d?.morning) ? d.morning : (d?.morning ? [d.morning] : []);
											const afternoon = Array.isArray(d?.afternoon) ? d.afternoon : (d?.afternoon ? [d.afternoon] : []);
											const evening = Array.isArray(d?.evening) ? d.evening : (d?.evening ? [d.evening] : []);
											if (Array.isArray(d?.items)) {
												for (const it of d.items) {
													const text = it?.name || it?.title || '';
													if (it?.timeOfDay === 'morning') morning.push(text);
													if (it?.timeOfDay === 'afternoon') afternoon.push(text);
													if (it?.timeOfDay === 'evening') evening.push(text);
												}
											}
											return (
												<div className="itinerary-day" key={idx}>
													<div className="itinerary-day-title">第{dayNo}天</div>
													{morning.length > 0 && <div className="itinerary-slot"><span>上午</span><p>{morning.join('、')}</p></div>}
													{afternoon.length > 0 && <div className="itinerary-slot"><span>下午</span><p>{afternoon.join('、')}</p></div>}
													{evening.length > 0 && <div className="itinerary-slot"><span>晚上</span><p>{evening.join('、')}</p></div>}
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="empty-state">等待生成…</div>
					)}
				</div>
			</section>
		</div>
	);
}


