import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { TextDecoder } from 'node:util';
import { chunkMarkdown } from './chunker';
import { generateEmbeddings } from './embeddings';
import { VectorStore } from './vector-store';

@Injectable()
export class RagService {
  constructor(private readonly vectorStore: VectorStore) {}

  async indexSource(sessionId: string, file: Express.Multer.File | undefined) {
    if (!file || extname(file.originalname).toLowerCase() !== '.md') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_SOURCE_FILE',
          message: 'Envía un único archivo .md en el campo file',
        },
      });
    }
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException({
        error: {
          code: 'INVALID_SOURCE_ENCODING',
          message: 'El archivo debe contener texto UTF-8',
        },
      });
    }
    if (!content.trim() || content.includes('\0')) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_SOURCE_CONTENT',
          message: 'El archivo debe contener texto Markdown no vacío',
        },
      });
    }
    const sourceId = randomUUID();
    const chunks = chunkMarkdown(
      content.replace(/\r\n?/g, '\n'),
      file.originalname,
    ).map((chunk) => ({
      ...chunk,
      id: `${sourceId}-${chunk.metadata.position}`,
      sessionId,
      sourceId,
    }));
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(
        chunks.map((chunk) => chunk.content),
      );
    } catch {
      throw new ServiceUnavailableException({
        error: {
          code: 'EMBEDDINGS_UNAVAILABLE',
          message:
            'No se pudieron generar embeddings. Revisa la configuración de VoyageAI e inténtalo de nuevo.',
        },
      });
    }
    this.vectorStore.insertSource(chunks, embeddings);
    return {
      sourceId,
      name: file.originalname,
      chunksCount: chunks.length,
      academicText: content,
    };
  }
}
