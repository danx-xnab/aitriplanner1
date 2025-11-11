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
			timeout: 180000
		}
	);
	return resp.data?.text ?? '';
}

function buildPrompt(userPrompt: string): string {
	return [
		'你是一位专业的中文旅行规划师。请为用户生成一份详细、实用的旅行行程规划。',
		'',
		'## 输出要求：',
		'1. **行程概述**：简要介绍整体行程亮点、适合人群、最佳旅行时间。',
		'2. **每日详细安排**：按天组织，每天包含：',
		'   - 上午（09:00-12:00）：2-3个景点或活动，每个包含名称、地址、特色、参观时间、门票价格',
		'   - 下午（13:00-18:00）：2-3个景点或活动，同上',
		'   - 晚上（18:00-21:00）：餐饮推荐、夜游或休闲活动',
		'   - 交通建议：景点间交通方式、时间、费用',
		'   - 餐饮推荐：餐厅名称、地址、特色菜、人均消费',
		'3. **住宿建议**：推荐区域、酒店类型、价格区间、预订建议',
		'4. **预算明细**：交通、住宿、餐饮、门票、购物、其他分类估算',
		'5. **实用贴士**：天气、必备物品、注意事项、预约信息',
		'',
		'## 重要提示：',
		'- **地点名称要求**：所有地点名称必须为可在高德地图搜索的准确中文名称，使用官方或常用名称，不要包含时间、序号、描述性文字。例如：',
		'  ✓ 正确："故宫博物院"、"天安门广场"、"全聚德烤鸭店（前门店）"',
		'  ✗ 错误："第1天上午的故宫"、"1. 天安门"、"上午：天安门广场"',
		'- 时间安排要合理，考虑景点距离和交通时间',
		'- 费用估算要实际，参考市场价格',
		'- 内容要详细但简洁，避免冗长',
		'',
		'## 最后，请在文本末尾添加一个 JSON 概要（用于地图标记功能），用 ```json 代码块包裹：',
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
		'- poiList 应包含行程中所有主要地点（景点、餐厅、酒店等），day 字段表示第几天',
		'- name 字段必须使用纯净的地点名称，不要包含"第X天"、"上午"、"下午"等前缀或描述',
		'- city 字段填写准确的城市或区县名称，有助于提高地图搜索准确性',
		'',
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
			timeout: 180000
		}
	);
	const text = resp.data?.text ?? '{}';
	try {
		return JSON.parse(text);
	} catch {
		return { total: 0, items: [] };
	}
}


