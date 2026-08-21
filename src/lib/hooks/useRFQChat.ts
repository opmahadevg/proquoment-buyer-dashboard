import { useState, useCallback } from 'react';
import { RFQState } from '@/lib/rfq/types';
import { AIStructuredResponse } from '@/lib/rfq/ai-response-validator';
import toast from 'react-hot-toast';

export function useRFQChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (
      messages: any[],
      rfqState: RFQState,
      parameters: any = {},
      retries = 2
    ): Promise<AIStructuredResponse | null> => {
      setIsLoading(true);
      setError(null);

      let currentRetry = 0;
      
      while (currentRetry <= retries) {
        try {
          const res = await fetch('/api/ai/rfq-intelligence', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages,
              rfqState,
              parameters
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${res.status}`);
          }

          const responseData = await res.json();
          setIsLoading(false);
          return responseData.data as AIStructuredResponse;
          
        } catch (err) {
          console.error(`RFQ Intelligence attempt ${currentRetry + 1} failed:`, err);
          if (currentRetry >= retries) {
            const finalError = err instanceof Error ? err : new Error('Unknown error in AI response');
            setError(finalError);
            setIsLoading(false);
            toast.error("Failed to connect to the intelligence engine. Please try again.");
            return null;
          }
          currentRetry++;
          // Optional: Add a small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
        }
      }
      
      setIsLoading(false);
      return null;
    },
    []
  );

  return { isLoading, error, sendMessage };
}
