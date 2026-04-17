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
      }, { timeout: 60000 }); // transcription can take 15-30s
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
