import { useEffect, useState } from 'react';
import { useAuth } from '@/services/supabase';
import { useSettingsStore } from '@/services/storage';

export default function Auth() {
	const { supabaseUrl, supabaseAnonKey } = useSettingsStore();
	const { initClient, user, signInWithEmail, signUpWithEmail, signOut } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [password2, setPassword2] = useState('');
	const [mode, setMode] = useState<'login' | 'signup'>('login');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string>('');

	useEffect(() => {
		initClient();
	}, [supabaseUrl, supabaseAnonKey, initClient]);

	async function doLogin() {
		setLoading(true); setMessage('');
		try {
			await signInWithEmail(email, password);
			setMessage('登录成功');
		} catch (e: any) {
			setMessage(e?.message ?? '登录失败');
		} finally {
			setLoading(false);
		}
	}
	async function doSignup() {
		setLoading(true); setMessage('');
		try {
			if (password !== password2) {
				setMessage('两次输入的密码不一致');
				return;
			}
			await signUpWithEmail(email, password);
			setMessage('注册成功，请使用该账号登录');
			setMode('login');
			setPassword('');
			setPassword2('');
		} catch (e: any) {
			setMessage(e?.message ?? '注册失败');
		} finally {
			setLoading(false);
		}
	}
	async function doLogout() {
		setLoading(true); setMessage('');
		try {
			await signOut();
			setMessage('已退出');
		} catch (e: any) {
			setMessage(e?.message ?? '退出失败');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="settings">
			<div className="card">
				<div className="card-title">账户登录</div>
				{!supabaseUrl || !supabaseAnonKey ? (
					<div className="hint">请先在“设置”页填写 Supabase URL 与 anon key。</div>
				) : user ? (
					<div>
						<div className="hint">当前登录：{user.email}</div>
						<button className="btn" onClick={doLogout} disabled={loading}>退出登录</button>
					</div>
				) : (
					<>
						<div className="form-grid">
							<label>邮箱</label>
							<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
							<label>密码</label>
							<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少6位" />
							{mode === 'signup' && <>
								<label>确认密码</label>
								<input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="再次输入密码" />
							</>}
							<div />
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								{mode === 'login' ? (
									<>
										<button className="btn primary" onClick={doLogin} disabled={loading || !email || !password}>登录</button>
										<button className="btn" onClick={() => { setMode('signup'); setMessage(''); }}>没有账号？注册</button>
									</>
								) : (
									<>
										<button className="btn primary" onClick={doSignup} disabled={loading || !email || !password || !password2}>注册</button>
										<button className="btn" onClick={() => { setMode('login'); setMessage(''); }}>已有账号？去登录</button>
									</>
								)}
							</div>
						</div>
					</>
				)}
				{message && <div className="hint">{message}</div>}
			</div>
		</div>
	);
}


