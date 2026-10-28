import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Conversation } from './conversation';
import type { SelectLearningGoalDto } from './dto/select-learning-goal.dto';
import type { TutorResponseDto } from './dto/session-responses.dto';
import type { SubmitResponseDto } from './dto/submit-response.dto';
import type { Session, Topic } from './session.types';
import type { GeneratedTopic } from '../llm/llm.types';

@Injectable()
export class SessionsService {
  // Estado temporal: se pierde al reiniciar el servidor.
  private readonly sessions = new Map<string, Session>();

  createSession(): Session {
    const session: Session = {
      sessionId: randomUUID(),
      conversation: new Conversation(),
      topics: [],
      topicId: null,
      objectiveId: null,
      currentTurn: null,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException({
        error: { code: 'SESSION_NOT_FOUND', message: 'La sesión no existe' },
      });
    }
    return session;
  }

  saveTopics(sessionId: string, topics: GeneratedTopic[]): void {
    const session = this.getSession(sessionId);
    // Cada carga exitosa sustituye el catálogo completo, nunca parcialmente.
    session.topics = topics.map((topic) => ({
      id: randomUUID(),
      label: topic.label,
      objectives: topic.objectives.map((objective) => ({
        id: randomUUID(),
        label: objective.label,
      })),
    }));
  }

  getTopics(sessionId: string): Topic[] {
    return this.getSession(sessionId).topics;
  }

  selectLearningGoal(sessionId: string, dto: SelectLearningGoalDto): void {
    const session = this.getSession(sessionId);
    session.topicId = dto.topicId;
    session.objectiveId = dto.objectiveId;
  }

  saveTurn(response: TutorResponseDto): TutorResponseDto {
    const session = this.getSession(response.sessionId);
    // JSON conserva feedback, pregunta y opciones en el contenido del mensaje.
    session.conversation.addAssistantMessage(
      JSON.stringify({ feedback: response.feedback, turn: response.turn }),
    );
    session.currentTurn = response.turn;
    return response;
  }

  getCurrentTurn(sessionId: string): TutorResponseDto['turn'] {
    const turn = this.getSession(sessionId).currentTurn;
    if (!turn) {
      throw new NotFoundException({
        error: {
          code: 'TURN_NOT_FOUND',
          message: 'No hay una intervención actual',
        },
      });
    }
    return turn;
  }

  registerResponse(sessionId: string, dto: SubmitResponseDto): void {
    const session = this.getSession(sessionId);
    const turn = session.currentTurn;
    if (!turn || turn.turnId !== dto.turnId) {
      throw new ConflictException({
        error: {
          code: 'TURN_NOT_CURRENT',
          message: 'La intervención ya fue respondida o no es la actual',
        },
      });
    }
    const option = turn.options.find((item) => item.id === dto.optionId);
    if (!option) {
      throw new BadRequestException({
        error: {
          code: 'OPTION_NOT_FOUND',
          message: 'La opción no existe en este turno',
        },
      });
    }
    session.conversation.addUserMessage(
      JSON.stringify({
        turnId: turn.turnId,
        optionId: option.id,
        text: option.label,
      }),
    );
    // El turno queda consumido antes de guardar la siguiente intervención.
    session.currentTurn = null;
  }
}
