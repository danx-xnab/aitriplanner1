import axios from 'axios';
import { useSettingsStore } from './storage';

export type GeocodedPoi = { name: string; lng: number; lat: number };

export async function geocodePois(names: { name: string; city?: string }[], limit = 12): Promise<GeocodedPoi[]> {
	const { amapKey } = useSettingsStore.getState();
	if (!amapKey) return [];
	const results: GeocodedPoi[] = [];
	// 逐个查询（避免频率限制），可按需改为并发
	for (const item of names.slice(0, limit)) {
		try {
			const baseParams = {
				key: amapKey,
				keywords: item.name,
				city: item.city ?? '',
				offset: '3',
				page: '1'
			};
			let poi = await searchPlace(baseParams);
			if (!poi) {
				// 再尝试不限制城市
				poi = await searchPlace({ ...baseParams, city: '' });
			}
			if (!poi && item.city) {
				// 若仍未命中，尝试地理编码
				poi = await geocodeAddress(amapKey, item.name, item.city);
			}
			if (!poi) {
				poi = await geocodeAddress(amapKey, item.name, '');
			}
			if (poi?.location) {
				const [lngStr, latStr] = String(poi.location).split(',');
				const lng = Number(lngStr);
				const lat = Number(latStr);
				if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
					results.push({ name: item.name, lng, lat });
				}
			}
		} catch {
			// ignore error for individual POI
		}
	}
	return results;
}

async function searchPlace(params: Record<string, string>) {
	try {
		const resp = await axios.get('https://restapi.amap.com/v3/place/text', {
			params,
			timeout: 8000
		});
		return resp.data?.pois?.[0];
	} catch {
		return null;
	}
}

async function geocodeAddress(key: string, address: string, city: string) {
	try {
		const resp = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
			params: {
				key,
				address,
				city
			},
			timeout: 8000
		});
		return resp.data?.geocodes?.[0];
	} catch {
		return null;
	}
}



