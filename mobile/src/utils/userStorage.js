/**
 * Per-user AsyncStorage key helpers.
 * Namespaces keys by email so multiple users on the same device
 * each get their own data.
 */
export const storageKey = (username, key) => `${username}:${key}`;

export const KEYS = {
  // Creator
  assessmentAnswers: 'assessment_answers',
  chatHistory:       'chat_history',
  // Member
  memberFamilyInfo:  'member_family_info',   // { family_id, family_name, creator_email, creator_name, relationship }
  memberAnswers:     'member_answers',
  memberChatHistory: 'member_chat_history',
};
