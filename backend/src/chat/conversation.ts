export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Historial independiente, sin llamadas al LLM ni contexto académico.
export class Conversation {
  private messages: Message[] = [];

  addUserMessage(text: string): void {
    this.messages.push({ role: 'user', content: text });
  }

  addAssistantMessage(text: string): void {
    this.messages.push({ role: 'assistant', content: text });
  }

  getHistory(): Message[] {
    return this.messages.map((message) => ({ ...message }));
  }
}
