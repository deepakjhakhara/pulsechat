import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import session from 'express-session';
import cors from 'cors';
import { Server } from 'socket.io';
import { google } from 'googleapis';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Validate required environment variables
const requiredEnv = [
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

const missingEnv = requiredEnv.filter(
  (key) => !process.env[key]
);

if (missingEnv.length) {
  console.error('Missing environment variables:', missingEnv.join(', '));
  process.exit(1);
}

// Session configuration
const sessionMiddleware = session({
  name: 'scc.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
});

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(sessionMiddleware);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true
  }
});

io.engine.use(sessionMiddleware);

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

// Active chat pollers
const pollers = new Map();

function stopPoller(sessionId) {
  const entry = pollers.get(sessionId);

  if (entry?.timer) {
    clearTimeout(entry.timer);
  }

  pollers.delete(sessionId);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'streamer-chat-companion'
  });
});

// Start Google OAuth
app.get('/auth/google', (req, res) => {
  const state = randomBytes(32).toString('hex');

  req.session.oauthState = state;

  // Save session BEFORE redirecting to Google
  req.session.save((err) => {
    if (err) {
      console.error('Session save failed:', err);
      return res.status(500).send(
        'Could not initialize Google login.'
      );
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly'
      ],
      state
    });

    res.redirect(authUrl);
  });
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect(
        `${CLIENT_ORIGIN}/?authError=${encodeURIComponent(req.query.error)}`
      );
    }

    const returnedState = req.query.state;
    const savedState = req.session.oauthState;

    if (
      !returnedState ||
      !savedState ||
      returnedState !== savedState ||
      !req.query.code
    ) {
      console.error('OAuth state mismatch');

      return res.status(400).send(
        'Invalid OAuth state. Please try connecting again.'
      );
    }

    // Remove state after successful validation
    delete req.session.oauthState;

    const { tokens } = await oauth2Client.getToken(
      String(req.query.code)
    );

    req.session.tokens = {
      ...req.session.tokens,
      ...tokens
    };

    // Save tokens before returning to frontend
    req.session.save((err) => {
      if (err) {
        console.error('Token session save failed:', err);

        return res.status(500).send(
          'Could not save Google session.'
        );
      }

      console.log('Google OAuth successful!');

      res.redirect(CLIENT_ORIGIN);
    });

  } catch (error) {
    console.error(
      'OAuth callback failed:',
      error.response?.data || error.message
    );

    res.redirect(
      `${CLIENT_ORIGIN}/?authError=oauth_failed`
    );
  }
});

// Get connected YouTube account
app.get('/api/me', async (req, res) => {
  if (!req.session.tokens) {
    return res.json({
      connected: false
    });
  }

  try {
    oauth2Client.setCredentials(req.session.tokens);

    const { data } = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    });

    const channel = data.items?.[0];

    res.json({
      connected: true,
      channel: channel
        ? {
            title: channel.snippet?.title,
            thumbnail:
              channel.snippet?.thumbnails?.default?.url
          }
        : null
    });

  } catch (error) {
    console.error(
      'Account check failed:',
      error.response?.data || error.message
    );

    res.status(401).json({
      connected: false,
      error: 'Your Google connection expired. Please reconnect.'
    });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  stopPoller(req.sessionID);

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        ok: false,
        error: 'Logout failed.'
      });
    }

    res.clearCookie('scc.sid');

    res.json({
      ok: true
    });
  });
});

// Socket authentication
io.use((socket, next) => {
  const session = socket.request.session;

  if (!session?.tokens) {
    return next(
      new Error('Connect your YouTube account first.')
    );
  }

  next();
});

// Live chat connection
io.on('connection', (socket) => {
  const session = socket.request.session;
  const sessionId = socket.request.sessionID;

  stopPoller(sessionId);

  oauth2Client.setCredentials(session.tokens);

  let pageToken;
  let stopped = false;
  let timer;

  const seen = new Set();
  let initialBatch = true;

  const emitStatus = (status, message) => {
    socket.emit('chat:status', {
      status,
      message
    });
  };

  const schedule = (ms) => {
    if (stopped) return;

    timer = setTimeout(
      poll,
      Math.max(1000, Math.min(ms || 5000, 30000))
    );

    pollers.set(sessionId, {
      socket,
      timer
    });
  };

  async function poll() {
    if (stopped) return;

    try {
      // Find active YouTube livestream
      const broadcasts = await youtube.liveBroadcasts.list({
  part: ['snippet', 'status'],
  mine: true,
  maxResults: 10
});

const live = broadcasts.data.items?.find(
  (item) =>
    item.status?.lifeCycleStatus === 'live' &&
    item.snippet?.liveChatId
);

      if (!live) {
        emitStatus(
          'waiting',
          'No active YouTube live chat found. Start your stream and keep this page open.'
        );

        schedule(10000);
        return;
      }

      const chatId = live.snippet.liveChatId;

      emitStatus(
        'connected',
        `Connected to ${live.snippet.title || 'your live stream'}`
      );

      // Retrieve live messages
      const response = await youtube.liveChatMessages.list({
        liveChatId: chatId,
        part: ['snippet', 'authorDetails'],
        pageToken,
        maxResults: 200
      });

      pageToken = response.data.nextPageToken || pageToken;

      const items = response.data.items || [];

      for (const item of items) {
        if (seen.has(item.id)) continue;

        seen.add(item.id);

        const snippet = item.snippet || {};
        const author = item.authorDetails || {};

        socket.emit('chat:message', {
          id: item.id,

          type: snippet.type || 'textMessageEvent',

          text:
            snippet.displayMessage ||
            snippet.textMessageDetails?.messageText ||
            '',

          publishedAt: snippet.publishedAt,

          author: author.displayName || 'YouTube user',

          avatar: author.profileImageUrl || null,

          channelId: author.channelId || null,

          isOwner: Boolean(author.isChatOwner),

          isModerator: Boolean(author.isChatModerator),

          isMember: Boolean(author.isChatSponsor),

          amount:
            snippet.superChatDetails?.amountDisplayString ||
            snippet.superStickerDetails?.amountDisplayString ||
            null,

          currency:
            snippet.superChatDetails?.currency ||
            snippet.superStickerDetails?.currency ||
            null,

          isInitial: initialBatch
        });
      }

      initialBatch = false;

      if (seen.size > 5000) {
        seen.clear();
      }

      schedule(
        Number(response.data.pollingIntervalMillis) || 5000
      );

    } catch (error) {
      const reason =
        error?.response?.data?.error?.message ||
        error.message;

      console.error('Chat polling failed:', reason);

      emitStatus(
        'error',
        reason.includes('liveChatNotFound')
          ? 'Could not find the active live chat.'
          : reason.includes('liveChatEnded')
          ? 'The live stream has ended.'
          : 'Chat connection interrupted. Retrying…'
      );

      schedule(8000);
    }
  }

  socket.on('chat:start', () => {
    if (timer) clearTimeout(timer);
    poll();
  });

  socket.on('disconnect', () => {
    stopped = true;

    if (timer) clearTimeout(timer);

    stopPoller(sessionId);
  });

  poll();
});

// Serve React frontend in production
const clientDistPath = path.resolve(__dirname, '../client/dist');

app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/')) {
    return next();
  }

  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(
    `Streamer Chat Companion server running on http://localhost:${PORT}`
  );
});
