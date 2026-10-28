import { VoyageAIClient } from 'voyageai';
import { EMBEDDING_DIMENSIONS } from './rag.types';

async function embedTexts(
  texts: string[],
  inputType: 'query' | 'document',
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.VOYAGEAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('VOYAGEAI_API_KEY está vacía. Agrégala en tu archivo .env');
  }
  const voyageClient = new VoyageAIClient({ apiKey });
  const embeddings: number[][] = [];
  // Lotes secuenciales; el SDK reintenta errores transitorios y límites de uso.
  for (let offset = 0; offset < texts.length; offset += 32) {
    const batch = texts.slice(offset, offset + 32);
    const response = await voyageClient.embed({
      model: process.env.VOYAGEAI_EMBEDDING_MODEL || 'voyage-4',
      input: batch,
      inputType,
      outputDimension: EMBEDDING_DIMENSIONS,
      outputDtype: 'float',
      truncation: false,
    });
    const data = response.data;
    if (!data || data.length !== batch.length) {
      throw new Error(
        'VoyageAI devolvió una cantidad inesperada de embeddings.',
      );
    }
    const ordered = [...data].sort((a, b) => (a.index ?? -1) - (b.index ?? -1));
    for (const [index, item] of ordered.entries()) {
      const embedding = item.embedding;
      if (
        item.index !== index ||
        !embedding ||
        embedding.length !== EMBEDDING_DIMENSIONS ||
        !embedding.every(Number.isFinite)
      ) {
        throw new Error('VoyageAI devolvió un embedding inválido.');
      }
      embeddings.push(embedding);
    }
  }
  return embeddings;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embedTexts(texts, 'document');
}
