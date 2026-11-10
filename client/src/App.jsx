import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AudioLines, Bell, BellOff, Check, ChevronDown, CircleHelp, Crown, ExternalLink, Headphones, MessageCircle, Mic2, Monitor, Moon, Radio, Settings2, ShieldCheck, Smartphone, Sparkles, Star, Volume2, VolumeX, Wifi, WifiOff, Youtube } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:4000'
    : window.location.origin);
const demoMessages = [
  { id: 'd1', author: 'pixelpirate', text: 'That was such a clean play!! 🔥', publishedAt: new Date(Date.now()-42000).toISOString(), isMember: true },
  { id: 'd2', author: 'MiraPlays', text: 'How long have you been practicing this map?', publishedAt: new Date(Date.now()-31000).toISOString() },
  { id: 'd3', author: 'the_real_arya', text: 'CHAT WE ARE SO BACK 😭', publishedAt: new Date(Date.now()-21000).toISOString(), isModerator: true },
  { id: 'd4', author: 'NeonNinja', text: 'Your aim is actually insane', publishedAt: new Date(Date.now()-11000).toISOString() },
];

function App() {
  const [account, setAccount] = useState(null);
  const [messages, setMessages] = useState(demoMessages);
  const [status, setStatus] = useState({ status: 'demo', message: 'Preview mode · connect YouTube to go live' });
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(45);
  const [fontSize, setFontSize] = useState(19);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const audioRef = useRef(null);
  const isFirstBatch = useRef(true);

  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: 'include' }).then(r => r.json()).then(data => setAccount(data.connected ? data : null)).catch(() => setAccount(null));
    const params = new URLSearchParams(window.location.search);
    if (params.has('authError')) { setToast('Google connection was cancelled or failed. Try again.'); window.history.replaceState({}, '', '/'); }
  }, []);

  useEffect(() => {
    if (!account?.connected) return;
    const socket = io(API, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => { setMessages([]); isFirstBatch.current = true; socket.emit('chat:start'); });
    socket.on('connect_error', () => setStatus({ status: 'error', message: 'Could not connect to chat server.' }));
    socket.on('chat:status', setStatus);
    socket.on('chat:message', message => {
      setMessages(current => [...current, message].slice(-250));
      if (!message.isInitial) { setNewCount(n => n + 1); playPop(); }
      isFirstBatch.current = false;
    });
    return () => socket.disconnect();
  }, [account]);

  useEffect(() => { if (autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, autoScroll]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3600); return () => clearTimeout(id); }, [toast]);

  const playPop = () => {
    if (!sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(740, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.075);
      gain.gain.setValueAtTime((volume / 100) * 0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.17);
    } catch { /* Audio may be blocked until the user interacts with the page. */ }
  };

  const connect = () => { window.location.href = `${API}/auth/google`; };
  const disconnect = async () => { await fetch(`${API}/api/logout`, { method: 'POST', credentials: 'include' }); socketRef.current?.disconnect(); setAccount(null); setStatus({ status: 'demo', message: 'Preview mode · connect YouTube to go live' }); setMessages(demoMessages); };
  const time = value => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const statusLabel = status.status === 'connected' ? 'LIVE CHAT CONNECTED' : status.status === 'waiting' ? 'WAITING FOR STREAM' : status.status === 'error' ? 'RECONNECTING' : 'PREVIEW MODE';

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark"><AudioLines size={21}/></span><span>PULSE<span className="brand-light">CHAT</span><small>STREAMER COMPANION</small></span></a>
      <div className="top-center"><span className={`status-dot ${status.status}`}></span><span>{statusLabel}</span><span className="top-divider"/><span className="subtle">{account?.channel?.title || 'Your chat, in focus'}</span></div>
      <div className="top-actions"><button className="icon-button" title="Settings" onClick={() => setShowSettings(v => !v)}><Settings2 size={18}/></button>{account?.connected ? <button className="connect-button connected" onClick={disconnect}><Check size={16}/> Connected</button> : <button className="connect-button" onClick={connect}><Youtube size={17}/> Connect YouTube</button>}</div>
    </header>

    <main className="main-layout">
      <section className="chat-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> LIVE FEED</div><h1>Chat <span>stream.</span></h1><p className="panel-subtitle">Every message. One clear view.</p></div><div className="feed-count"><MessageCircle size={15}/><b>{messages.length}</b><span>messages</span></div></div>
        <div className="chat-toolbar"><div className="toolbar-left"><span className="live-pill"><i/> {account?.connected ? 'LIVE' : 'DEMO'}</span><span className="toolbar-caption">Newest messages appear below</span></div><div className="toolbar-right"><button className={`small-tool ${autoScroll ? 'active' : ''}`} onClick={() => setAutoScroll(v => !v)}><ChevronDown size={14}/> Auto-scroll</button><button className={`small-tool ${sound ? 'active' : ''}`} onClick={() => setSound(v => !v)}>{sound ? <Volume2 size={14}/> : <VolumeX size={14}/>} Sound</button></div></div>
        <div className="message-list" ref={listRef}>
          {messages.map((m, i) => <article className={`message-card ${m.amount ? 'superchat' : ''}`} key={m.id} style={{ '--delay': `${Math.min(i, 8) * 35}ms`, '--font-size': `${fontSize}px` }}>
            <div className="avatar">{m.avatar ? <img src={m.avatar} alt=""/> : (m.author || '?').slice(0,1).toUpperCase()}</div>
            <div className="message-content"><div className="message-meta"><strong>{m.author}</strong>{m.isOwner && <span className="role owner"><Crown size={10}/> OWNER</span>}{m.isModerator && <span className="role mod">MOD</span>}{m.isMember && <span className="role member"><Star size={10}/> MEMBER</span>}<time>{time(m.publishedAt)}</time></div><p>{m.text}</p>{m.amount && <div className="superchat-amount">{m.amount} · SUPER CHAT</div>}</div>
            {m.amount && <Sparkles className="superchat-spark" size={17}/>}
          </article>)}
          {!account?.connected && <div className="demo-note"><Sparkles size={15}/> These are sample messages. Connect YouTube to see her real live chat.</div>}
        </div>
        <div className="chat-footer"><span><span className="footer-pulse"/> {status.message}</span><span>{newCount > 0 ? `${newCount} new` : 'Waiting for messages'}</span></div>
      </section>

      <aside className="side-column">
        <section className="welcome-card"><div className="orb orb-one"/><div className="orb orb-two"/><div className="welcome-content"><span className="mini-label"><Sparkles size={12}/> MADE FOR STREAMERS</span><h2>Stay in the<br/><em>moment.</em></h2><p>No second monitor? No problem. Keep chat close, clear, and impossible to miss.</p><div className="device-tags"><span><Monitor size={13}/> DESKTOP</span><span><Smartphone size={13}/> MOBILE</span></div></div></section>
        <section className="control-card"><div className="card-title"><div><span className="eyebrow">QUICK CONTROLS</span><h3>Your setup</h3></div><div className="control-icon"><Headphones size={17}/></div></div>
          <div className="control-row"><div className="control-label"><span className="control-symbol"><Bell size={16}/></span><div><b>Message sound</b><small>A soft pop for each new chat</small></div></div><button className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound(v => !v)} aria-label="Toggle sound"><span/></button></div>
          <div className="volume-block"><div className="volume-heading"><span>Notification volume</span><b>{volume}%</b></div><input type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} /></div>
          <div className="control-row"><div className="control-label"><span className="control-symbol"><Mic2 size={16}/></span><div><b>Readable chat</b><small>Adjust message size</small></div></div><div className="font-adjust"><button onClick={() => setFontSize(v => Math.max(15, v-1))}>−</button><b>{fontSize}</b><button onClick={() => setFontSize(v => Math.min(27, v+1))}>+</button></div></div>
          <button className="test-sound" onClick={playPop}><AudioLines size={15}/> Test notification sound</button>
        </section>
        <section className="connection-card"><div className="connection-head"><span className="connection-icon"><ShieldCheck size={17}/></span><div><b>Private connection</b><small>Google OAuth · YouTube read-only</small></div><span className="secure-check"><Check size={13}/></span></div><p>Your Google password is never shared with Pulse Chat. You can disconnect anytime.</p>{!account?.connected && <button className="wide-connect" onClick={connect}><Youtube size={16}/> Connect her YouTube channel <ExternalLink size={13}/></button>}</section>
        <div className="tip-card"><CircleHelp size={15}/><span><b>Quick tip</b> On Android, add this page to the home screen for an app-like experience.</span></div>
      </aside>
    </main>
    {showSettings && <div className="settings-pop"><div className="settings-head"><b>Display settings</b><button onClick={() => setShowSettings(false)}>×</button></div><label className="setting-check"><input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/> Keep newest messages in view</label><label className="setting-check"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)}/> Play sound on new messages</label><div className="settings-foot">Changes apply instantly.</div></div>}
    {toast && <div className="toast"><WifiOff size={15}/>{toast}</div>}
    <footer className="footer"><span>© 2026 PULSE CHAT</span><span>BUILT FOR THE PEOPLE BEHIND THE STREAM <span className="heart">♥</span></span><span>V 1.0.0</span></footer>
  </div>;
}
export default App;
