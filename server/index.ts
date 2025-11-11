import Fastify from 'fastify';
import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const app = Fastify({
	logger: true,
	requestTimeout: 200000,
	keepAliveTimeout: 200000
});

await app.register(cors, {
	origin: (origin, cb) => {
		cb(null, true);
	}
});

app.register(
	fp(async function routes(instance) {
		instance.post('/api/llm/plan', async (req, reply) => {
			try {
				const body: any = req.body || {};
				const userKey = req.headers['x-llm-api-key'];
				const userBase = (req.headers['x-llm-api-base'] as string) || process.env.LLM_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
				if (!userKey || typeof userKey !== 'string') {
					return reply.code(400).send({ error: 'Missing x-llm-api-key' });
				}
				const model = body.model || 'qwen-max';
				const prompt = body.prompt || '';
				const resp = await axios.post(
					`${userBase}/chat/completions`,
					{
						model,
						messages: [
							{ role: 'system', content: '你是一位专业的中文旅行规划师，擅长生成详细实用的旅行行程。请用中文回复，内容要详细但简洁。' },
							{ role: 'user', content: prompt }
						],
						temperature: 0.5
					},
					{
						headers: {
							Authorization: `Bearer ${userKey}`,
							'Content-Type': 'application/json'
						},
						timeout: 180000
					}
				);
				const text =
					resp.data?.choices?.[0]?.message?.content ||
					resp.data?.choices?.[0]?.text ||
					'';
				return reply.send({ text });
			} catch (e: any) {
				const status = e?.response?.status || 500;
				const data = e?.response?.data;
				req.log.error({ err: e?.message, status, data }, 'LLM proxy error');
				return reply.code(status).send({
					error: 'LLM request failed',
					detail: typeof data === 'string' ? data : data || e?.message
				});
			}
		});
			instance.post('/api/llm/budget', async (req, reply) => {
				try {
					const body: any = req.body || {};
					const userKey = req.headers['x-llm-api-key'];
					const userBase = (req.headers['x-llm-api-base'] as string) || process.env.LLM_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
					if (!userKey || typeof userKey !== 'string') {
						return reply.code(400).send({ error: 'Missing x-llm-api-key' });
					}
					const model = body.model || 'qwen-max';
					const prompt = body.prompt || '';
					const resp = await axios.post(
						`${userBase}/chat/completions`,
						{
							model,
							messages: [
								{ role: 'system', content: 'You are an assistant that outputs strict JSON budgets for travel.' },
								{ role: 'user', content: prompt }
							],
							temperature: 0.2,
							response_format: { type: 'json_object' }
						},
						{
							headers: {
								Authorization: `Bearer ${userKey}`,
								'Content-Type': 'application/json'
							},
							timeout: 180000
						}
					);
					const text =
						resp.data?.choices?.[0]?.message?.content ||
						resp.data?.choices?.[0]?.text ||
						'{}';
					return reply.send({ text });
				} catch (e: any) {
					const status = e?.response?.status || 500;
					const data = e?.response?.data;
					req.log.error({ err: e?.message, status, data }, 'LLM budget proxy error');
					return reply.code(status).send({
						error: 'LLM request failed',
						detail: typeof data === 'string' ? data : data || e?.message
					});
				}
			});
	})
);

const port = Number(process.env.PORT || 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
	console.log(`[server] listening on http://localhost:${port}`);
});


