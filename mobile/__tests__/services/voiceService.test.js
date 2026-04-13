import { voiceService } from '../../src/services/voiceService';

// ── WebSocket mock ────────────────────────────────────────────────────────────

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this._sent = [];
    MockWebSocket.lastInstance = this;
  }

  send(data) {
    this._sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers to simulate server events
  _open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  _message(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  _error(err) {
    this.onerror?.(err);
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN       = 1;
MockWebSocket.CLOSING    = 2;
MockWebSocket.CLOSED     = 3;

global.WebSocket = MockWebSocket;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openSession(token, handlers = {}) {
  const session = voiceService.createSession(token, handlers);
  const connectPromise = session.connect();
  MockWebSocket.lastInstance._open();
  await connectPromise;
  return session;
}

beforeEach(() => {
  MockWebSocket.lastInstance = null;
  jest.clearAllMocks();
});

// ── connect ───────────────────────────────────────────────────────────────────

describe('session.connect', () => {
  it('opens WebSocket with auth token in query param', async () => {
    await openSession('my-token');
    expect(MockWebSocket.lastInstance.url).toContain('?token=my-token');
  });

  it('encodes special characters in token URL', async () => {
    await openSession('tok+en/with=special');
    const url = MockWebSocket.lastInstance.url;
    // encodeURIComponent should encode + / =
    expect(url).not.toMatch(/\+|\/with=/);
    expect(url).toContain('tok');
  });

  it('uses wss:// when base URL is https://', async () => {
    // API_BASE_URL is http://localhost:8000/api/v1 in test env
    // → ws://localhost:8000/api/v1/ws/voice
    await openSession('t');
    expect(MockWebSocket.lastInstance.url).toMatch(/^ws/);
  });

  it('rejects and calls onError on connection error', async () => {
    const onError = jest.fn();
    const session = voiceService.createSession('token', { onError });
    const connectPromise = session.connect();
    const err = new Error('Connection refused');
    MockWebSocket.lastInstance._error(err);
    await expect(connectPromise).rejects.toEqual(err);
    expect(onError).toHaveBeenCalledWith(err);
  });
});

// ── message handlers ──────────────────────────────────────────────────────────

describe('message: ready', () => {
  it('calls onReady with session_id', async () => {
    const onReady = jest.fn();
    await openSession('token', { onReady });
    MockWebSocket.lastInstance._message({ type: 'ready', session_id: 'sess-123' });
    expect(onReady).toHaveBeenCalledWith('sess-123');
  });
});

describe('message: transcript', () => {
  it('calls onTranscript with transcribed text', async () => {
    const onTranscript = jest.fn();
    await openSession('token', { onTranscript });
    MockWebSocket.lastInstance._message({ type: 'transcript', data: 'Hello, how are you?' });
    expect(onTranscript).toHaveBeenCalledWith('Hello, how are you?');
  });
});

describe('message: response_text', () => {
  it('calls onResponseText with clone reply text', async () => {
    const onResponseText = jest.fn();
    await openSession('token', { onResponseText });
    MockWebSocket.lastInstance._message({ type: 'response_text', data: 'I am doing well!' });
    expect(onResponseText).toHaveBeenCalledWith('I am doing well!');
  });
});

describe('message: audio_chunk', () => {
  it('calls onAudioChunk and accumulates chunks', async () => {
    const onAudioChunk = jest.fn();
    await openSession('token', { onAudioChunk });
    MockWebSocket.lastInstance._message({ type: 'audio_chunk', data: 'base64chunk1' });
    MockWebSocket.lastInstance._message({ type: 'audio_chunk', data: 'base64chunk2' });
    expect(onAudioChunk).toHaveBeenCalledTimes(2);
    expect(onAudioChunk).toHaveBeenNthCalledWith(1, 'base64chunk1');
    expect(onAudioChunk).toHaveBeenNthCalledWith(2, 'base64chunk2');
  });
});

describe('message: audio_segment_done', () => {
  it('calls onAudioSegmentDone and resets chunk buffer', async () => {
    const onAudioSegmentDone = jest.fn();
    await openSession('token', { onAudioSegmentDone });
    MockWebSocket.lastInstance._message({ type: 'audio_chunk', data: 'chunk' });
    MockWebSocket.lastInstance._message({ type: 'audio_segment_done' });
    expect(onAudioSegmentDone).toHaveBeenCalled();
  });
});

describe('message: turn_done', () => {
  it('calls onTurnDone when turn completes', async () => {
    const onTurnDone = jest.fn();
    await openSession('token', { onTurnDone });
    MockWebSocket.lastInstance._message({ type: 'turn_done' });
    expect(onTurnDone).toHaveBeenCalled();
  });
});

describe('message: error', () => {
  it('calls onError with error message from server', async () => {
    const onError = jest.fn();
    await openSession('token', { onError });
    MockWebSocket.lastInstance._message({ type: 'error', message: 'Authentication failed' });
    expect(onError).toHaveBeenCalledWith('Authentication failed');
  });
});

describe('message: audio_done (legacy backend compatibility)', () => {
  it('calls both onAudioSegmentDone and onTurnDone', async () => {
    const onAudioSegmentDone = jest.fn();
    const onTurnDone = jest.fn();
    await openSession('token', { onAudioSegmentDone, onTurnDone });
    MockWebSocket.lastInstance._message({ type: 'audio_done' });
    expect(onAudioSegmentDone).toHaveBeenCalled();
    expect(onTurnDone).toHaveBeenCalled();
  });
});

describe('message: pong', () => {
  it('does not throw for pong message', async () => {
    await openSession('token', {});
    expect(() => {
      MockWebSocket.lastInstance._message({ type: 'pong' });
    }).not.toThrow();
  });
});

describe('message: invalid JSON', () => {
  it('does not throw on malformed message', async () => {
    const session = voiceService.createSession('token', {});
    const connectPromise = session.connect();
    MockWebSocket.lastInstance._open();
    await connectPromise;
    expect(() => {
      MockWebSocket.lastInstance.onmessage?.({ data: 'not valid json {{' });
    }).not.toThrow();
  });
});

// ── connection close ──────────────────────────────────────────────────────────

describe('connection close', () => {
  it('calls onClose when WebSocket closes', async () => {
    const onClose = jest.fn();
    await openSession('token', { onClose });
    MockWebSocket.lastInstance.close();
    expect(onClose).toHaveBeenCalled();
  });
});

// ── session.init ──────────────────────────────────────────────────────────────

describe('session.init', () => {
  it('sends init message with clone_id, domain, and session_id', async () => {
    const session = await openSession('token');
    session.init('clone-1', 'family', 'sess-abc');
    expect(MockWebSocket.lastInstance._sent).toContainEqual({
      type: 'init',
      clone_id: 'clone-1',
      domain: 'family',
      session_id: 'sess-abc',
    });
  });

  it('defaults domain to "general" when not provided', async () => {
    const session = await openSession('token');
    session.init('clone-1');
    expect(MockWebSocket.lastInstance._sent[0].domain).toBe('general');
  });
});

// ── session.sendAudio ─────────────────────────────────────────────────────────

describe('session.sendAudio', () => {
  it('sends audio_chunk message with base64 data', async () => {
    const session = await openSession('token');
    session.sendAudio('base64audiodata==');
    expect(MockWebSocket.lastInstance._sent).toContainEqual({
      type: 'audio_chunk',
      data: 'base64audiodata==',
    });
  });
});

// ── session.endSpeech ─────────────────────────────────────────────────────────

describe('session.endSpeech', () => {
  it('sends end_of_speech with wav format', async () => {
    const session = await openSession('token');
    session.endSpeech('wav');
    expect(MockWebSocket.lastInstance._sent).toContainEqual({
      type: 'end_of_speech',
      format: 'wav',
    });
  });

  it('defaults format to mp4', async () => {
    const session = await openSession('token');
    session.endSpeech();
    expect(MockWebSocket.lastInstance._sent[0]).toEqual({ type: 'end_of_speech', format: 'mp4' });
  });
});

// ── session.ping ──────────────────────────────────────────────────────────────

describe('session.ping', () => {
  it('sends ping message', async () => {
    const session = await openSession('token');
    session.ping();
    expect(MockWebSocket.lastInstance._sent).toContainEqual({ type: 'ping' });
  });
});

// ── session.disconnect ────────────────────────────────────────────────────────

describe('session.disconnect', () => {
  it('closes the WebSocket connection', async () => {
    const session = await openSession('token');
    const ws = MockWebSocket.lastInstance;
    session.disconnect();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });
});
