import Anthropic from '@anthropic-ai/sdk';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  TOPICS_PROMPT,
  TOPICS_OUTPUT_SCHEMA,
} from '../chat/prompts/topics.prompt';
import type { GeneratedTopic, TutorInput } from './llm.types';
import { INTERVENTION_OUTPUT_SCHEMA } from '../chat/prompts/socratic-tutor.prompt';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasLabel(
  value: unknown,
): value is Record<string, unknown> & { label: string } {
  return (
    isObject(value) &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0
  );
}

function invalidOutput(
  message = 'No se pudieron generar temas y objetivos válidos',
): BadGatewayException {
  return new BadGatewayException({
    error: {
      code: 'INVALID_LLM_OUTPUT',
      message,
    },
  });
}

@Injectable()
export class LlmService {
  async generateTopics(academicText: string): Promise<GeneratedTopic[]> {
    const text = await this.askClaude(
      academicText,
      TOPICS_PROMPT,
      TOPICS_OUTPUT_SCHEMA,
    );
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw invalidOutput();
    }
    if (
      !isObject(result) ||
      !Array.isArray(result.topics) ||
      result.topics.length !== 3
    ) {
      throw invalidOutput();
    }

    // Se valida todo antes de entregar datos a la sesión; los IDs los crea Nest.
    return result.topics.map((topic: unknown) => {
      if (
        !isObject(topic) ||
        !hasLabel(topic) ||
        !Array.isArray(topic.objectives) ||
        topic.objectives.length !== 2
      ) {
        throw invalidOutput();
      }
      return {
        label: topic.label.trim(),
        objectives: topic.objectives.map((objective: unknown) => {
          if (!hasLabel(objective)) throw invalidOutput();
          return { label: objective.label.trim() };
        }),
      };
    });
  }

  async generateTutorResponse(
    input: TutorInput,
    systemPrompt: string,
  ): Promise<unknown> {
    const errorMessage = 'No se pudo generar una intervención válida';
    const text = await this.askClaude(
      JSON.stringify(input),
      systemPrompt,
      INTERVENTION_OUTPUT_SCHEMA,
      errorMessage,
    );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw invalidOutput(errorMessage);
    }
  }
  private async askClaude(
    prompt: string,
    systemPrompt: string,
    schema: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<string> {
    let response: Anthropic.Message;
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        output_config: {
          format: { type: 'json_schema', schema },
        },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch {
      throw new ServiceUnavailableException({
        error: {
          code: 'LLM_UNAVAILABLE',
          message:
            'No se pudo consultar Anthropic. Revisa su configuración e inténtalo de nuevo.',
        },
      });
    }
    // Misma extracción de askClaude() del repo; una salida incompleta no se guarda.
    const textBlock = response.content.find((block) => block.type === 'text');
    if (
      !textBlock ||
      textBlock.type !== 'text' ||
      response.stop_reason === 'max_tokens'
    ) {
      throw invalidOutput(errorMessage);
    }
    return textBlock.text;
  }
}
