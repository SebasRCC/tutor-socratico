import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import type { TutorInput } from '../llm/llm.types';
import { RagService } from '../rag/rag.service';
import { SessionsService } from './sessions.service';
import { SOCRATIC_TUTOR_PROMPT } from './prompts/socratic-tutor.prompt';
import type { SelectLearningGoalDto } from './dto/select-learning-goal.dto';
import type { SubmitResponseDto } from './dto/submit-response.dto';
import type { TutorResponseDto } from './dto/session-responses.dto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidOutput(): BadGatewayException {
  return new BadGatewayException({
    error: {
      code: 'INVALID_LLM_OUTPUT',
      message: 'No se pudo generar una intervención válida',
    },
  });
}

@Injectable()
export class TutorService {
  constructor(
    private readonly sessions: SessionsService,
    private readonly rag: RagService,
    private readonly llm: LlmService,
  ) {}

  async start(
    sessionId: string,
    selection: SelectLearningGoalDto,
  ): Promise<TutorResponseDto> {
    const session = this.sessions.acquireSession(sessionId);
    try {
      const { topic, objective } = this.sessions.validateLearningGoal(
        sessionId,
        selection,
      );
      const response = await this.generate(sessionId, {
        operation: 'PRIMERA_INTERVENCION',
        topic: topic.label,
        objective: objective.label,
      });
      // Se comprueba de nuevo por si cambió el catálogo durante la generación.
      this.sessions.selectLearningGoal(sessionId, selection);
      return this.sessions.saveTurn(response);
    } finally {
      session.busy = false;
    }
  }

  async respond(
    sessionId: string,
    answer: SubmitResponseDto,
  ): Promise<TutorResponseDto> {
    const session = this.sessions.acquireSession(sessionId);
    try {
      const { turn, option } = this.sessions.validateResponse(
        sessionId,
        answer,
      );
      const selection = {
        topicId: session.topicId ?? '',
        objectiveId: session.objectiveId ?? '',
      };
      const { topic, objective } = this.sessions.validateLearningGoal(
        sessionId,
        selection,
      );
      const response = await this.generate(sessionId, {
        operation: 'PROCESAR_RESPUESTA',
        topic: topic.label,
        objective: objective.label,
        history: session.conversation.getHistory(),
        currentTurn: {
          turnId: turn.turnId,
          message: turn.message,
          options: turn.options,
        },
        selectedOption: { id: option.id, text: option.label },
      });
      // Ninguna escritura del diálogo ocurre antes de validar la salida completa.
      // El guardado del estudiante, asistente y turno es síncrono, sin await intermedios.
      this.sessions.validateLearningGoal(sessionId, selection);
      this.sessions.registerResponse(sessionId, answer);
      return this.sessions.saveTurn(response);
    } finally {
      session.busy = false;
    }
  }

  private async generate(
    sessionId: string,
    input: Omit<TutorInput, 'fragments'>,
  ): Promise<TutorResponseDto> {
    const query = [
      input.topic,
      input.objective,
      input.currentTurn?.message,
      input.selectedOption?.text,
    ]
      .filter((part) => part !== undefined)
      .join('\n');
    const chunks = await this.rag.retrieveContext(sessionId, query);
    const raw = await this.llm.generateTutorResponse(
      {
        ...input,
        fragments: chunks.map(
          (chunk) => `${chunk.metadata.heading}\n${chunk.content}`,
        ),
      },
      SOCRATIC_TUTOR_PROMPT,
    );
    const generated = this.validateOutput(raw, input.operation);
    return {
      sessionId,
      feedback: generated.feedback,
      turn: {
        turnId: randomUUID(),
        message: generated.message,
        options: generated.options.map((option) => ({
          id: randomUUID(),
          label: option.label,
        })),
        sources: chunks.map((chunk) => ({
          sourceId: chunk.sourceId,
          name: chunk.metadata.source,
          chunkId: chunk.id,
        })),
      },
    };
  }

  private validateOutput(raw: unknown, operation: TutorInput['operation']) {
    if (!isObject(raw)) throw invalidOutput();
    if ('error' in raw) {
      if (
        Object.keys(raw).length === 1 &&
        isObject(raw.error) &&
        raw.error.code === 'INSUFFICIENT_CONTEXT' &&
        isText(raw.error.message)
      ) {
        throw new UnprocessableEntityException({
          error: {
            code: 'INSUFFICIENT_CONTEXT',
            message:
              'El material disponible no permite generar una intervención fundamentada.',
          },
        });
      }
      throw invalidOutput();
    }
    if (
      (operation === 'PRIMERA_INTERVENCION'
        ? raw.feedback !== null
        : !isText(raw.feedback)) ||
      !isObject(raw.turn) ||
      !isText(raw.turn.message) ||
      !Array.isArray(raw.turn.options) ||
      raw.turn.options.length !== 3
    ) {
      throw invalidOutput();
    }
    return {
      feedback:
        operation === 'PRIMERA_INTERVENCION'
          ? null
          : (raw.feedback as string).trim(),
      message: raw.turn.message.trim(),
      options: raw.turn.options.map((option: unknown) => {
        if (!isObject(option) || !isText(option.label)) throw invalidOutput();
        return { label: option.label.trim() };
      }),
    };
  }
}
