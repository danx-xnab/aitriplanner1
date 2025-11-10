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
		'你是一位专业的中文旅行规划师，需输出详尽且可执行的方案。请先用中文概述总体行程亮点、每日主题及关键提示，然后按照以下要求编排每日行程：',
		'1) 每天须包含上午/下午/晚上三个时段，每个时段至少安排 2-3 个要点（景点、餐饮、体验等），给出简洁描述与理由；',
		'2) 为每个时段给出合理的时间范围（如 09:00-11:30），并考虑景点之间的距离与交通方式（步行/公交/地铁/打车等）；',
		'3) 重点景点需说明特色、适宜人群或季节注意事项；如遇雨天或带娃/长者，应给出替代方案或提醒；',
		'4) 每日至少推荐 1 家当地特色餐饮，并说明推荐理由（口味/招牌菜/价格区间）；',
		'5) 住宿建议需包含推荐区域、理由、预算档位（经济/舒适/高端）；',
		'6) 提供完整的费用估算：交通/住宿/餐饮/门票/购物/其他，并给出每日与总计；',
		'7) 给出旅行小贴士（天气、预约、打包建议、安全提示等）；',
		'8) 所有景点、餐厅、酒店名称必须为可在高德地图搜索的中文名称。',
		'',
		'最后必须输出一个 JSON 概要，使用 ```json 代码块包裹，格式严格如下：',
		'{',
		'  "days": [',
		'    {',
		'      "day": 1,',
		'      "morning": ["条目1", "条目2"],',
		'      "afternoon": ["条目1", "条目2"],',
		'      "evening": ["条目1", "条目2"],',
		'      "poiList": [',
		'        { "name": "地点名", "city": "所属城市或区县", "day": 1 }',
		'      ]',
		'    }',
		'  ],',
		'  "poiList": [',
		'    { "name": "地点名", "city": "所属城市或区县", "day": 1, "lat": null, "lng": null }',
		'  ],',
		'  "budgetSummary": { "交通": 金额, "住宿": 金额, "餐饮": 金额, "门票": 金额, "购物": 金额, "其他": 金额 }',
		'}',
		'注意：',
		'- JSON 字段必须齐全且为有效 JSON；',
		'- day 必须与实际天数一致；',
		'- poiList 至少包含每天的主要地点；',
		'- lat/lng 可留空（使用 null）；',
		'- 数值均用数字，不带人民币符号。',
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


