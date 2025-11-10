import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Planner from './pages/Planner';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Budget from './pages/Budget';
import './styles.css';

const router = createBrowserRouter([
	{
		path: '/',
		element: <App />,
		children: [
			{ index: true, element: <Planner /> },
			{ path: '/settings', element: <Settings /> },
			{ path: '/auth', element: <Auth /> },
			{ path: '/budget', element: <Budget /> }
		]
	}
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);


