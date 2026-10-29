import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/chat/sessions.service';
import { VectorStore } from '../src/rag/vector-store';
import type { TutorResponseDto } from '../src/chat/dto/session-responses.dto';
import { LlmService } from '../src/llm/llm.service';
import * as embeddings from '../src/rag/embeddings';
import { EMBEDDING_DIMENSIONS } from '../src/rag/rag.types';

describe('Sesiones e historial (e2e)', () => {
  let app: INestApplication<App>;
  let sessions: SessionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VectorStore)
      .useFactory({ factory: () => new VectorStore(':memory:') })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    sessions = app.get(SessionsService);
    jest
      .spyOn(embeddings, 'generateEmbedding')
      .mockResolvedValue(Array<number>(EMBEDDING_DIMENSIONS).fill(0.25));
    jest
      .spyOn(app.get(LlmService), 'generateTutorResponse')
      .mockImplementation((input) =>
        Promise.resolve({
          feedback:
            input.operation === 'PRIMERA_INTERVENCION'
              ? null
              : 'El Product Owner responde por ordenar el Product Backlog.',
          turn: {
            message:
              'Un equipo recibe varias solicitudes. ¿Quién ordena el Product Backlog?',
            options: [
              { label: 'Product Owner' },
              { label: 'Scrum Master' },
              { label: 'Developers' },
            ],
          },
        }),
      );
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  async function createSession(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/sessions')
      .expect(201);
    return (response.body as { sessionId: string }).sessionId;
  }

  async function selectGoal(id: string): Promise<TutorResponseDto> {
    sessions.saveTopics(id, [
      { label: 'Scrum', objectives: [{ label: 'Roles' }] },
    ]);
    const topic = sessions.getTopics(id)[0];
    app.get(VectorStore).insert(
      {
        id: `${id}-chunk`,
        sessionId: id,
        sourceId: `${id}-source`,
        content: 'El Product Owner ordena el Product Backlog.',
        metadata: {
          source: 'scrum.md',
          heading: 'Roles',
          position: 0,
          charCount: 47,
        },
      },
      Array<number>(EMBEDDING_DIMENSIONS).fill(0.25),
    );
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/learning-goal`)
      .send({ topicId: topic.id, objectiveId: topic.objectives[0].id })
      .expect(200);
    return response.body as TutorResponseDto;
  }

  it('crea sesiones vacías con historiales independientes', async () => {
    const first = await createSession();
    const second = await createSession();
    expect(first).not.toBe(second);
    expect(sessions.getSession(first)).toMatchObject({
      topicId: null,
      objectiveId: null,
      currentTurn: null,
    });
    expect(sessions.getSession(first).conversation.getHistory()).toEqual([]);
    const turn = await selectGoal(first);
    await request(app.getHttpServer())
      .post(`/api/sessions/${first}/responses`)
      .send({ turnId: turn.turn.turnId, optionId: turn.turn.options[0].id })
      .expect(200);
    expect(sessions.getSession(first)).toMatchObject({
      topicId: sessions.getTopics(first)[0].id,
      objectiveId: sessions.getTopics(first)[0].objectives[0].id,
    });
    expect(sessions.getSession(first).conversation.getHistory()).toHaveLength(
      3,
    );
    expect(sessions.getSession(second).conversation.getHistory()).toEqual([]);
    expect(sessions.getSession(second).currentTurn).toBeNull();
    await selectGoal(second);
    expect(sessions.getSession(second).conversation.getHistory()).toHaveLength(
      1,
    );
    expect(sessions.getSession(first).conversation.getHistory()).toHaveLength(
      3,
    );
  });

  it('registra ID, texto y feedback; rechaza responder dos veces el mismo turno', async () => {
    const id = await createSession();
    const first = await selectGoal(id);
    const answer = {
      turnId: first.turn.turnId,
      optionId: first.turn.options[0].id,
    };
    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send(answer)
      .expect(200);
    const next = response.body as TutorResponseDto;
    expect(next.turn.turnId).not.toBe(first.turn.turnId);
    const history = sessions.getSession(id).conversation.getHistory();
    expect(history.map((message) => message.role)).toEqual([
      'assistant',
      'user',
      'assistant',
    ]);
    expect(JSON.parse(history[0].content)).toEqual({
      feedback: null,
      turn: first.turn,
    });
    expect(JSON.parse(history[1].content)).toEqual({
      ...answer,
      text: 'Product Owner',
    });
    expect(JSON.parse(history[2].content)).toEqual({
      feedback: next.feedback,
      turn: next.turn,
    });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send(answer)
      .expect(409)
      .expect({
        error: {
          code: 'TURN_NOT_CURRENT',
          message: 'La intervención ya fue respondida o no es la actual',
        },
      });
    expect(sessions.getSession(id).conversation.getHistory()).toEqual(history);
    expect(sessions.getCurrentTurn(id)).toEqual(next.turn);
  });

  it('recupera el turno guardado sin añadir mensajes', async () => {
    const id = await createSession();
    const first = await selectGoal(id);
    const history = sessions.getSession(id).conversation.getHistory();
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .get(`/api/sessions/${id}/current-turn`)
        .expect(200)
        .expect({ sessionId: id, turn: first.turn });
    }
    expect(sessions.getSession(id).conversation.getHistory()).toEqual(history);
  });

  it('devuelve TURN_NOT_FOUND antes de seleccionar el objetivo', async () => {
    const id = await createSession();
    await request(app.getHttpServer())
      .get(`/api/sessions/${id}/current-turn`)
      .expect(404)
      .expect({
        error: {
          code: 'TURN_NOT_FOUND',
          message: 'No hay una intervención actual',
        },
      });
    await request(app.getHttpServer())
      .post(`/api/sessions/${id}/responses`)
      .send({ turnId: 'missing', optionId: 'opt_1' })
      .expect(409);
    expect(sessions.getSession(id).conversation.getHistory()).toEqual([]);
  });

  it('rechaza opciones inválidas y turnos de otra sesión sin modificar el estado', async () => {
    const firstId = await createSession();
    const secondId = await createSession();
    const first = await selectGoal(firstId);
    const second = await selectGoal(secondId);
    const history = sessions.getSession(firstId).conversation.getHistory();
    await request(app.getHttpServer())
      .post(`/api/sessions/${firstId}/responses`)
      .send({ turnId: first.turn.turnId, optionId: 'invalid' })
      .expect(400)
      .expect({
        error: {
          code: 'OPTION_NOT_FOUND',
          message: 'La opción no existe en este turno',
        },
      });
    await request(app.getHttpServer())
      .post(`/api/sessions/${firstId}/responses`)
      .send({ turnId: second.turn.turnId, optionId: 'opt_1' })
      .expect(409);
    expect(sessions.getSession(firstId).conversation.getHistory()).toEqual(
      history,
    );
    expect(sessions.getCurrentTurn(firstId)).toEqual(first.turn);
  });

  it('devuelve 404 para sesiones inexistentes', async () => {
    const api = request(app.getHttpServer());
    const responses = [
      await api
        .post('/api/sessions/missing/learning-goal')
        .send({ topicId: 'scrum', objectiveId: 'roles' })
        .expect(404),
      await api
        .post('/api/sessions/missing/responses')
        .send({ turnId: 'turn', optionId: 'opt_1' })
        .expect(404),
      await api.get('/api/sessions/missing/current-turn').expect(404),
    ];
    for (const response of responses) {
      expect(response.body).toMatchObject({
        error: { code: 'SESSION_NOT_FOUND' },
      });
    }
  });
});
