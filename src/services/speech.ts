type SpeechHandlers = {
	lang: string;
	onInterim?: (text: string) => void;
	onFinal?: (text: string) => void;
	onEnd?: () => void;
	onError?: (err: any) => void;
	onSpeechStart?: () => void;
	onSpeechEnd?: () => void;
};

let recognition: any | null = null;

export function startBrowserSpeechRecognition(handlers: SpeechHandlers) {
	const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
	if (!SpeechRecognition) {
		handlers.onError?.(new Error('浏览器不支持语音识别'));
		return;
	}
	recognition = new SpeechRecognition();
	recognition.lang = handlers.lang || 'zh-CN';
	recognition.interimResults = true;
	recognition.continuous = true;
	recognition.maxAlternatives = 1;
	recognition.onstart = () => {
		// started
	};
	recognition.onspeechstart = () => {
		handlers.onSpeechStart?.();
	};
	recognition.onspeechend = () => {
		handlers.onSpeechEnd?.();
	};
	recognition.onresult = (event: any) => {
		let interim = '';
		let finalText = '';
		for (let i = event.resultIndex; i < event.results.length; ++i) {
			const res = event.results[i];
			if (res.isFinal) {
				finalText += res[0].transcript;
			} else {
				interim += res[0].transcript;
			}
		}
		if (interim) handlers.onInterim?.(interim);
		if (finalText) handlers.onFinal?.(finalText);
	};
	recognition.onerror = (e: any) => {
		// e.error 常见值：'not-allowed' | 'no-speech' | 'audio-capture' | 'aborted' | 'network'
		handlers.onError?.(e);
	};
	recognition.onend = () => handlers.onEnd?.();
	recognition.start();
}

export function stopBrowserSpeechRecognition() {
	try {
		recognition?.stop?.();
	} catch {
		// ignore
	}
	recognition = null;
}


