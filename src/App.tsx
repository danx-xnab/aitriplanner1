import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/services/supabase';
import { useSettingsStore } from '@/services/storage';

export default function App() {
	const location = useLocation();
	const { initClient, user } = useAuth();
	const { supabaseUrl, supabaseAnonKey } = useSettingsStore();
	useEffect(() => {
		initClient();
	}, [supabaseUrl, supabaseAnonKey, initClient]);
	return (
		<div className="app">
			<header className="header">
				<div className="brand">AI 旅行规划师</div>
				<nav className="nav">
					<Link className={location.pathname === '/' ? 'active' : ''} to="/">行程规划</Link>
					<Link className={location.pathname === '/budget' ? 'active' : ''} to="/budget">预算</Link>
					<Link className={location.pathname === '/settings' ? 'active' : ''} to="/settings">设置</Link>
					<Link className={location.pathname === '/auth' ? 'active' : ''} to="/auth">{user ? '账户' : '登录'}</Link>
				</nav>
			</header>
			<main className="main">
				<Outlet />
			</main>
		</div>
	);
}


