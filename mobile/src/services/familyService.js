import { api } from './apiService';

export const familyService = {
  createFamily: async (name, cloneId = null) => {
    try {
      const response = await api.post('/families', { name, clone_id: cloneId });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getMyFamily: async () => {
    try {
      const response = await api.get('/families/mine');
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  inviteMember: async (email) => {
    try {
      const response = await api.post('/families/invite', { email });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  removeMember: async (memberId) => {
    try {
      await api.delete(`/families/members/${memberId}`);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  joinFamily: async (inviteCode) => {
    try {
      const response = await api.post('/families/join', { invite_code: inviteCode.toUpperCase() });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getMyClone: async () => {
    try {
      const response = await api.get('/families/my-clone');
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  synthesizePersona: async (answers) => {
    try {
      const response = await api.post('/families/synthesize-persona', { answers }, { timeout: 60000 });
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

export default familyService;
