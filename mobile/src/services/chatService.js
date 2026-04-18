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

  uploadAvatar: async (imageBase64) => {
    try {
      const response = await api.post('/avatar/upload', { image_data: imageBase64 }, { timeout: 30000 });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  sendVoiceMessage: async (audioBase64, format) => {
    try {
      const response = await api.post('/chat/voice-message', {
        audio_data: audioBase64,
        format,
      }, { timeout: 60000 });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  pollVideoStatus: async (jobId) => {
    try {
      const response = await api.get(`/chat/video/${jobId}`, { timeout: 10000 });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
