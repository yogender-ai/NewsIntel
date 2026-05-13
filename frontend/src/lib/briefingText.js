function cleanBriefingText(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return cleanBriefingText(value.summary || value.text || value.label || value.name || '');
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function finishSentence(value) {
  const text = cleanBriefingText(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function splitSentences(value) {
  const text = cleanBriefingText(value);
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return matches.map(finishSentence).filter((item) => item.length > 8);
}

function normalizedKey(value) {
  return cleanBriefingText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function addUniqueSentence(output, candidate) {
  for (const sentence of splitSentences(candidate)) {
    const key = normalizedKey(sentence);
    if (!key) continue;
    const duplicate = output.some((existing) => {
      const existingKey = normalizedKey(existing);
      return existingKey === key || (key.length > 28 && existingKey.includes(key)) || (existingKey.length > 28 && key.includes(existingKey));
    });
    if (!duplicate) output.push(sentence);
  }
}

function contextSentences(event = {}, sources = []) {
  const category = cleanBriefingText(event.category || event.matched_preferences?.[0]?.label || 'news');
  const tier = cleanBriefingText(event.signal_tier || event.importance_level);
  const sourceCount = Number(event.source_count) || sources.length;
  const pulse = Number(event.pulse_score);
  const qualityBits = [];

  if (tier) qualityBits.push(`${tier.toLowerCase()} priority`);
  if (Number.isFinite(pulse)) qualityBits.push(`a pulse score near ${Math.round(pulse)}`);

  const first = `The system is treating this as a ${category} signal${qualityBits.length ? ` with ${qualityBits.join(' and ')}` : ''}.`;
  const second = sourceCount
    ? `It is currently backed by ${sourceCount} source${sourceCount === 1 ? '' : 's'}, so the context may change as more reporting arrives.`
    : 'It is a live update, so the context may change as more reporting arrives.';
  return [first, second];
}

export function buildExecutiveBriefing(event = {}, sources = []) {
  const output = [];
  const sourceSummary =
    sources.find((source) => cleanBriefingText(source?.text_preview))?.text_preview ||
    event.source_summary ||
    event.ai_summary ||
    '';

  [
    event.summary,
    event.text_preview,
    sourceSummary,
    event.why_it_matters,
    event.impact_line,
    event.ai_why_it_matters,
    event.ai_impact_line,
  ].forEach((item) => addUniqueSentence(output, item));

  if (output.length < 3 || output.join(' ').length < 180) {
    contextSentences(event, sources).forEach((item) => addUniqueSentence(output, item));
  }

  return output.slice(0, 3).join(' ') || 'Summary is still being prepared for this signal.';
}

export function collectBriefingPoints(values, limit = 4) {
  const output = [];
  values.flatMap((item) => (Array.isArray(item) ? item : [item])).forEach((item) => addUniqueSentence(output, item));
  return output.slice(0, limit);
}

export { cleanBriefingText };
