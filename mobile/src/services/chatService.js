import { api } from './apiService';

export default {
  sendMessage: async (message, isOpening = false) => {
    try {
      const response = await api.post('/chat/message', { message, is_opening: isOpening });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getHistory: async () => {
    try {
      const response = await api.get('/chat/history');
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  clearHistory: async () => {
    try {
      await api.delete('/chat/history');
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  sendVoiceMessage: async (audioBase64, format) => {
    try {
      const response = await api.post('/chat/voice-message', {
        audio_data: audioBase64,
        format,
      }, { timeout: 600000 }); // STT + Bedrock + F5-TTS CPU synthesis (~3-5 min per chunk)
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  uploadVoiceSample: async (audioBase64) => {
    try {
      const response = await api.post('/voice/upload-sample', {
        audio_data: audioBase64,
      }, { timeout: 30000 });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
