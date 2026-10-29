import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/chat/sessions.service';
import { VectorStore } from '../src/rag/vector-store';
import * as embeddings from '../src/rag/embeddings';
import { EMBEDDING_DIMENSIONS } from '../src/rag/rag.types';
import type { TutorInput } from '../src/llm/llm.types';
import type { TutorResponseDto } from '../src/chat/dto/session-responses.dto';
import { SOCRATIC_TUTOR_PROMPT } from '../src/chat/prompts/socratic-tutor.prompt';

interface ClaudeRequest {
  system: string;
  messages: { role: string; content: string }[];
}
const mockClaude = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({ messages: { create: mockClaude } })),
}));
const turn = {
  message:
    'Un equipo recibe nuevas solicitudes. ¿Quién ordena el Product Backlog?',
  options: [
    { label: 'Product Owner' },
    { label: 'Scrum Master' },
    { label: 'Developers' },
  ],
};
const result = (feedback: string | null) => ({ feedback, turn });
const claudeOutput = (value: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  stop_reason: 'end_turn',
});

// SQLite, RAG, coordinación y validación reales; solo los proveedores se simulan.
describe('Tutoría y respuestas (e2e)', () => {
  let app: INestApplication<App>;
  let sessions: SessionsService;
  let store: VectorStore;

  beforeEach(async () => {
    mockClaude.mockReset().mockImplementation((req: ClaudeRequest) => {
      const input = JSON.parse(req.messages[0].content) as TutorInput;
      return Promise.resolve(
        claudeOutput(
          result(
            input.operation === 'PRIMERA_INTERVENCION'
              ? null
              : 'El Product Owner responde por el valor.',
          ),
        ),
      );
    });
    jest
      .spyOn(embeddings, 'generateEmbedding')
      .mockResolvedValue(Array<number>(EMBEDDING_DIMENSIONS).fill(0.25));
    store = new VectorStore(':memory:');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VectorStore)
      .useValue(store)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0, '127.0.0.1');
    sessions = app.get(SessionsService);
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  async function prepare() {
    const created = await request(app.getHttpServer())
      .post('/api/sessions')
      .expect(201);
    const id = (created.body as { sessionId: string }).sessionId;
    sessions.saveTopics(id, [
      { label: 'Scrum', objectives: [{ label: 'Distinguir roles' }] },
    ]);
    store.insert(
      {
        id: `${id}-chunk`,
        sessionId: id,
        sourceId: `${id}-source`,
        content: 'El Product Owner ordena el Product Backlog.',
        metadata: {
          source: 'scrum.md',
          heading: 'Roles',
          position: 0,
          charCount: 45,
        },
      },
      Array<number>(EMBEDDING_DIMENSIONS).fill(0.25),
    );
    const topic = sessions.getTopics(id)[0];
    const selection = {
      topicId: topic.id,
      objectiveId: topic.objectives[0].id,
    };
    return { id, selection };
  }

  async function begin() {
    const prepared = await prepare();
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${prepared.id}/learning-goal`)
      .send(prepared.selection)
      .expect(200);
    const first = response.body as TutorResponseDto;
    return {
      ...prepared,
      first,
      answer: { turnId: first.turn.turnId, optionId: first.turn.options[0].id },
    };
  }

  function snapshot(id: string) {
    const session = sessions.getSession(id);
    return {
      topicId: session.topicId,
      objectiveId: session.objectiveId,
      turn: session.currentTurn,
      history: session.conversation.getHistory(),
      busy: session.busy,
    };
  }

  it('envía operación, historial y elección; guarda estudiante/asistente y usa el mismo system prompt', async () => {
    const { id, first, answer } = await begin();
    const history = sessions.getSession(id).conversation.getHistory();
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send(answer)
      .expect(200);
    const next = response.body as TutorResponseDto;
    expect(first.feedback).toBeNull();
    expect(next.feedback).toBe('El Product Owner responde por el valor.');
    expect(next.turn.turnId).not.toBe(first.turn.turnId);
    expect(next.turn.options).toHaveLength(3);
    expect(next.turn.sources).toEqual([
      { sourceId: `${id}-source`, name: 'scrum.md', chunkId: `${id}-chunk` },
    ]);
    const requests = mockClaude.mock.calls.map(([req]: [ClaudeRequest]) => req);
    expect(requests.map((req) => req.system)).toEqual([
      SOCRATIC_TUTOR_PROMPT,
      SOCRATIC_TUTOR_PROMPT,
    ]);
    const input = JSON.parse(requests[1].messages[0].content) as TutorInput;
    expect(input).toMatchObject({
      operation: 'PROCESAR_RESPUESTA',
      topic: 'Scrum',
      objective: 'Distinguir roles',
      history,
      selectedOption: {
        id: answer.optionId,
        text: first.turn.options[0].label,
      },
      currentTurn: {
        turnId: first.turn.turnId,
        message: first.turn.message,
        options: first.turn.options,
      },
    });
    expect(input.fragments).toEqual([
      'Roles\nEl Product Owner ordena el Product Backlog.',
    ]);
    expect(embeddings.generateEmbedding).toHaveBeenLastCalledWith(
      `Scrum\nDistinguir roles\n${first.turn.message}\n${first.turn.options[0].label}`,
    );
    const saved = sessions.getSession(id).conversation.getHistory();
    expect(saved).toHaveLength(3);
    expect(JSON.parse(saved[1].content)).toEqual({
      ...answer,
      text: first.turn.options[0].label,
    });
    expect(JSON.parse(saved[2].content)).toEqual({
      feedback: next.feedback,
      turn: next.turn,
    });
    expect(sessions.getSession(id).busy).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/sessions/${id}/current-turn`)
      .expect(200)
      .expect({ sessionId: id, turn: next.turn });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send(answer)
      .expect(409);
    expect(sessions.getSession(id).conversation.getHistory()).toEqual(saved);
  });

  it('bloquea respuestas simultáneas y cambio de objetivo, pero permite leer y usar otra sesión', async () => {
    const { id, first, answer, selection } = await begin();
    const other = await begin();
    const before = snapshot(id);
    let release!: (value: ReturnType<typeof claudeOutput>) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    mockClaude.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
          entered();
        }),
    );
    const pending = request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send(answer)
      .then((res) => res);
    await started;
    try {
      expect(snapshot(id)).toEqual({ ...before, busy: true });
      for (const [route, body] of [
        ['responses', answer],
        ['learning-goal', selection],
      ] as const) {
        const blocked = await request(app.getHttpServer())
          .post(`/api/sessions/${id}/${route}`)
          .send(body)
          .expect(409);
        expect(blocked.body).toMatchObject({ error: { code: 'SESSION_BUSY' } });
      }
      expect(sessions.getSession(id).busy).toBe(true);
      await request(app.getHttpServer())
        .get(`/api/sessions/${id}/current-turn`)
        .expect(200)
        .expect({ sessionId: id, turn: first.turn });
      await request(app.getHttpServer())
        .post(`/api/sessions/${other.id}/responses`)
        .send(other.answer)
        .expect(200);
    } finally {
      release(claudeOutput(result('Retroalimentación válida.')));
    }
    expect((await pending).status).toBe(200);
    expect(sessions.getSession(id).busy).toBe(false);
    expect(sessions.getSession(id).conversation.getHistory()).toHaveLength(3);
  });

  const invalidOutputs: [string, unknown][] = [
    ['null', null],
    ['sin turn', { feedback: 'Texto' }],
    ['mensaje vacío', { feedback: 'Texto', turn: { ...turn, message: '  ' } }],
    [
      'dos opciones',
      {
        feedback: 'Texto',
        turn: { ...turn, options: turn.options.slice(0, 2) },
      },
    ],
    [
      'cuatro opciones',
      {
        feedback: 'Texto',
        turn: { ...turn, options: [...turn.options, { label: 'Extra' }] },
      },
    ],
    [
      'label vacío',
      {
        feedback: 'Texto',
        turn: {
          ...turn,
          options: [{ label: 'A' }, { label: 'B' }, { label: ' ' }],
        },
      },
    ],
    [
      'label numérico',
      {
        feedback: 'Texto',
        turn: {
          ...turn,
          options: [{ label: 'A' }, { label: 'B' }, { label: 5 }],
        },
      },
    ],
    ['feedback null', result(null)],
    ['feedback vacío', result('  ')],
    ['feedback numérico', { ...result(null), feedback: 5 }],
    ['error desconocido', { error: { code: 'OTHER', message: 'error' } }],
  ];
  it.each(invalidOutputs)(
    'rechaza %s y permite reintentar el mismo turno sin duplicar mensajes',
    async (_name, output) => {
      const { id, answer } = await begin();
      const before = snapshot(id);
      mockClaude.mockResolvedValueOnce(claudeOutput(output));
      const failure = await request(app.getHttpServer())
        .post(`/api/sessions/${id}/responses`)
        .send(answer)
        .expect(502);
      expect(failure.body).toMatchObject({
        error: { code: 'INVALID_LLM_OUTPUT' },
      });
      expect(snapshot(id)).toEqual(before);
      await request(app.getHttpServer())
        .post(`/api/sessions/${id}/responses`)
        .send(answer)
        .expect(200);
      expect(sessions.getSession(id).conversation.getHistory()).toHaveLength(3);
    },
  );

  it.each(['PRIMERA_INTERVENCION', 'PROCESAR_RESPUESTA'] as const)(
    'conserva el estado ante contexto insuficiente del modelo en %s',
    async (operation) => {
      const prepared = await begin();
      const before = snapshot(prepared.id);
      mockClaude.mockResolvedValueOnce(
        claudeOutput({
          error: {
            code: 'INSUFFICIENT_CONTEXT',
            message: 'No hay respaldo suficiente.',
          },
        }),
      );
      const route =
        operation === 'PRIMERA_INTERVENCION' ? 'learning-goal' : 'responses';
      const body =
        operation === 'PRIMERA_INTERVENCION'
          ? prepared.selection
          : prepared.answer;
      const response = await request(app.getHttpServer())
        .post(`/api/sessions/${prepared.id}/${route}`)
        .send(body)
        .expect(422);
      expect(response.body).toMatchObject({
        error: { code: 'INSUFFICIENT_CONTEXT' },
      });
      expect(snapshot(prepared.id)).toEqual(before);
    },
  );

  it('exige feedback null en primera intervención, incluso al cambiar la selección', async () => {
    const { id, selection } = await begin();
    const before = snapshot(id);
    mockClaude.mockResolvedValueOnce(
      claudeOutput(result('No permitido en primera intervención.')),
    );
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/learning-goal`)
      .send(selection)
      .expect(502);
    expect(snapshot(id)).toEqual(before);
  });

  it.each(['json', 'truncado', 'proveedor', 'embeddings', 'rag'] as const)(
    'conserva estado y libera bloqueo cuando falla %s',
    async (failure) => {
      const { id, answer } = await begin();
      const before = snapshot(id);
      let status = 502;
      if (failure === 'json')
        mockClaude.mockResolvedValueOnce({
          content: [{ type: 'text', text: '```json {} ```' }],
          stop_reason: 'end_turn',
        });
      if (failure === 'truncado')
        mockClaude.mockResolvedValueOnce({
          ...claudeOutput(result('Texto')),
          stop_reason: 'max_tokens',
        });
      if (failure === 'proveedor') {
        mockClaude.mockRejectedValueOnce(new Error('Provider failed'));
        status = 503;
      }
      if (failure === 'embeddings') {
        jest
          .mocked(embeddings.generateEmbedding)
          .mockRejectedValueOnce(new Error('Embedding failed'));
        status = 503;
      }
      if (failure === 'rag') {
        jest
          .mocked(embeddings.generateEmbedding)
          .mockResolvedValueOnce(
            Array<number>(EMBEDDING_DIMENSIONS).fill(-0.25),
          );
        status = 422;
      }
      await request(app.getHttpServer())
        .post(`/api/sessions/${id}/responses`)
        .send(answer)
        .expect(status);
      expect(snapshot(id)).toEqual(before);
      await request(app.getHttpServer())
        .post(`/api/sessions/${id}/responses`)
        .send(answer)
        .expect(200);
      expect(sessions.getSession(id).conversation.getHistory()).toHaveLength(3);
    },
  );
});
