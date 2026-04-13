import { api } from '../../src/services/apiService';
import { cloneService } from '../../src/services/cloneService';

jest.mock('../../src/services/apiService', () => ({
  api: {
    get:    jest.fn(),
    post:   jest.fn(),
    put:    jest.fn(),
    delete: jest.fn(),
  },
  // apiClient used for multipart/form-data in ingestFile
  default: {
    post: jest.fn(),
  },
}));

const mockClone = {
  id: 'clone-1',
  name: 'Test Clone',
  title: 'Engineer',
  description: 'A test',
  persona_prompt: 'I am me.',
  domains: 'general',
  is_active: true,
  creator_email: 'creator@test.com',
};

beforeEach(() => jest.clearAllMocks());

// ── listClones ─────────────────────────────────────────────────────────────────

describe('cloneService.listClones', () => {
  it('calls GET /clones and returns data', async () => {
    api.get.mockResolvedValue({ data: [mockClone] });
    const { data, error } = await cloneService.listClones();
    expect(data).toEqual([mockClone]);
    expect(error).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/clones');
  });

  it('returns null data and error on network failure', async () => {
    const err = { status: 500, message: 'Internal Server Error' };
    api.get.mockRejectedValue(err);
    const { data, error } = await cloneService.listClones();
    expect(data).toBeNull();
    expect(error).toEqual(err);
  });

  it('returns empty array when no clones exist', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { data } = await cloneService.listClones();
    expect(data).toEqual([]);
  });
});

// ── getClone ──────────────────────────────────────────────────────────────────

describe('cloneService.getClone', () => {
  it('calls GET /clones/{id} with correct id', async () => {
    api.get.mockResolvedValue({ data: mockClone });
    const { data } = await cloneService.getClone('clone-1');
    expect(data).toEqual(mockClone);
    expect(api.get).toHaveBeenCalledWith('/clones/clone-1');
  });

  it('returns error on 404', async () => {
    api.get.mockRejectedValue({ status: 404, message: 'Not found' });
    const { data, error } = await cloneService.getClone('nonexistent');
    expect(data).toBeNull();
    expect(error.status).toBe(404);
  });

  it('returns error on 403 when accessing another creator\'s clone', async () => {
    api.get.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await cloneService.getClone('other-clone');
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });
});

// ── createClone ───────────────────────────────────────────────────────────────

describe('cloneService.createClone', () => {
  const payload = {
    name: 'My Clone',
    title: 'Engineer',
    description: 'A test',
    persona_prompt: 'I am me.',
    domains: 'general',
  };

  it('calls POST /clones with payload and returns created clone', async () => {
    api.post.mockResolvedValue({ data: mockClone });
    const { data, error } = await cloneService.createClone(payload);
    expect(data).toEqual(mockClone);
    expect(error).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/clones', payload);
  });

  it('returns error on 403 for non-creator role', async () => {
    api.post.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await cloneService.createClone(payload);
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });

  it('returns error on 422 for missing required fields', async () => {
    api.post.mockRejectedValue({ status: 422, message: 'Unprocessable entity' });
    const { data, error } = await cloneService.createClone({ name: 'Only Name' });
    expect(data).toBeNull();
    expect(error.status).toBe(422);
  });
});

// ── updateClone ───────────────────────────────────────────────────────────────

describe('cloneService.updateClone', () => {
  it('calls PUT /clones/{id} with updated fields', async () => {
    const updated = { ...mockClone, name: 'Updated Name' };
    api.put.mockResolvedValue({ data: updated });
    const { data } = await cloneService.updateClone('clone-1', { name: 'Updated Name' });
    expect(data.name).toBe('Updated Name');
    expect(api.put).toHaveBeenCalledWith('/clones/clone-1', { name: 'Updated Name' });
  });

  it('returns error on 403 when updating another creator\'s clone', async () => {
    api.put.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { data, error } = await cloneService.updateClone('other-clone', { name: 'X' });
    expect(data).toBeNull();
    expect(error.status).toBe(403);
  });

  it('returns error on 404 for nonexistent clone', async () => {
    api.put.mockRejectedValue({ status: 404, message: 'Not found' });
    const { error } = await cloneService.updateClone('ghost', { name: 'X' });
    expect(error.status).toBe(404);
  });
});

// ── deleteClone ───────────────────────────────────────────────────────────────

describe('cloneService.deleteClone', () => {
  it('calls DELETE /clones/{id} and returns no error', async () => {
    api.delete.mockResolvedValue({});
    const { error } = await cloneService.deleteClone('clone-1');
    expect(error).toBeNull();
    expect(api.delete).toHaveBeenCalledWith('/clones/clone-1');
  });

  it('returns error on 404', async () => {
    api.delete.mockRejectedValue({ status: 404, message: 'Not found' });
    const { error } = await cloneService.deleteClone('ghost');
    expect(error.status).toBe(404);
  });

  it('returns error on 403', async () => {
    api.delete.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { error } = await cloneService.deleteClone('other-clone');
    expect(error.status).toBe(403);
  });
});

// ── ingestText ────────────────────────────────────────────────────────────────

describe('cloneService.ingestText', () => {
  it('posts text and source with 120s timeout', async () => {
    api.post.mockResolvedValue({ data: { chunks_ingested: 5 } });
    const { data, error } = await cloneService.ingestText('clone-1', 'Hello world', 'test-source');
    expect(data.chunks_ingested).toBe(5);
    expect(error).toBeNull();
    expect(api.post).toHaveBeenCalledWith(
      '/admin/clones/clone-1/ingest',
      { text: 'Hello world', source: 'test-source' },
      { timeout: 120000 },
    );
  });

  it('uses empty string as default source', async () => {
    api.post.mockResolvedValue({ data: { chunks_ingested: 2 } });
    await cloneService.ingestText('clone-1', 'Some text');
    expect(api.post).toHaveBeenCalledWith(
      '/admin/clones/clone-1/ingest',
      { text: 'Some text', source: '' },
      { timeout: 120000 },
    );
  });
});

// ── clearKnowledge ────────────────────────────────────────────────────────────

describe('cloneService.clearKnowledge', () => {
  it('calls DELETE on knowledge endpoint', async () => {
    api.delete.mockResolvedValue({});
    const { error } = await cloneService.clearKnowledge('clone-1');
    expect(error).toBeNull();
    expect(api.delete).toHaveBeenCalledWith('/admin/clones/clone-1/knowledge');
  });

  it('returns error on failure', async () => {
    api.delete.mockRejectedValue({ status: 404, message: 'Clone not found' });
    const { error } = await cloneService.clearKnowledge('ghost');
    expect(error.status).toBe(404);
  });
});
