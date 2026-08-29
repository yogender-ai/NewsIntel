/* Topic ids here must match the categories the backend ingests
   (backend/app/pipeline/fetch/sources.py ALL_CATEGORIES) — otherwise a reader can
   pick a topic that no feed supplies, which is exactly what the old onboarding did. */
export const TOPICS = [
  { id: 'politics', label: 'World & Politics', blurb: 'Governments, conflict, diplomacy' },
  { id: 'markets', label: 'Markets & Finance', blurb: 'Companies, rates, earnings' },
  { id: 'tech', label: 'Technology', blurb: 'Products, platforms, chips' },
  { id: 'ai', label: 'AI & Research', blurb: 'Models, labs, capability' },
  { id: 'climate', label: 'Climate & Energy', blurb: 'Emissions, power, weather risk' },
  { id: 'healthcare', label: 'Health & Pharma', blurb: 'Trials, approvals, public health' },
  { id: 'defense', label: 'Defense & Security', blurb: 'Military, cyber, procurement' },
  { id: 'crypto', label: 'Crypto & Web3', blurb: 'Tokens, regulation, exchanges' },
  { id: 'space', label: 'Space', blurb: 'Launches, satellites, exploration' },
  { id: 'trade', label: 'Supply Chain & Trade', blurb: 'Shipping, tariffs, logistics' },
  { id: 'auto', label: 'Automotive & EVs', blurb: 'Manufacturers, batteries, charging' },
  { id: 'telecom', label: 'Telecom', blurb: 'Networks, spectrum, connectivity' },
  { id: 'media', label: 'Media', blurb: 'Studios, streaming, publishing' },
  { id: 'entertainment', label: 'Culture & Arts', blurb: 'Film, music, the arts' },
  { id: 'education', label: 'Education', blurb: 'Schools, universities, policy' },
  { id: 'legal', label: 'Law & Regulation', blurb: 'Courts, rulings, compliance' },
];

export const REGIONS = [
  { id: 'global', label: 'Everywhere' },
  { id: 'us', label: 'United States' },
  { id: 'europe', label: 'Europe' },
  { id: 'uk', label: 'United Kingdom' },
  { id: 'india', label: 'India' },
  { id: 'china', label: 'China' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'africa', label: 'Africa' },
  { id: 'latam', label: 'Latin America' },
  { id: 'japan-korea', label: 'Japan & Korea' },
  { id: 'southeast-asia', label: 'Southeast Asia' },
];

export const SENIORITY = ['Student', 'Junior', 'Mid-level', 'Senior', 'Lead / Manager', 'Executive / Founder'];

export const topicLabel = (id) => TOPICS.find((t) => t.id === id)?.label ?? id;
export const regionLabel = (id) => REGIONS.find((r) => r.id === id)?.label ?? id;
