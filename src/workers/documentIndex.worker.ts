/// <reference lib="webworker" />

export interface WorkerIndexRequest {
  type: 'INDEX_DOCUMENTS';
  documents: {
    id: string;
    name: string;
    extractedText: string;
    sectionCount: number;
  }[];
}

export interface WorkerIndexResponse {
  type: 'INDEX_COMPLETE';
  totalTokens: number;
  indexedDocCount: number;
  durationMs: number;
}

self.onmessage = (event: MessageEvent<WorkerIndexRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'INDEX_DOCUMENTS') return;

  const start = performance.now();
  let totalTokens = 0;

  for (const doc of data.documents) {
    const words = doc.extractedText
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    totalTokens += words.length;
  }

  const response: WorkerIndexResponse = {
    type: 'INDEX_COMPLETE',
    totalTokens,
    indexedDocCount: data.documents.length,
    durationMs: Math.max(1, Math.round(performance.now() - start)),
  };

  self.postMessage(response);
};
