import { useState, useEffect, useRef, useCallback } from 'react';

// 定義 Web Speech API 的全域型別擴充
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseWebSpeechReturn {
  // STT (語音轉文字)
  isListening: boolean;
  recognitionText: string;
  startListening: () => void;
  stopListening: () => void;
  resetRecognitionText: () => void;
  isSttSupported: boolean;

  // TTS (文字轉語音)
  isSpeaking: boolean;
  speakText: (text: string, npcRole?: string) => void;
  cancelSpeech: () => void;
  isTtsSupported: boolean;
}

export function useWebSpeech(): UseWebSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [recognitionText, setRecognitionText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSttSupported, setIsSttSupported] = useState(true);
  const [isTtsSupported, setIsTtsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // 初始化 STT 與 TTS
  useEffect(() => {
    // 1. 檢查與初始化 STT (SpeechRecognition)
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'zh-TW';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setRecognitionText(transcript);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Web Speech STT Error]', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('[Web Speech] 瀏覽器不支援原生 SpeechRecognition API');
      setIsSttSupported(false);
    }

    // 2. 檢查與初始化 TTS (SpeechSynthesis)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      console.warn('[Web Speech] 瀏覽器不支援原生 SpeechSynthesis API');
      setIsTtsSupported(false);
    }

    // 卸載時清理語音
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 開始錄音
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('您的瀏覽器不支援語音辨識功能，請使用 Chrome / Edge 瀏覽器。');
      return;
    }

    // 若正在播放 TTS，先強制暫停避免收音到 NPC 聲音
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    setRecognitionText('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.warn('[STT start error, restarting]', err);
      // 若已經在 running，先 abort 再重新 start
      try {
        recognitionRef.current.abort();
        setTimeout(() => {
          recognitionRef.current?.start();
          setIsListening(true);
        }, 100);
      } catch (innerErr) {
        console.error('[STT retry failed]', innerErr);
      }
    }
  }, []);

  // 停止錄音
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('[STT stop error]', err);
      }
    }
  }, []);

  // 清空辨識文字
  const resetRecognitionText = useCallback(() => {
    setRecognitionText('');
  }, []);

  // 取消 TTS 播放
  const cancelSpeech = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // 執行文字轉語音 (TTS)
  const speakText = useCallback((text: string, npcRole: string = '') => {
    if (!synthRef.current || !text) return;

    // 先取消之前正在播放的聲音，避免聲音重疊
    synthRef.current.cancel();

    // 清理括號備註或特殊 prompt 符號以獲得更乾淨的朗讀
    const cleanText = text.replace(/（[^）]*）|\([^)]*\)/g, '').trim() || text;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-TW';

    // 根據角色人設調整語音特徵（聲音微調）
    const roleLower = (npcRole || '').toLowerCase();
    const isElder = roleLower.includes('外婆') || roleLower.includes('阿嬤') || roleLower.includes('奶奶') || roleLower.includes('隔代');

    if (isElder) {
      utterance.rate = 0.85; // 年長者語速較緩慢
      utterance.pitch = 0.9; // 年長者語調稍低沉
    } else {
      // 媽媽或其他年輕角色
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
    }

    // 嘗試挑選繁體中文語音庫 (zh-TW)
    const voices = synthRef.current.getVoices();
    const zhVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'cmn-Hant-TW' || v.lang.includes('zh'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (e) => {
      console.warn('[Web Speech TTS Error]', e);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  }, []);

  return {
    isListening,
    recognitionText,
    startListening,
    stopListening,
    resetRecognitionText,
    isSttSupported,
    isSpeaking,
    speakText,
    cancelSpeech,
    isTtsSupported,
  };
}
