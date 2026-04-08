import { api } from './apiService';
import apiClient from './apiService';

export const cloneService = {
  // ── Public ──────────────────────────────────────────────────────────────────

  listClones: async () => {
    try {
      const response = await api.get('/clones');
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getClone: async (cloneId) => {
    try {
      const response = await api.get(`/clones/${cloneId}`);
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ── Admin ────────────────────────────────────────────────────────────────────

  createClone: async (payload) => {
    try {
      const response = await api.post('/clones', payload);
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updateClone: async (cloneId, payload) => {
    try {
      const response = await api.put(`/clones/${cloneId}`, payload);
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  deleteClone: async (cloneId) => {
    try {
      await api.delete(`/clones/${cloneId}`);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  /**
   * Ingest plain text into a clone's knowledge base.
   */
  ingestText: async (cloneId, text, source = '') => {
    try {
      // Long timeout — first run downloads the embedding model (~90MB)
      const response = await api.post(
        `/admin/clones/${cloneId}/ingest`,
        { text, source },
        { timeout: 120000 },
      );
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Upload a .txt or .md file to a clone's knowledge base.
   * @param {string} cloneId
   * @param {string} fileUri  - local file URI from expo-document-picker
   * @param {string} fileName
   */
  ingestFile: async (cloneId, fileUri, fileName) => {
    try {
      const formData = new FormData();
      formData.append('file', { uri: fileUri, name: fileName, type: 'text/plain' });
      formData.append('source', fileName);

      const response = await apiClient.post(
        `/admin/clones/${cloneId}/ingest/file`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        },
      );
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  clearKnowledge: async (cloneId) => {
    try {
      await api.delete(`/admin/clones/${cloneId}/knowledge`);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },
};

export default cloneService;
