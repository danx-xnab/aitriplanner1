import axios from 'axios';
import { useSettingsStore } from './storage';

export type GeocodedPoi = { name: string; lng: number; lat: number };

// 清理地点名称，去除无关信息
function cleanPlaceName(name: string): string {
	if (!name) return '';
	// 去除常见的前缀/后缀
	let cleaned = name.trim()
		.replace(/^第\d+天[：:]\s*/i, '')
		.replace(/^[上午下午晚上][：:]\s*/i, '')
		.replace(/^[（(].*?[）)]/g, '')
		.replace(/\s*[（(]第\d+天[）)]\s*/g, '')
		.replace(/\s*[（(]上午|下午|晚上[）)]\s*/gi, '')
		.replace(/^\d+[、.]\s*/, '')
		.replace(/^[•·]\s*/, '')
		.trim();
	// 如果清理后为空，返回原名称
	return cleaned || name;
}

// 计算字符串相似度（简单版本）
function similarity(str1: string, str2: string): number {
	const s1 = str1.toLowerCase().replace(/\s+/g, '');
	const s2 = str2.toLowerCase().replace(/\s+/g, '');
	if (s1 === s2) return 1;
	if (s1.includes(s2) || s2.includes(s1)) return 0.8;
	// 简单的字符匹配度
	const longer = s1.length > s2.length ? s1 : s2;
	const shorter = s1.length > s2.length ? s2 : s1;
	let matches = 0;
	for (let i = 0; i < shorter.length; i++) {
		if (longer.includes(shorter[i])) matches++;
	}
	return matches / longer.length;
}

// 验证POI结果是否相关
function isRelevantPoi(query: string, poi: any): boolean {
	if (!poi?.name) return false;
	const queryClean = cleanPlaceName(query);
	const poiName = poi.name;
	const sim = similarity(queryClean, poiName);
	// 相似度阈值：至少50%匹配
	return sim >= 0.5;
}

export async function geocodePois(names: { name: string; city?: string }[], limit = 12): Promise<GeocodedPoi[]> {
	const { amapKey } = useSettingsStore.getState();
	if (!amapKey) return [];
	const results: GeocodedPoi[] = [];
	const seen = new Set<string>(); // 用于去重：name-lng-lat
	
	// 逐个查询（避免频率限制）
	for (const item of names.slice(0, limit)) {
		try {
			const cleanedName = cleanPlaceName(item.name);
			if (!cleanedName || cleanedName.length < 2) continue; // 跳过太短或空名称
			
			const cityName = item.city ? cleanCityName(item.city) : '';
			const baseParams = {
				key: amapKey,
				keywords: cleanedName,
				city: cityName,
				offset: '10', // 增加返回结果数，便于筛选
				page: '1',
				types: '' // 不限制类型
			};
			
			// 策略1：优先使用城市限制的精确搜索，并验证坐标
			let poi = await searchPlaceWithValidation(baseParams, cleanedName, cityName);
			
			// 策略2：如果城市限制下没找到相关结果，尝试不限制城市（但如果有城市信息，仍要验证坐标）
			if (!poi && cityName) {
				const unboundPoi = await searchPlaceWithValidation({ ...baseParams, city: '' }, cleanedName, cityName);
				if (unboundPoi) {
					const [lngStr, latStr] = String(unboundPoi.location).split(',');
					const lng = Number(lngStr);
					const lat = Number(latStr);
					// 如果坐标在城市范围内，使用它；否则继续搜索
					if (isInCityBounds(lng, lat, cityName)) {
						poi = unboundPoi;
					}
				}
			}
			
			// 策略3：如果POI搜索失败，尝试地理编码（仅当有城市信息时）
			if (!poi && item.city) {
				poi = await geocodeAddress(amapKey, cleanedName, cityName);
			}
			
			// 策略4：最后尝试无城市限制的地理编码（但如果有城市信息，要验证坐标）
			if (!poi) {
				const geoPoi = await geocodeAddress(amapKey, cleanedName, '');
				if (geoPoi && cityName) {
					const [lngStr, latStr] = String(geoPoi.location).split(',');
					const lng = Number(lngStr);
					const lat = Number(latStr);
					// 如果坐标不在城市范围内，不使用
					if (!isInCityBounds(lng, lat, cityName)) {
						continue;
					}
				}
				poi = geoPoi;
			}
			
			if (poi?.location) {
				const [lngStr, latStr] = String(poi.location).split(',');
				const lng = Number(lngStr);
				const lat = Number(latStr);
				if (!Number.isNaN(lng) && !Number.isNaN(lat) && lng > 0 && lat > 0) {
					// 验证坐标是否在城市范围内（如果有城市信息）
					if (!isInCityBounds(lng, lat, cityName)) {
						continue; // 坐标不在城市范围内，跳过
					}
					// 去重：检查是否已存在相同或非常接近的点
					const key = `${cleanedName}-${lng.toFixed(4)}-${lat.toFixed(4)}`;
					if (!seen.has(key)) {
						seen.add(key);
						results.push({ name: item.name, lng, lat });
					}
				}
			}
		} catch {
			// ignore error for individual POI
		}
	}
	return results;
}

