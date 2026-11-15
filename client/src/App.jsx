
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AudioLines, Bell, Check, ChevronDown, CircleHelp, Crown,
  ExternalLink, Headphones, MessageCircle, Mic2, Monitor,
  Settings2, ShieldCheck, Smartphone, Sparkles, Star, Volume2,
  VolumeX, WifiOff, Youtube
} from 'lucide-react';

import {
  prepareSpeechText,
  getSpeechLanguage,
  findVoice
} from './voiceHelper';

const API = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin);

const demoMessages = [
  { id: 'd1', author: 'pixelpirate', text: 'That was such a clean play!! 🔥', publishedAt: new Date(Date.now()-42000).toISOString(), isMember: true },
  { id: 'd2', author: 'MiraPlays', text: 'How long have you been practicing this map?', publishedAt: new Date(Date.now()-31000).toISOString() },
  { id: 'd3', author: 'the_real_arya', text: 'CHAT WE ARE SO BACK 😭', publishedAt: new Date(Date.now()-21000).toISOString(), isModerator: true },
  { id: 'd4', author: 'NeonNinja', text: 'Your aim is actually insane', publishedAt: new Date(Date.now()-11000).toISOString() }
];

function cleanUsername(username) {
  return (username || 'Someone')
    .replace(/^@+/, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Someone';
}

function App() {
  const [account, setAccount] = useState(null);
  const [messages, setMessages] = useState(demoMessages);
  const [status, setStatus] = useState({
    status: 'demo',
    message: 'Preview mode · connect YouTube to go live'
  });

  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(45);
  const [fontSize, setFontSize] = useState(19);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState('');

  const [readAloud, setReadAloud] = useState(false);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechCount, setSpeechCount] = useState(0);

  const socketRef = useRef(null);
  const listRef = useRef(null);
  const audioRef = useRef(null);

  const soundRef = useRef(true);
  const volumeRef = useRef(45);

  const speechEnabledRef = useRef(false);
  const speechPausedRef = useRef(false);
  const speechQueueRef = useRef([]);
  const speechActiveRef = useRef(false);
  const lastSpeakerRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Load available browser voices.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Speak the next item in the queue.
  function speakNext() {
    if (!speechEnabledRef.current) return;
    if (speechActiveRef.current) return;
    if (speechPausedRef.current) return;
    if (!speechQueueRef.current.length) return;

    const item = speechQueueRef.current.shift();
    setSpeechCount(speechQueueRef.current.length);

    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.lang || 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = findVoice(voicesRef.current, utterance.lang);
    if (voice) utterance.voice = voice;

    speechActiveRef.current = true;

    const finish = () => {
      speechActiveRef.current = false;
      speakNext();
    };

    utterance.onend = finish;
    utterance.onerror = (event) => {
      console.warn('Speech error:', event.error);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  }

  // Add an incoming chat message to the speech queue.
  function enqueueSpeech(message) {
    if (!speechEnabledRef.current) return;

    const rawAuthor = message.author || 'Someone';
    const authorKey = rawAuthor.trim().replace(/^@+/, '').toLowerCase();
    const authorName = cleanUsername(rawAuthor);
    const messageText = (message.text || '').trim();

    if (!messageText) return;

    const isNewSpeaker = authorKey !== lastSpeakerRef.current;

    if (isNewSpeaker) {
      speechQueueRef.current.push({
        text: `${authorName} says`,
        lang: 'en-IN'
      });
    }

    speechQueueRef.current.push({
      text: prepareSpeechText(messageText),
      lang: getSpeechLanguage(messageText)
    });

    lastSpeakerRef.current = authorKey;

    // Limit the queue during very busy streams.
    if (speechQueueRef.current.length > 40) {
      speechQueueRef.current.splice(
        0,
        speechQueueRef.current.length - 40
      );
    }

    setSpeechCount(speechQueueRef.current.length);
    speakNext();
  }

  // Enable or disable chat voice.
  function toggleReadAloud() {
    if (!('speechSynthesis' in window)) {
      setToast('Text-to-speech is not supported by this browser.');
      return;
    }

    if (readAloud) {
      speechEnabledRef.current = false;
      speechPausedRef.current = false;
      speechActiveRef.current = false;
      speechQueueRef.current = [];
      lastSpeakerRef.current = null;

      window.speechSynthesis.cancel();

      setReadAloud(false);
      setSpeechPaused(false);
      setSpeechCount(0);
      return;
    }

    speechEnabledRef.current = true;
    speechPausedRef.current = false;
    lastSpeakerRef.current = null;

    setReadAloud(true);
    setSpeechPaused(false);

    // Speak an immediate English confirmation.
    window.speechSynthesis.cancel();

    const confirmation = new SpeechSynthesisUtterance('Voice enabled.');
    confirmation.lang = 'en-IN';
    confirmation.rate = 0.95;
    confirmation.pitch = 1;
    confirmation.volume = 1;

    const voice = findVoice(voicesRef.current, 'en-IN');
    if (voice) confirmation.voice = voice;

    speechActiveRef.current = true;

    confirmation.onend = () => {
      speechActiveRef.current = false;
      speakNext();
    };

    confirmation.onerror = (event) => {
      console.warn('Confirmation speech error:', event.error);
      speechActiveRef.current = false;
      speakNext();
    };

    window.speechSynthesis.speak(confirmation);
  }

  function toggleSpeechPause() {
    if (!('speechSynthesis' in window)) return;

    if (speechPausedRef.current) {
      speechPausedRef.current = false;
      window.speechSynthesis.resume();
      setSpeechPaused(false);
      speakNext();
    } else {
      speechPausedRef.current = true;
      window.speechSynthesis.pause();
      setSpeechPaused(true);
    }
  }

  function clearSpeechQueue() {
    speechQueueRef.current = [];
    speechActiveRef.current = false;
    lastSpeakerRef.current = null;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setSpeechCount(0);
    setSpeechPaused(false);
    speechPausedRef.current = false;
  }

  // Stop speech when the app is closed.
  useEffect(() => {
    return () => {
      speechEnabledRef.current = false;

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load account and handle authentication errors.
  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setAccount(data.connected ? data : null))
      .catch(() => setAccount(null));

    const params = new URLSearchParams(window.location.search);

    if (params.has('authError')) {
      setToast('Google connection was cancelled or failed. Try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Connect to live YouTube chat.
  useEffect(() => {
    if (!account?.connected) return;

    const socket = io(API, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setMessages([]);
      lastSpeakerRef.current = null;
      socket.emit('chat:start');
    });

    socket.on('connect_error', () => {
      setStatus({
        status: 'error',
        message: 'Could not connect to chat server.'
      });
    });

    socket.on('chat:status', setStatus);

    socket.on('chat:message', message => {
      setMessages(current => [...current, message].slice(-250));

      if (!message.isInitial) {
        setNewCount(n => n + 1);
        playPop();
        enqueueSpeech(message);
      }
    });

    return () => socket.disconnect();
  }, [account]);

  // Auto-scroll chat.
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Clear toast automatically.
  useEffect(() => {
    if (!toast) return;

    const id = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(id);
  }, [toast]);

  // Existing notification sound.
  function playPop() {
    if (!soundRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }

      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        1040,
        ctx.currentTime + 0.075
      );

      gain.gain.setValueAtTime(
        (volumeRef.current / 100) * 0.12,
        ctx.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.16
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.17);
    } catch {
      // Browser may block audio until user interaction.
    }
  }

  const connect = () => {
    window.location.href = `${API}/auth/google`;
  };

  async function disconnect() {
    await fetch(`${API}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    socketRef.current?.disconnect();
    clearSpeechQueue();
    speechEnabledRef.current = false;
    setReadAloud(false);

    setAccount(null);
    setStatus({
      status: 'demo',
      message: 'Preview mode · connect YouTube to go live'
    });
    setMessages(demoMessages);
  }

  const time = value =>
    new Intl.DateTimeFormat([], {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));

  const statusLabel =
    status.status === 'connected' ? 'LIVE CHAT CONNECTED' :
    status.status === 'waiting' ? 'WAITING FOR STREAM' :
    status.status === 'error' ? 'RECONNECTING' :
    'PREVIEW MODE';

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark"><AudioLines size={21}/></span>
          <span>
            PULSE<span className="brand-light">CHAT</span>
            <small>STREAMER COMPANION</small>
          </span>
        </a>

        <div className="top-center">
          <span className={`status-dot ${status.status}`}></span>
          <span>{statusLabel}</span>
          <span className="top-divider"/>
          <span className="subtle">
            {account?.channel?.title || 'Your chat, in focus'}
          </span>
        </div>

        <div className="top-actions">
          <button
            className="icon-button"
            title="Settings"
            onClick={() => setShowSettings(v => !v)}
          >
            <Settings2 size={18}/>
          </button>

          {account?.connected ? (
            <button className="connect-button connected" onClick={disconnect}>
              <Check size={16}/> Connected
            </button>
          ) : (
            <button className="connect-button" onClick={connect}>
              <Youtube size={17}/> Connect YouTube
            </button>
          )}
        </div>
      </header>

      <main className="main-layout">
        <section className="chat-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line"/> LIVE FEED
              </div>
              <h1>Chat <span>stream.</span></h1>
              <p className="panel-subtitle">
                Every message. One clear view.
              </p>
            </div>

            <div className="feed-count">
              <MessageCircle size={15}/>
              <b>{messages.length}</b>
              <span>messages</span>
            </div>
          </div>

          <div className="chat-toolbar">
            <div className="toolbar-left">
              <span className="live-pill">
                <i/> {account?.connected ? 'LIVE' : 'DEMO'}
              </span>
              <span className="toolbar-caption">
                Newest messages appear below
              </span>
            </div>

            <div className="toolbar-right">
              <button
                className={`small-tool ${autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll(v => !v)}
              >
                <ChevronDown size={14}/> Auto-scroll
              </button>

              <button
                className={`small-tool ${sound ? 'active' : ''}`}
                onClick={() => setSound(v => !v)}
              >
                {sound ? <Volume2 size={14}/> : <VolumeX size={14}/>}
                Sound
              </button>
            </div>
          </div>

          <div className="message-list" ref={listRef}>
            {messages.map((m, i) => (
              <article
                className={`message-card ${m.amount ? 'superchat' : ''}`}
                key={m.id}
                style={{
                  '--delay': `${Math.min(i, 8) * 35}ms`,
                  '--font-size': `${fontSize}px`
                }}
              >
                <div className="avatar">
                  {m.avatar
                    ? <img src={m.avatar} alt=""/>
                    : (m.author || '?').slice(0, 1).toUpperCase()}
                </div>

                <div className="message-content">
                  <div className="message-meta">
                    <strong>{m.author}</strong>
                    {m.isOwner && <span className="role owner"><Crown size={10}/> OWNER</span>}
                    {m.isModerator && <span className="role mod">MOD</span>}
                    {m.isMember && <span className="role member"><Star size={10}/> MEMBER</span>}
                    <time>{time(m.publishedAt)}</time>
                  </div>

                  <p>{m.text}</p>
                  {m.amount && (
                    <div className="superchat-amount">
                      {m.amount} · SUPER CHAT
                    </div>
                  )}
                </div>

                {m.amount && <Sparkles className="superchat-spark" size={17}/>}
              </article>
            ))}

            {!account?.connected && (
              <div className="demo-note">
                <Sparkles size={15}/>
                These are sample messages. Connect YouTube to see her real live chat.
              </div>
            )}
          </div>

          <div className="chat-footer">
            <span>
              <span className="footer-pulse"/> {status.message}
            </span>
            <span>
              {newCount > 0 ? `${newCount} new` : 'Waiting for messages'}
            </span>
          </div>
        </section>

        <aside className="side-column">
          <section className="welcome-card">
            <div className="orb orb-one"/>
            <div className="orb orb-two"/>

            <div className="welcome-content">
              <span className="mini-label">
                <Sparkles size={12}/> MADE FOR STREAMERS
              </span>
              <h2>Stay in the<br/><em>moment.</em></h2>
              <p>
                No second monitor? No problem. Keep chat close, clear, and impossible to miss.
              </p>

              <div className="device-tags">
                <span><Monitor size={13}/> DESKTOP</span>
                <span><Smartphone size={13}/> MOBILE</span>
              </div>
            </div>
          </section>

          <section className="control-card">
            <div className="card-title">
              <div>
                <span className="eyebrow">QUICK CONTROLS</span>
                <h3>Your setup</h3>
              </div>
              <div className="control-icon"><Headphones size={17}/></div>
            </div>

            <div className="control-row">
              <div className="control-label">
                <span className="control-symbol"><Bell size={16}/></span>
                <div>
                  <b>Message sound</b>
                  <small>A soft pop for each new chat</small>
                </div>
              </div>

              <button
                className={`toggle ${sound ? 'on' : ''}`}
                onClick={() => setSound(v => !v)}
                aria-label="Toggle sound"
              >
                <span/>
              </button>
            </div>

            <div className="volume-block">
              <div className="volume-heading">
                <span>Notification volume</span>
                <b>{volume}%</b>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
              />
            </div>

            <div className="control-row">
              <div className="control-label">
                <span className="control-symbol"><Mic2 size={16}/></span>
                <div>
                  <b>Read chat aloud</b>
                  <small>Hindi, Hinglish and English</small>
                </div>
              </div>

              <button
                className={`toggle ${readAloud ? 'on' : ''}`}
                onClick={toggleReadAloud}
                aria-label="Toggle chat voice"
              >
                <span/>
              </button>
            </div>

            {readAloud && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
                marginTop: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  opacity: 0.75,
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Voice assistant active</span>
                  <span>{speechCount} queued</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="small-tool active" onClick={toggleSpeechPause}>
                    {speechPaused ? 'Resume voice' : 'Pause voice'}
                  </button>
                  <button className="small-tool" onClick={clearSpeechQueue}>
                    Clear queue
                  </button>
                </div>
              </div>
            )}

            <div className="control-row">
              <div className="control-label">
                <span className="control-symbol"><MessageCircle size={16}/></span>
                <div>
                  <b>Readable chat</b>
                  <small>Adjust message size</small>
                </div>
              </div>

              <div className="font-adjust">
                <button onClick={() => setFontSize(v => Math.max(15, v-1))}>−</button>
                <b>{fontSize}</b>
                <button onClick={() => setFontSize(v => Math.min(27, v+1))}>+</button>
              </div>
            </div>

            <button className="test-sound" onClick={playPop}>
              <AudioLines size={15}/> Test notification sound
            </button>
          </section>

          <section className="connection-card">
            <div className="connection-head">
              <span className="connection-icon"><ShieldCheck size={17}/></span>
              <div>
                <b>Private connection</b>
                <small>Google OAuth · YouTube read-only</small>
              </div>
              <span className="secure-check"><Check size={13}/></span>
            </div>

            <p>
              Your Google password is never shared with Pulse Chat. You can disconnect anytime.
            </p>

            {!account?.connected && (
              <button className="wide-connect" onClick={connect}>
                <Youtube size={16}/> Connect her YouTube channel
                <ExternalLink size={13}/>
              </button>
            )}
          </section>

          <div className="tip-card">
            <CircleHelp size={15}/>
            <span>
              <b>Quick tip</b> On Android, add this page to the home screen for an app-like experience.
            </span>
          </div>
        </aside>
      </main>

      {showSettings && (
        <div className="settings-pop">
          <div className="settings-head">
            <b>Display settings</b>
            <button onClick={() => setShowSettings(false)}>×</button>
          </div>

          <label className="setting-check">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            Keep newest messages in view
          </label>

          <label className="setting-check">
            <input
              type="checkbox"
              checked={sound}
              onChange={e => setSound(e.target.checked)}
            />
            Play sound on new messages
          </label>

          <label className="setting-check">
            <input
              type="checkbox"
              checked={readAloud}
              onChange={toggleReadAloud}
            />
            Read chat messages aloud
          </label>

          <div className="settings-foot">Changes apply instantly.</div>
        </div>
      )}

      {toast && <div className="toast"><WifiOff size={15}/>{toast}</div>}

      <footer className="footer">
        <span>© 2026 PULSE CHAT</span>
        <span>
          BUILT FOR THE PEOPLE BEHIND THE STREAM <span className="heart">♥</span>
        </span>
        <span>V 1.0.0</span>
      </footer>
    </div>
  );
}

export default App;
