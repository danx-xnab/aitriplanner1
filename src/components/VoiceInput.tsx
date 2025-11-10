import { useEffect, useRef, useState } from 'react';
import { startBrowserSpeechRecognition, stopBrowserSpeechRecognition } from '@/services/speech';

export default function VoiceInput(props: { onResult: (text: string) => void }) {
	const [recording, setRecording] = useState(false);
	const [supported, setSupported] = useState<boolean>(true);
	const [error, setError] = useState<string>('');
	const [status, setStatus] = useState<string>('');
	const finalTextRef = useRef('');
	const noSpeechTimerRef = useRef<number | null>(null);

	useEffect(() => {
		const hasSupport = typeof (window as any).webkitSpeechRecognition !== 'undefined' || typeof (window as any).SpeechRecognition !== 'undefined';
		setSupported(!!hasSupport);
		return () => {
			stopBrowserSpeechRecognition();
			if (noSpeechTimerRef.current) {
				window.clearTimeout(noSpeechTimerRef.current);
				noSpeechTimerRef.current = null;
			}
		};
	}, []);

	async function handleToggle() {
		setError('');
		if (!recording) {
			if (!supported) {
				setError('当前浏览器不支持语音识别，请改用文字输入或更换 Chrome/Edge。');
				return;
			}
			// 主动申请麦克风权限，避免识别立即报 not-allowed/audio-capture
			try {
				if (navigator.mediaDevices?.getUserMedia) {
					const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
					// 立即释放
					stream.getTracks().forEach(t => t.stop());
				}
			} catch (e: any) {
				setError('未获取到麦克风权限，请在浏览器地址栏权限设置中允许使用麦克风，并选择正确的输入设备。');
				return;
			}
			finalTextRef.current = '';
			setStatus('正在聆听…请开始说话');
			startBrowserSpeechRecognition({
				lang: 'zh-CN',
				onInterim: () => {},
				onFinal: (text) => {
					finalTextRef.current = text;
					props.onResult(text);
				},
				onEnd: () => {
					setRecording(false);
					setStatus('');
					if (noSpeechTimerRef.current) {
						window.clearTimeout(noSpeechTimerRef.current);
						noSpeechTimerRef.current = null;
					}
				},
				onError: (e) => {
					setRecording(false);
					const code = e?.error || '';
					if (code === 'not-allowed') setError('浏览器拒绝了麦克风权限（not-allowed）。请在站点设置中允许麦克风。');
					else if (code === 'audio-capture') setError('未检测到麦克风设备（audio-capture）。请检查系统录音设备与浏览器输入源。');
					else if (code === 'no-speech') setError('未检测到语音（no-speech）。请重试并贴近麦克风说话。');
					else setError(`语音识别失败：${code || '未知错误'}`);
					setStatus('');
					if (noSpeechTimerRef.current) {
						window.clearTimeout(noSpeechTimerRef.current);
						noSpeechTimerRef.current = null;
					}
				},
				onSpeechStart: () => {
					setStatus('检测到语音…');
					if (noSpeechTimerRef.current) {
						window.clearTimeout(noSpeechTimerRef.current);
						noSpeechTimerRef.current = null;
					}
				},
				onSpeechEnd: () => {
					setStatus('语音结束，处理中…');
				}
			});
			// 若5秒内未检测到语音，提示并自动停止一次
			noSpeechTimerRef.current = window.setTimeout(() => {
				setStatus('');
				setError('5秒内未检测到语音，请靠近麦克风或检查输入源（系统声音设置）。');
				stopBrowserSpeechRecognition();
				setRecording(false);
			}, 5000);
			setRecording(true);
		} else {
			stopBrowserSpeechRecognition();
			setRecording(false);
			setStatus('');
			if (noSpeechTimerRef.current) {
				window.clearTimeout(noSpeechTimerRef.current);
				noSpeechTimerRef.current = null;
			}
		}
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column' }}>
			<button className={`btn ${recording ? 'danger' : ''}`} onClick={handleToggle} title="使用浏览器语音识别（若可用）" disabled={!supported}>
				{!supported ? '不支持' : (recording ? '停止' : '语音')}
			</button>
			{status && <span className="hint">{status}</span>}
			{error && <span className="hint">{error}</span>}
		</div>
	);
}