// 清理城市名称
function cleanCityName(city: string): string {
	if (!city) return '';
	return city.trim()
		.replace(/^[省市区县].*/, '') // 去除省市区县前缀
		.replace(/市$/, '') // 去除市后缀
		.trim();
}

// 主要城市的坐标范围（用于验证）
const CITY_BOUNDS: Record<string, { lng: [number, number]; lat: [number, number] }> = {
	'南京': { lng: [118.3, 119.2], lat: [31.2, 32.6] },
	'北京': { lng: [116.0, 117.0], lat: [39.5, 41.0] },
	'上海': { lng: [120.8, 122.0], lat: [30.7, 31.9] },
	'广州': { lng: [113.0, 113.6], lat: [22.7, 23.4] },
	'深圳': { lng: [113.7, 114.6], lat: [22.4, 22.9] },
	'杭州': { lng: [119.5, 120.5], lat: [30.0, 30.5] },
	'成都': { lng: [103.8, 104.5], lat: [30.4, 30.9] },
	'西安': { lng: [108.7, 109.2], lat: [34.1, 34.5] },
	'苏州': { lng: [120.3, 121.0], lat: [31.1, 31.5] },
	'武汉': { lng: [114.0, 114.6], lat: [30.3, 30.8] },
};

// 验证坐标是否在城市范围内
function isInCityBounds(lng: number, lat: number, city: string | undefined): boolean {
	if (!city) return true; // 没有城市信息时，不验证
	const cityName = cleanCityName(city);
	const bounds = CITY_BOUNDS[cityName];
	if (!bounds) return true; // 未知城市，不验证
	return lng >= bounds.lng[0] && lng <= bounds.lng[1] && lat >= bounds.lat[0] && lat <= bounds.lat[1];
}

// 带验证的POI搜索
async function searchPlaceWithValidation(params: Record<string, string>, queryName: string, cityName?: string) {
	try {
		const resp = await axios.get('https://restapi.amap.com/v3/place/text', {
			params,
			timeout: 8000
		});
		const pois = resp.data?.pois || [];
		
		// 如果有城市信息，优先返回城市内且相关的结果
		if (cityName) {
			for (const poi of pois) {
				if (!poi?.location) continue;
				const [lngStr, latStr] = String(poi.location).split(',');
				const lng = Number(lngStr);
				const lat = Number(latStr);
				if (isRelevantPoi(queryName, poi) && isInCityBounds(lng, lat, cityName)) {
					return poi;
				}
			}
			// 如果没有相关且在城市内的结果，返回城市内的第一个结果
			for (const poi of pois) {
				if (!poi?.location) continue;
				const [lngStr, latStr] = String(poi.location).split(',');
				const lng = Number(lngStr);
				const lat = Number(latStr);
				if (isInCityBounds(lng, lat, cityName)) {
					return poi;
				}
			}
		}
		
		// 优先返回最相关的结果
		for (const poi of pois) {
			if (isRelevantPoi(queryName, poi)) {
				return poi;
			}
		}
		// 如果没有相关结果，返回第一个（作为备选）
		return pois[0] || null;
	} catch {
		return null;
	}
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



