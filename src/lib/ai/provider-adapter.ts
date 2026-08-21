export interface OpenRouterContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'high' | 'low';
  };
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContentPart[];
}

/**
 * Transforms provider-agnostic ChatMessage/history format into OpenRouter Multimodal format.
 * Decouples frontend chat structure from external provider payload requirements.
 */
export function formatMessagesForProvider(
  systemPromptContent: string,
  messages: any[]
): OpenRouterMessage[] {
  const formatted: OpenRouterMessage[] = [
    { role: 'system', content: systemPromptContent },
  ];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';

    // Handle user messages with images
    if (role === 'user' && msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : (msg.text || 'Please analyze these attached reference images.');

      const parts: OpenRouterContentPart[] = [
        { type: 'text', text: textContent },
      ];

      for (const img of msg.images) {
        const imageUrl = typeof img === 'string' ? img : (img.url || img.thumbnail);
        if (imageUrl) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'auto',
            },
          });
        }
      }

      formatted.push({ role: 'user', content: parts });
    } else {
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : (msg.text || '');

      formatted.push({
        role,
        content: textContent,
      });
    }
  }

  return formatted;
}
