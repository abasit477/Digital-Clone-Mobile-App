import { api } from '../../src/services/apiService';
import { familyService } from '../../src/services/familyService';

jest.mock('../../src/services/apiService', () => ({
  api: {
    get:    jest.fn(),
    post:   jest.fn(),
    delete: jest.fn(),
  },
}));

const mockFamily = {
  id: 'family-1',
  name: 'The Smiths',
  creator_email: 'creator@test.com',
  clone_id: 'clone-1',
  members: [{ id: 'm-creator', email: 'creator@test.com', role: 'creator' }],
};

beforeEach(() => jest.clearAllMocks());

// ── createFamily ──────────────────────────────────────────────────────────────

describe('familyService.createFamily', () => {
  it('posts name and clone_id and returns created family', async () => {
    api.post.mockResolvedValue({ data: mockFamily });
    const { data, error } = await familyService.createFamily('The Smiths', 'clone-1');
    expect(data).toEqual(mockFamily);
    expect(error).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/families', { name: 'The Smiths', clone_id: 'clone-1' });
  });

  it('sends null clone_id when not provided', async () => {
    api.post.mockResolvedValue({ data: { ...mockFamily, clone_id: null } });
    await familyService.createFamily('No Clone Yet');
    expect(api.post).toHaveBeenCalledWith('/families', { name: 'No Clone Yet', clone_id: null });
  });

  it('returns error on 403 for non-creator role', async () => {
    api.post.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await familyService.createFamily('X');
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });

  it('returns error on 409 duplicate family', async () => {
    api.post.mockRejectedValue({ status: 409, message: 'Family already exists' });
    const { data, error } = await familyService.createFamily('The Smiths', 'clone-1');
    expect(data).toBeNull();
    expect(error.status).toBe(409);
  });
});

// ── getMyFamily ───────────────────────────────────────────────────────────────

describe('familyService.getMyFamily', () => {
  it('calls GET /families/mine', async () => {
    api.get.mockResolvedValue({ data: mockFamily });
    const { data, error } = await familyService.getMyFamily();
    expect(data).toEqual(mockFamily);
    expect(error).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/families/mine');
  });

  it('returns error on 404 when no family exists', async () => {
    api.get.mockRejectedValue({ status: 404, message: 'Not found' });
    const { data, error } = await familyService.getMyFamily();
    expect(data).toBeNull();
    expect(error.status).toBe(404);
  });

  it('returns error on 403 for member role', async () => {
    api.get.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await familyService.getMyFamily();
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });
});

// ── inviteMember ──────────────────────────────────────────────────────────────

describe('familyService.inviteMember', () => {
  it('posts email and returns invite with code', async () => {
    const invite = { id: 'm-1', email: 'new@test.com', invite_code: 'ABCD1234', accepted_at: null, role: 'member' };
    api.post.mockResolvedValue({ data: invite });
    const { data, error } = await familyService.inviteMember('new@test.com');
    expect(data.invite_code).toBe('ABCD1234');
    expect(data.role).toBe('member');
    expect(error).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/families/invite', { email: 'new@test.com' });
  });

  it('returns error on 409 for duplicate email', async () => {
    api.post.mockRejectedValue({ status: 409, message: 'Already invited' });
    const { data, error } = await familyService.inviteMember('existing@test.com');
    expect(data).toBeNull();
    expect(error.status).toBe(409);
  });

  it('returns error on 422 for invalid email format', async () => {
    api.post.mockRejectedValue({ status: 422, message: 'Validation error' });
    const { data, error } = await familyService.inviteMember('not-an-email');
    expect(data).toBeNull();
    expect(error.status).toBe(422);
  });

  it('returns error on 404 when creator has no family', async () => {
    api.post.mockRejectedValue({ status: 404, message: 'Family not found' });
    const { data, error } = await familyService.inviteMember('new@test.com');
    expect(data).toBeNull();
    expect(error.status).toBe(404);
  });
});

// ── removeMember ──────────────────────────────────────────────────────────────

