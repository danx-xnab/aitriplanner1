import { useState } from 'react';
import { useSettingsStore } from '@/services/storage';

export default function Settings() {
	const {
		llmApiKey,
		llmApiBase,
		amapKey,
		supabaseUrl,
		supabaseAnonKey,
		saveAll
	} = useSettingsStore();

	const [form, setForm] = useState({
		llmApiKey,
		llmApiBase,
		amapKey,
		supabaseUrl,
		supabaseAnonKey
	});
	const [saved, setSaved] = useState(false);

	function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
		setSaved(false);
		setForm((f) => ({ ...f, [key]: value }));
	}

	function handleSave() {
		saveAll(form);
		setSaved(true);
	}

	return (
		<div className="settings">
			<div className="card">
				<div className="card-title">密钥与服务配置（不会上传到Git，默认存储在本地）</div>
				<div className="form-grid">
					<label>阿里云百炼 LLM API Key</label>
					<input type="password" value={form.llmApiKey} onChange={(e) => update('llmApiKey', e.target.value)} placeholder="必填：用于调用 Qwen3-Max" />

					<label>LLM API Base（可选）</label>
					<input value={form.llmApiBase} onChange={(e) => update('llmApiBase', e.target.value)} placeholder="例如：https://dashscope.aliyuncs.com/compatible-mode/v1" />

					<label>高德地图 Key</label>
					<input value={form.amapKey} onChange={(e) => update('amapKey', e.target.value)} placeholder="用于地图展示与搜索" />

					<label>Supabase URL</label>
					<input value={form.supabaseUrl} onChange={(e) => update('supabaseUrl', e.target.value)} placeholder="用于认证与云同步" />

					<label>Supabase anon key</label>
					<input type="password" value={form.supabaseAnonKey} onChange={(e) => update('supabaseAnonKey', e.target.value)} placeholder="用于前端访问 Supabase" />
				</div>
				<button className="btn primary" onClick={handleSave}>保存</button>
				{saved && <div className="hint success">已保存到本地</div>}
				<div className="hint">
					请勿将任何密钥提交到代码仓库。生产部署时请改为服务端环境变量注入，并通过后端代理调用第三方服务。
				</div>
			</div>
		</div>
	);
}


