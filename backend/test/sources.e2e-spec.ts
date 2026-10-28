import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/chat/sessions.service';
import { chunkMarkdown } from '../src/rag/chunker';
import * as embeddings from '../src/rag/embeddings';
import { EMBEDDING_DIMENSIONS } from '../src/rag/rag.types';
import { VectorStore } from '../src/rag/vector-store';
import type { Topic } from '../src/chat/session.types';

const mockClaude = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({ messages: { create: mockClaude } })),
}));

const generatedTopics = [
  {
    label: 'Responsabilidades',
    objectives: [{ label: 'Distinguir roles' }, { label: 'Aplicar roles' }],
  },
  {
    label: 'Eventos',
    objectives: [
      { label: 'Identificar eventos' },
      { label: 'Explicar su propósito' },
    ],
  },
  {
    label: 'Artefactos',
    objectives: [
      { label: 'Distinguir artefactos' },
      { label: 'Relacionar compromisos' },
    ],
  },
];

interface SourceResponse {
  sourceId: string;
  name: string;
  chunksCount: number;
}

describe('Carga de fuentes (e2e)', () => {
  let app: INestApplication<App>;
  let store: VectorStore;
  let db: Database.Database;
  let dbPath: string;
  let generate: jest.SpiedFunction<typeof embeddings.generateEmbeddings>;
  const scrum = readFileSync(join(__dirname, '../docs/academic/scrum.md'));

  beforeEach(async () => {
    mockClaude.mockReset().mockResolvedValue({
      content: [
        { type: 'text', text: JSON.stringify({ topics: generatedTopics }) },
      ],
      stop_reason: 'end_turn',
    });
    dbPath = join(tmpdir(), `tutor-sources-${randomUUID()}.db`);
    store = new VectorStore(dbPath);
    // Solo se simula el proveedor externo; fragmentación y SQLite son reales.
    generate = jest
      .spyOn(embeddings, 'generateEmbeddings')
      .mockImplementation((texts) =>
        Promise.resolve(
          texts.map(() => Array<number>(EMBEDDING_DIMENSIONS).fill(0.25)),
        ),
      );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VectorStore)
      .useValue(store)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    db = new Database(dbPath, { readonly: true });
    sqliteVec.load(db);
  });

  afterEach(async () => {
    db.close();
    await app.close();
    jest.restoreAllMocks();
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
    }
  });

  async function createSession(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/sessions')
      .expect(201);
    return (response.body as { sessionId: string }).sessionId;
  }

  async function upload(id: string): Promise<SourceResponse> {
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(201);
    return response.body as SourceResponse;
  }

  function count(table: 'chunks' | 'chunk_embeddings'): number {
    return (
      db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      }
    ).count;
  }

  it('genera tres temas con dos objetivos y devuelve IDs idénticos en consultas repetidas', async () => {
    const id = await createSession();
    const emptyId = await createSession();
    const source = await upload(id);
    expect(Object.keys(source).sort()).toEqual([
      'chunksCount',
      'name',
      'sourceId',
    ]);
    expect(mockClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: scrum.toString('utf8') }],
      }),
    );
    const api = request(app.getHttpServer());
    const first = await api.get(`/api/sessions/${id}/topics`).expect(200);
    const second = await api.get(`/api/sessions/${id}/topics`).expect(200);
    expect(first.body).toEqual(second.body);
    const { topics } = first.body as { topics: Topic[] };
    expect(topics).toHaveLength(3);
    const ids: string[] = [];
    for (const [index, topic] of topics.entries()) {
      expect(topic.label).toBe(generatedTopics[index].label);
      expect(topic.objectives).toHaveLength(2);
      ids.push(topic.id, ...topic.objectives.map((objective) => objective.id));
    }
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(9);
    await api
      .get(`/api/sessions/${emptyId}/topics`)
      .expect(200)
      .expect({ topics: [] });
    await api
      .get('/api/sessions/missing/topics')
      .expect(404)
      .expect({
        error: { code: 'SESSION_NOT_FOUND', message: 'La sesión no existe' },
      });
    expect(mockClaude).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['JSON inválido', 'not JSON'],
    ['Markdown', '```json\n{}\n```'],
    ['null', 'null'],
    ['sin temas', '{}'],
    ['dos temas', JSON.stringify({ topics: generatedTopics.slice(0, 2) })],
    [
      'cuatro temas',
      JSON.stringify({ topics: [...generatedTopics, generatedTopics[0]] }),
    ],
    [
      'tema vacío',
      JSON.stringify({
        topics: [
          ...generatedTopics.slice(0, 2),
          { ...generatedTopics[2], label: '  ' },
        ],
      }),
    ],
    [
      'objetivo inválido',
      JSON.stringify({
        topics: [
          ...generatedTopics.slice(0, 2),
          {
            label: 'Artefactos',
            objectives: [{ label: 'Válido' }, { label: 42 }],
          },
        ],
      }),
    ],
    [
      'un objetivo',
      JSON.stringify({
        topics: generatedTopics.map((topic) => ({
          ...topic,
          objectives: topic.objectives.slice(0, 1),
        })),
      }),
    ],
    [
      'tres objetivos',
      JSON.stringify({
        topics: generatedTopics.map((topic) => ({
          ...topic,
          objectives: [...topic.objectives, { label: 'Extra' }],
        })),
      }),
    ],
    [
      'objetivo vacío',
      JSON.stringify({
        topics: generatedTopics.map((topic) => ({
          ...topic,
          objectives: [{ label: 'Válido' }, { label: '\n' }],
        })),
      }),
    ],
  ])('rechaza %s con 502 sin guardar temas parciales', async (_name, text) => {
    const id = await createSession();
    mockClaude.mockResolvedValueOnce({
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
    });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(502)
      .expect({
        error: {
          code: 'INVALID_LLM_OUTPUT',
          message: 'No se pudieron generar temas y objetivos válidos',
        },
      });
    await request(app.getHttpServer())
      .get(`/api/sessions/${id}/topics`)
      .expect(200)
      .expect({ topics: [] });
  });

  it('conserva los temas anteriores si una nueva generación falla', async () => {
    const id = await createSession();
    await upload(id);
    const before = await request(app.getHttpServer())
      .get(`/api/sessions/${id}/topics`)
      .expect(200);
    mockClaude.mockResolvedValueOnce({ content: [], stop_reason: 'end_turn' });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(502);
    await request(app.getHttpServer())
      .get(`/api/sessions/${id}/topics`)
      .expect(200)
      .expect(before.body as { topics: Topic[] });
  });

  it('rechaza una salida truncada y distingue fallos de conexión al proveedor', async () => {
    const id = await createSession();
    mockClaude.mockResolvedValueOnce({
      content: [
        { type: 'text', text: JSON.stringify({ topics: generatedTopics }) },
      ],
      stop_reason: 'max_tokens',
    });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(502);
    mockClaude.mockRejectedValueOnce(new Error('Proveedor no disponible'));
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(503);
    expect(response.body).toMatchObject({ error: { code: 'LLM_UNAVAILABLE' } });
    await request(app.getHttpServer())
      .get(`/api/sessions/${id}/topics`)
      .expect(200)
      .expect({ topics: [] });
  });

  it('indexa scrum.md con texto, metadatos y vectores asociados a sesión/fuente', async () => {
    const id = await createSession();
    const source = await upload(id);
    const expected = chunkMarkdown(
      scrum.toString('utf8').replace(/\r\n?/g, '\n'),
      'scrum.md',
    );
    expect(source.name).toBe('scrum.md');
    expect(source.sourceId).toEqual(expect.any(String));
    expect(source.chunksCount).toBe(expected.length);
    expect(source.chunksCount).toBeGreaterThan(0);
    expect(generate).toHaveBeenCalledWith(
      expected.map((chunk) => chunk.content),
    );
    const rows = db
      .prepare(
        `SELECT id, session_id, source_id, content, heading, position, char_count
      FROM chunks ORDER BY position`,
      )
      .all();
    expect(rows).toEqual(
      expected.map((chunk) => ({
        id: `${source.sourceId}-${chunk.metadata.position}`,
        session_id: id,
        source_id: source.sourceId,
        content: chunk.content,
        heading: chunk.metadata.heading,
        position: chunk.metadata.position,
        char_count: chunk.content.length,
      })),
    );
    const vectors = db
      .prepare('SELECT session_id, source_id, embedding FROM chunk_embeddings')
      .all() as { session_id: string; source_id: string; embedding: Buffer }[];
    expect(vectors).toHaveLength(expected.length);
    for (const vector of vectors) {
      expect(vector.session_id).toBe(id);
      expect(vector.source_id).toBe(source.sourceId);
      expect(vector.embedding.length).toBe(EMBEDDING_DIMENSIONS * 4);
      expect(vector.embedding.readFloatLE(0)).toBe(0.25);
    }
    expect(
      app.get(SessionsService).getSession(id).conversation.getHistory(),
    ).toEqual([]);
  });

  it('conserva fuentes anteriores y separa documentos del mismo nombre en dos sesiones', async () => {
    const first = await createSession();
    const second = await createSession();
    const sources = [
      await upload(first),
      await upload(first),
      await upload(second),
    ];
    expect(new Set(sources.map((source) => source.sourceId)).size).toBe(3);
    expect(count('chunks')).toBe(
      sources.reduce((sum, source) => sum + source.chunksCount, 0),
    );
    expect(count('chunk_embeddings')).toBe(count('chunks'));
    for (const [index, source] of sources.entries()) {
      const rows = db
        .prepare('SELECT DISTINCT session_id FROM chunks WHERE source_id = ?')
        .all(source.sourceId);
      expect(rows).toEqual([{ session_id: index < 2 ? first : second }]);
    }
  });

  it('rechaza sesiones desconocidas antes de generar embeddings', async () => {
    await request(app.getHttpServer())
      .post('/api/sessions/missing/sources')
      .attach('file', scrum, 'scrum.md')
      .expect(404);
    expect(generate).not.toHaveBeenCalled();
    expect(count('chunks')).toBe(0);
  });

  it('rechaza archivo ausente, extensión incorrecta, contenido vacío o no UTF-8', async () => {
    const id = await createSession();
    const route = `/api/sessions/${id}/sources`;
    await request(app.getHttpServer()).post(route).expect(400);
    for (const [name, content] of [
      ['scrum.txt', scrum],
      ['empty.md', Buffer.from('   \n')],
      ['binary.md', Buffer.from([0xff, 0xfe])],
      ['nul.md', Buffer.from('text\0')],
    ] as const) {
      await request(app.getHttpServer())
        .post(route)
        .attach('file', content, name)
        .expect(400);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it('acepta solo un archivo en file, con un máximo de 1 MiB', async () => {
    const id = await createSession();
    const route = `/api/sessions/${id}/sources`;
    await request(app.getHttpServer())
      .post(route)
      .attach('other', scrum, 'scrum.md')
      .expect(400);
    await request(app.getHttpServer())
      .post(route)
      .attach('file', scrum, 'a.md')
      .attach('file', scrum, 'b.md')
      .expect(400);
    await request(app.getHttpServer())
      .post(route)
      .attach('file', Buffer.alloc(1024 * 1024 + 1, 'a'), 'large.md')
      .expect(413);
    expect(generate).not.toHaveBeenCalled();
  });

  it('no escribe fragmentos cuando falla VoyageAI y conserva las fuentes previas', async () => {
    const id = await createSession();
    const source = await upload(id);
    generate.mockRejectedValueOnce(new Error('Fallo de proveedor'));
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/sources`)
      .attach('file', scrum, 'scrum.md')
      .expect(503);
    expect(response.body).toMatchObject({
      error: { code: 'EMBEDDINGS_UNAVAILABLE' },
    });
    expect(count('chunks')).toBe(source.chunksCount);
    expect(count('chunk_embeddings')).toBe(source.chunksCount);
  });

  it('revierte toda la nueva fuente si falla una inserción intermedia', async () => {
    const id = await createSession();
    const source = await upload(id);
    const chunks = chunkMarkdown(scrum.toString('utf8'), 'scrum.md')
      .slice(0, 2)
      .map((chunk, index) => ({
        ...chunk,
        id: `rollback-${index}`,
        sessionId: id,
        sourceId: 'rollback',
      }));
    expect(chunks).toHaveLength(2);
    expect(() =>
      store.insertSource(chunks, [
        Array<number>(EMBEDDING_DIMENSIONS).fill(1),
        [1],
      ]),
    ).toThrow('El vector no tiene el formato esperado');
    expect(count('chunks')).toBe(source.chunksCount);
    expect(count('chunk_embeddings')).toBe(source.chunksCount);
  });
});