describe('familyService.removeMember', () => {
  it('calls DELETE /families/members/{id}', async () => {
    api.delete.mockResolvedValue({});
    const { error } = await familyService.removeMember('m-1');
    expect(error).toBeNull();
    expect(api.delete).toHaveBeenCalledWith('/families/members/m-1');
  });

  it('returns error on 404 for nonexistent member', async () => {
    api.delete.mockRejectedValue({ status: 404, message: 'Not found' });
    const { error } = await familyService.removeMember('ghost');
    expect(error.status).toBe(404);
  });

  it('returns error on 400 when trying to remove creator', async () => {
    api.delete.mockRejectedValue({ status: 400, message: 'Cannot remove creator' });
    const { error } = await familyService.removeMember('m-creator');
    expect(error.status).toBe(400);
  });
});

// ── joinFamily ────────────────────────────────────────────────────────────────

describe('familyService.joinFamily', () => {
  it('uppercases invite code before posting', async () => {
    api.post.mockResolvedValue({ data: { user_email: 'member@test.com', accepted_at: '2024-01-01' } });
    await familyService.joinFamily('testcode');
    expect(api.post).toHaveBeenCalledWith('/families/join', { invite_code: 'TESTCODE' });
  });

  it('returns joined member data on success', async () => {
    const result = { user_email: 'member@test.com', accepted_at: '2024-01-01T00:00:00' };
    api.post.mockResolvedValue({ data: result });
    const { data, error } = await familyService.joinFamily('TESTCODE');
    expect(data.user_email).toBe('member@test.com');
    expect(data.accepted_at).toBeTruthy();
    expect(error).toBeNull();
  });

  it('returns error on 404 for invalid code', async () => {
    api.post.mockRejectedValue({ status: 404, message: 'Invite not found' });
    const { data, error } = await familyService.joinFamily('BADCODE1');
    expect(data).toBeNull();
    expect(error.status).toBe(404);
  });

  it('returns error on 409 for already-used code', async () => {
    api.post.mockRejectedValue({ status: 409, message: 'Already joined' });
    const { data, error } = await familyService.joinFamily('JOINED01');
    expect(data).toBeNull();
    expect(error.status).toBe(409);
  });
});

// ── getMyClone ────────────────────────────────────────────────────────────────

describe('familyService.getMyClone', () => {
  it('calls GET /families/my-clone and returns clone', async () => {
    const clone = { id: 'clone-1', name: 'Test Clone', domains: 'general,family' };
    api.get.mockResolvedValue({ data: clone });
    const { data, error } = await familyService.getMyClone();
    expect(data).toEqual(clone);
    expect(error).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/families/my-clone');
  });

  it('returns error on 404 when member has no family', async () => {
    api.get.mockRejectedValue({ status: 404, message: 'Not found' });
    const { data, error } = await familyService.getMyClone();
    expect(data).toBeNull();
    expect(error.status).toBe(404);
  });
});

// ── synthesizePersona ─────────────────────────────────────────────────────────

describe('familyService.synthesizePersona', () => {
  it('posts answers with 60s timeout', async () => {
    const result = { persona_prompt: 'I am a software engineer...', knowledge_text: 'Q1: John Doe' };
    api.post.mockResolvedValue({ data: result });
    const answers = { q1: 'John Doe', q2: '45', q3: 'Software engineering' };
    const { data, error } = await familyService.synthesizePersona(answers);
    expect(data).toEqual(result);
    expect(error).toBeNull();
    expect(api.post).toHaveBeenCalledWith(
      '/families/synthesize-persona',
      { answers },
      { timeout: 60000 },
    );
  });

  it('returns error on Bedrock failure', async () => {
    api.post.mockRejectedValue({ status: 500, message: 'Bedrock error' });
    const { data, error } = await familyService.synthesizePersona({});
    expect(data).toBeNull();
    expect(error.status).toBe(500);
  });

  it('returns error on 403 for member role', async () => {
    api.post.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await familyService.synthesizePersona({});
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });
});
