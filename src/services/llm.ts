import axios from 'axios';
import { useSettingsStore } from './storage';

export async function planItinerary(userPrompt: string, apiBaseOverride?: string): Promise<string> {
	const { llmApiKey, llmApiBase } = useSettingsStore.getState();
	if (!llmApiKey) throw new Error('请在设置中填写阿里云百炼 LLM API Key');
	const apiBase = apiBaseOverride || llmApiBase || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
	// 通过后端代理，避免在浏览器直接调用第三方服务
	const resp = await axios.post(
		'/api/llm/plan',
		{
			model: 'qwen-max', // 映射到后端使用 Qwen3-Max
			prompt: buildPrompt(userPrompt)
		},
		{
			headers: {
				'x-llm-api-key': llmApiKey,
				'x-llm-api-base': apiBase
			},
			timeout: 60000
		}
	);
	return resp.data?.text ?? '';
}

function buildPrompt(userPrompt: string): string {
	return [
		'你是专业的中文旅行规划助手。请生成“详尽且结构化”的行程，包括：',
		'1) 每日行程（上午/下午/晚上三个时段），各列出至少2-3个要点（含景点/餐饮与简短理由/交通建议）；',
		'2) 住宿建议（区域+理由+价格区间）；',
		'3) 预算分项估计（交通/住宿/餐饮/门票/其他）；',
		'4) 带娃/老人/雨天等注意事项与替代方案；',
		'5) 所有地点名称需为可在高德搜索的中文名称；',
		'请先以中文段落给出总览与天数安排，然后“必须输出一个 JSON 概要”，使用 ```json 代码块包裹，严格结构如下：',
		'{',
		'  "days": [',
		'    { "day": 1, "morning": ["..."], "afternoon": ["..."], "evening": ["..."],',
		'      "poiList": [ { "name": "地点名", "city": "城市", "day": 1 } ] }',
		'  ],',
		'  "poiList": [',
		'    { "name": "地点名", "city": "城市", "day": 1, "lat": null, "lng": null }',
		'  ],',
		'  "budgetSummary": { "交通": 0, "住宿": 0, "餐饮": 0, "门票": 0, "其他": 0 }',
		'}',
		'注意：lat/lng 可留空；day 必填；poiList 中至少包含每天的主要地点。',
		'用户需求：',
		userPrompt
	].join('\n');
}

export async function estimateBudgetFromPlan(planTextOrSummary: string, apiBaseOverride?: string): Promise<{ total: number; items: { category: string; amount: number; note?: string }[] }> {
	const { llmApiKey, llmApiBase } = useSettingsStore.getState();
	if (!llmApiKey) throw new Error('请在设置中填写阿里云百炼 LLM API Key');
	const apiBase = apiBaseOverride || llmApiBase || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
	const prompt = [
		'请基于以下旅行行程或预算概要，给出严格 JSON 的预算估算：',
		'输出结构：',
		'{ "total": number, "items": [ { "category": "交通|住宿|餐饮|门票|其他", "amount": number, "note": string? } ] }',
		'币种：人民币，数值为数字，不带 ¥ 或 人民币 字样。',
		'以下为行程/概要：',
		planTextOrSummary
	].join('\n');
	const resp = await axios.post(
		'/api/llm/budget',
		{
			model: 'qwen-max',
			prompt
		},
		{
			headers: {
				'x-llm-api-key': llmApiKey,
				'x-llm-api-base': apiBase
			},
			timeout: 60000
		}
	);
	const text = resp.data?.text ?? '{}';
	try {
		return JSON.parse(text);
	} catch {
		return { total: 0, items: [] };
	}
}


