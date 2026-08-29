/* Plain-language definitions for the product's invented vocabulary.
   The previous UI showed "World Pulse 72" with no way to find out what that meant,
   which is the single biggest reason the dashboard read as noise. */
export const GLOSSARY = {
  pulse: {
    term: 'Pulse',
    short: 'How loud the news is right now, 0–100.',
    long: 'A weighted average of the importance scores of today’s top five stories. Higher means more high-impact news is breaking at once. It measures volume and severity of news — not whether the news is good or bad.',
  },
  exposure: {
    term: 'Exposure',
    short: 'How widely a story reaches beyond its own field.',
    long: 'Estimates how far a story’s effects spread into other sectors and regions. A local factory fire scores low; a shipping-lane closure scores high because it touches many industries at once.',
  },
  tier: {
    term: 'Signal tier',
    short: 'How urgently a story deserves attention.',
    long: 'CRITICAL means act today. SIGNAL means it changes something you plan around. WATCH means keep an eye on it. Tiers come from the importance score the model assigns, combined with how much the story has moved since yesterday.',
  },
  orbit: {
    term: 'Connections',
    short: 'A map of which stories are linked.',
    long: 'Stories are linked when they share companies, people, places or causes. Grouping them shows a developing situation — several stories that are really one event — instead of unrelated headlines.',
  },
  neurons: {
    term: 'Neurons',
    short: 'Cloudflare’s unit of AI compute cost.',
    long: 'Every model call costs a fraction of a neuron. Shown so the cost of each answer and each pipeline run is visible rather than hidden.',
  },
  rerank: {
    term: 'Rerank score',
    short: 'How well a passage answers your exact question.',
    long: 'A cross-encoder reads your question and the passage together and scores the match. It is far more accurate than the initial search, but too slow to run over the whole archive — so it only re-scores the top candidates.',
  },
  rrf: {
    term: 'Fusion',
    short: 'Combining two different searches into one ranking.',
    long: 'Meaning-based search and keyword search each find things the other misses. Reciprocal-rank fusion merges their two rankings without needing their scores to be comparable.',
  },
};
