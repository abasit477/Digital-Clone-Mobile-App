/**
 * VoiceService — manages the WebSocket connection for real-time voice interaction.
 *
 * Usage:
 *   const session = voiceService.createSession(token, { onTranscript, onResponseText, onAudioChunk, onAudioDone, onError, onReady });
 *   await session.connect();
 *   await session.init(cloneId, domain);
 *   await session.sendAudio(base64AudioString);
 *   await session.endSpeech();
 *   session.disconnect();
 */

import { API_BASE_URL } from '../config/apiConfig';

// Convert http(s) base URL to ws(s)
const toWsUrl = (baseUrl) =>
  baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '');

export const voiceService = {
  createSession(authToken, handlers = {}) {
    const wsUrl = `${toWsUrl(API_BASE_URL)}/ws/voice`;
    let ws = null;
    let audioChunks = [];

    const send = (obj) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    };

    return {
      connect() {
        return new Promise((resolve, reject) => {
          ws = new WebSocket(wsUrl, [], {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          ws.onopen = () => resolve();
          ws.onerror = (e) => {
            handlers.onError?.(e);
            reject(e);
          };

          ws.onmessage = (event) => {
            let msg;
            try {
              msg = JSON.parse(event.data);
            } catch {
              return;
            }

            switch (msg.type) {
              case 'ready':
                handlers.onReady?.(msg.session_id);
                break;
              case 'transcript':
                handlers.onTranscript?.(msg.data);
                break;
              case 'response_text':
                handlers.onResponseText?.(msg.data);
                break;
              case 'audio_chunk':
                audioChunks.push(msg.data);
                handlers.onAudioChunk?.(msg.data);
                break;
              case 'audio_segment_done':
                handlers.onAudioSegmentDone?.();
                audioChunks = [];
                break;
              case 'turn_done':
                handlers.onTurnDone?.();
                break;
              case 'audio_done':
                // Fallback for older backend — treat as segment_done + turn_done
                handlers.onAudioSegmentDone?.(audioChunks);
                audioChunks = [];
                handlers.onTurnDone?.();
                break;
              case 'error':
                handlers.onError?.(msg.message);
                break;
              case 'pong':
                break;
            }
          };

          ws.onclose = () => handlers.onClose?.();
        });
      },

      init(cloneId, domain = 'general', sessionId = '') {
        send({ type: 'init', clone_id: cloneId, domain, session_id: sessionId });
      },

      sendAudio(base64Audio) {
        send({ type: 'audio_chunk', data: base64Audio });
      },

      endSpeech(format = 'mp4') {
        send({ type: 'end_of_speech', format });
      },

      ping() {
        send({ type: 'ping' });
      },

      disconnect() {
        ws?.close();
        ws = null;
      },
    };
  },
};

export default voiceService;
