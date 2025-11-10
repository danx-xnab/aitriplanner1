import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '@/services/storage';

declare global {
	interface Window {
		AMap?: any;
	}
}

type Marker = { lng: number; lat: number; name?: string; day?: number };

export default function MapView({ markers = [] as Marker[], onSelectPlace, autoDrawRoute = true }: { markers?: Marker[]; onSelectPlace?: (p: { lng: number; lat: number; name?: string }) => void; autoDrawRoute?: boolean }) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const { amapKey } = useSettingsStore();
	const [loaded, setLoaded] = useState(false);
	const mapInstanceRef = useRef<any | null>(null);
	const markerInstancesRef = useRef<any[]>([]);
	const searchMarkerInstancesRef = useRef<any[]>([]);
	const [query, setQuery] = useState('');
	const [activeDay, setActiveDay] = useState<number | 'all'>('all');
	const [visibleDays, setVisibleDays] = useState<Set<number>>(new Set());
	const drivingRef = useRef<any | null>(null);
	const infoWindowRef = useRef<any | null>(null);
	const palette = useMemo(
		() => ['#4f8cff', '#2fb36d', '#de3e3e', '#f2a900', '#a55eea', '#20b2aa', '#ff7f50', '#00bcd4'],
		[]
	);
	const daysSet = useMemo(() => {
		const s = new Set<number>();
		for (const m of markers) if (typeof m.day === 'number') s.add(m.day as number);
		return Array.from(s).sort((a, b) => a - b);
	}, [markers]);

	useEffect(() => {
		if (!amapKey) return;
		const id = 'amap-sdk';
		if (document.getElementById(id)) {
			setLoaded(true);
			return;
		}
		const script = document.createElement('script');
		script.id = id;
		script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}`;
		script.async = true;
		script.onload = () => setLoaded(true);
		document.body.appendChild(script);
	}, [amapKey]);

	useEffect(() => {
		if (!loaded || !window.AMap || !mapRef.current) return;
		const map = new window.AMap.Map(mapRef.current, {
			zoom: 4,
			center: [116.397428, 39.90923]
		});
		mapInstanceRef.current = map;
		return () => {
			map?.destroy?.();
			mapInstanceRef.current = null;
		};
	}, [loaded]);

	// 渲染标注
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !window.AMap) return;
		// 清理旧的
		markerInstancesRef.current.forEach(m => m?.setMap?.(null));
		markerInstancesRef.current = [];
		if (!markers.length) return;
		const filtered = activeDay === 'all' ? markers : markers.filter(m => m.day === activeDay);
		const ms = filtered
			.filter(m => typeof m.lng === 'number' && typeof m.lat === 'number')
			.map(m => {
				const color = typeof m.day === 'number' ? palette[(m.day - 1) % palette.length] : '#ffffff';
				const svg = encodeURIComponent(`<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14C0 24 14 36 14 36C14 36 28 24 28 14C28 6.268 21.732 0 14 0Z" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/><circle cx="14" cy="14" r="6" fill="#0b0c10" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/></svg>`);
				const icon = new window.AMap.Icon({
					size: new window.AMap.Size(28, 36),
					image: `data:image/svg+xml;charset=utf-8,${svg}`,
					imageSize: new window.AMap.Size(28, 36)
				});
				const marker = new window.AMap.Marker({
					position: [m.lng, m.lat],
					title: m.name || '',
					icon,
					offset: new window.AMap.Pixel(-14, -36)
				});
				if (m.name) {
					marker.setLabel({
						direction: 'top',
						offset: new window.AMap.Pixel(0, -8),
						content: `<div style="background:#fff;color:#1f2430;padding:4px 10px;border-radius:14px;font-size:12px;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.25);border:1px solid rgba(0,0,0,0.08);font-weight:600;">
							${typeof m.day === 'number' ? `<span style="color:${color};margin-right:4px;">第${m.day}天</span>` : ''}
							<span>${m.name}</span>
						</div>`
					});
				}
				marker.on('click', () => {
					if (!window.AMap) return;
					if (!infoWindowRef.current) {
						infoWindowRef.current = new window.AMap.InfoWindow({ offset: new window.AMap.Pixel(0, -10) });
					}
					const navUrl = `https://uri.amap.com/navigation?to=${m.lng},${m.lat},${encodeURIComponent(m.name || '目的地')}&mode=car&policy=1`;
					const markerHtml = `
						<div style="min-width:220px;background:#10131b;color:#e8eaed;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);box-shadow:0 12px 30px rgba(10,12,16,0.55);">
							<div style="font-weight:700;font-size:14px;margin-bottom:6px;">${m.name || '地点'}</div>
							${typeof m.day === 'number' ? `<div style="font-size:12px;margin-bottom:4px;color:${color};">第${m.day}天</div>` : ''}
							<div style="margin:6px 0;">
								<a href="${navUrl}" target="_blank" style="color:#7aa5ff;text-decoration:none;font-weight:600;">在高德导航</a>
							</div>
							<div style="color:#b4b8c2;font-size:12px;">经纬度：${m.lng.toFixed(6)}, ${m.lat.toFixed(6)}</div>
						</div>
					`;
					infoWindowRef.current.setContent(markerHtml);
					infoWindowRef.current.open(map, [m.lng, m.lat]);
				});
				return marker;
			});
		ms.forEach(m => m.setMap(map));
		markerInstancesRef.current = ms;
		// 适配视野
		if (ms.length > 0 && window.AMap?.Bounds) {
			map.setFitView(ms, false, [30, 30, 30, 30], 12);
		}
	}, [markers, activeDay, palette]);

	// 地点搜索
	async function doSearch() {
		const map = mapInstanceRef.current;
		if (!map || !window.AMap || !query.trim()) return;
		// 清理旧的搜索结果标注
		searchMarkerInstancesRef.current.forEach(m => m?.setMap?.(null));
		searchMarkerInstancesRef.current = [];
		// 使用 AMap.PlaceSearch
		window.AMap.plugin('AMap.PlaceSearch', () => {
			const placeSearch = new window.AMap.PlaceSearch({
				pageSize: 10,
				city: '全国'
			});
			placeSearch.search(query, (status: string, result: any) => {
				if (status !== 'complete' || !result?.poiList?.pois?.length) return;
				const pois = result.poiList.pois;
				const ms = pois.map((p: any) => {
					const lng = Number(p.location?.lng);
					const lat = Number(p.location?.lat);
					if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
					const m = new window.AMap.Marker({
						position: [lng, lat],
						title: p.name || ''
					});
					m.on('click', () => {
						onSelectPlace?.({ lng, lat, name: p.name });
					});
					return m;
				}).filter(Boolean);
				ms.forEach((m: any) => m.setMap(map));
				searchMarkerInstancesRef.current = ms as any[];
				if (ms.length > 0) {
					map.setFitView(ms, false, [30, 30, 30, 30], 14);
				}
			});
		});
	}

	function toggleDayVisible(day: number) {
		setVisibleDays(prev => {
			const next = new Set(prev);
			if (next.has(day)) next.delete(day); else next.add(day);
			return next;
		});
		// 当勾选具体天数时，自动切换为该天视图；若取消所有则回到全部
		setActiveDay((prev) => {
			if (visibleDays.size === 0) return 'all';
			return prev;
		});
	}

	function showOnlyDay(day: number) {
		setActiveDay(day);
	}

	function showAllDays() {
		setActiveDay('all');
	}

	function drawRouteForDay() {
		const map = mapInstanceRef.current;
		if (!map || !window.AMap) return;
		const day = activeDay === 'all' ? daysSet[0] : activeDay;
		if (!day) return;
		const points = markers.filter(m => m.day === day);
		if (points.length < 2) return;
		window.AMap.plugin('AMap.Driving', () => {
			if (drivingRef.current) {
				drivingRef.current.clear();
			}
			drivingRef.current = new window.AMap.Driving({ map, policy: window.AMap.DrivingPolicy.LEAST_TIME });
			const origin = new window.AMap.LngLat(points[0].lng, points[0].lat);
			const destination = new window.AMap.LngLat(points[points.length - 1].lng, points[points.length - 1].lat);
			const waypoints = points.slice(1, -1).map(p => new window.AMap.LngLat(p.lng, p.lat));
			drivingRef.current.search(origin, destination, { waypoints }, (status: string) => {
				// no-op; AMap 会自动在地图上渲染路线
			});
		});
	}

	// 当 markers 初次到达且包含天数，自动绘制首日路线
	useEffect(() => {
		if (!autoDrawRoute) return;
		if (!markers?.length) return;
		if (!daysSet.length) return;
		// 仅在地图就绪后绘制
		if (!mapInstanceRef.current || !window.AMap) return;
		// 默认展示第一天
		if (activeDay === 'all') {
			setActiveDay(daysSet[0]);
			// 延迟一个tick等待渲染完成再绘制路线
			setTimeout(() => {
				drawRouteForDay();
			}, 0);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoDrawRoute, JSON.stringify(markers), daysSet.length, !!mapInstanceRef.current, !!window.AMap]);

	return (
		<div className="map-view">
			{!amapKey && <div className="hint">请在设置中填写高德地图 Key</div>}
			<div className="input-row" style={{ marginBottom: 8 }}>
				<input className="text-input" placeholder="搜索地点（高德）" value={query} onChange={(e) => setQuery(e.target.value)} />
				<button className="btn" onClick={doSearch}>搜索</button>
				{daysSet.length > 0 && (
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<button className="btn" onClick={showAllDays}>全部</button>
						{daysSet.map(d => (
							<button key={d} className="btn" onClick={() => showOnlyDay(d)} style={{ borderColor: palette[(d - 1) % palette.length] }}>
								第{d}天
							</button>
						))}
						<button className="btn" onClick={drawRouteForDay}>绘制当天路线</button>
					</div>
				)}
			</div>
			{daysSet.length > 0 && (
				<div className="hint" style={{ marginBottom: 8 }}>
					行程天数颜色：
					{daysSet.map(d => (
						<span key={d} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>
							<span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: palette[(d - 1) % palette.length], marginRight: 4 }} />
							第{d}天
						</span>
					))}
				</div>
			)}
			<div ref={mapRef} className="map-canvas" />
		</div>
	);
}


