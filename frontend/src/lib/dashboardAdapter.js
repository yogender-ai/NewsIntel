const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

const compactLabel = (value) => String(value || '').replace(/-/g, ' ').trim();

const trendFromPulseHistory = (pulseHistory) => {
  const source = pulseHistory?.history || pulseHistory || {};
  const series = Array.isArray(source)
    ? source
    : Object.values(source).flatMap((points) => Array.isArray(points) ? points : []);
  if (series.length && series[0].createdAt) return series;
  if (series.length && series[0].created_at && series[0].value !== undefined) {
    return series.map((point) => ({ createdAt: point.created_at, value: Math.round(Number(point.value) || 0) }));
  }
  const byTime = new Map();
  series.forEach((point) => {
    const key = point?.created_at;
    const score = Number(point?.pulse_score);
    if (!key || !Number.isFinite(score)) return;
    const bucket = byTime.get(key) || [];
    bucket.push(score);
    byTime.set(key, bucket);
  });
  return [...byTime.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-24)
    .map(([createdAt, values]) => ({
      createdAt,
      value: Math.round(values.reduce((sum, item) => sum + item, 0) / values.length),
    }));
};

const normalizeAiStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (status === 'enriched' || status === 'pending' || status === 'failed') return status;
  return 'rules_only';
};

const normalizeShift = (cluster, index) => {
  const aiStatus = normalizeAiStatus(cluster.ai_status);
  const aiAvailable = aiStatus === 'enriched';
  return {
    id: cluster.signal_id || cluster.thread_id || cluster.id || `shift-${index}`,
    rank: index + 1,
    category: cluster.matched_preferences?.[0]?.label || compactLabel(cluster.matched_preferences?.[0]?.id) || compactLabel(cluster.category),
    headline: cluster.thread_title || cluster.title || '',
    summary: cluster.summary || '',
    impactLine: cluster.impact_line || '',
    whyItMatters: cluster.why_it_matters || '',
    sentiment: cluster.sentiment || '',
    entities: Array.isArray(cluster.entities) ? cluster.entities : [],
    riskLevel: cluster.risk_level || '',
    opportunityLevel: cluster.opportunity_level || '',
    storyGraph: cluster.story_graph || null,
    confidenceExplanation: cluster.confidence_explanation || '',
    uncertainty: cluster.uncertainty || '',
    aiStatus,
    aiProvider: cluster.ai_provider_used || '',
    aiEnrichedAt: cluster.ai_enriched_at || '',
    pulseBreakdown: cluster.pulse_breakdown && typeof cluster.pulse_breakdown === 'object' ? cluster.pulse_breakdown : null,
    impactLevel: cluster.signal_tier || null,
    updatedAt: cluster.updated_at || cluster.last_seen_at || null,
    imageUrl: cluster.image_url || cluster.thumbnail_url || null,
    sources: cluster.sources || [],
    sourceCount: cluster.source_count,
    pulse: Number.isFinite(Number(cluster.pulse_score)) ? Number(cluster.pulse_score) : null,
    exposure: Number.isFinite(Number(cluster.exposure_score || cluster.relevance_score)) ? Number(cluster.exposure_score || cluster.relevance_score) : null,
    articles: Array.isArray(cluster.article_ids) ? cluster.article_ids : [],
    raw: cluster,
  };
};

export function normalizeDashboardData({ dashboard, preferences, alerts, user }) {
  const clusters = Array.isArray(dashboard?.clusters) ? dashboard.clusters : [];
  const activeSignals = clusters.filter((cluster) => !cluster.dismissed);
  const sortedSignals = [...activeSignals].sort((a, b) => {
    const tierWeight = { CRITICAL: 4, SIGNAL: 3, WATCH: 2, NOISE: 1 };
    return (
      (tierWeight[b.signal_tier] || 0) - (tierWeight[a.signal_tier] || 0) ||
      Number(b.pulse_score || 0) - Number(a.pulse_score || 0)
    );
  });

  const pulseValues = sortedSignals
    .map((cluster) => Number(cluster.pulse_score))
    .filter((value) => Number.isFinite(value));
  const worldPulseValue = Number.isFinite(Number(dashboard?.world_pulse ?? dashboard?.global_pulse))
    ? clamp(Number(dashboard.world_pulse ?? dashboard.global_pulse))
    : pulseValues.length
      ? Math.round(pulseValues.slice(0, 5).reduce((sum, value, index) => sum + value * (5 - index), 0) /
        pulseValues.slice(0, 5).reduce((sum, _value, index) => sum + (5 - index), 0))
      : null;

  const deltas = Array.isArray(dashboard?.daily_delta) ? dashboard.daily_delta : [];
  const averageDelta = deltas.length
    ? Math.round(deltas.reduce((sum, item) => sum + Number(item.delta || 0), 0) / deltas.length)
    : null;

  const prefData = preferences?.data || preferences || {};
  const topics = Array.isArray(prefData.preferred_categories)
    ? prefData.preferred_categories
    : dashboard?.topics_used || [];
  const regions = Array.isArray(prefData.preferred_regions)
    ? prefData.preferred_regions
    : dashboard?.regions_used || [];
  const trackedEntities = dashboard?.tracked_entities || prefData.tracked_entities || [];

  const changesToday = deltas.slice(0, 6).map((item) => ({
    id: item.topic || item.label,
    topic: item.label || compactLabel(item.topic),
    reason: item.reason || '',
    direction: item.direction || null,
    severityLabel: item.severity_label || null,
    delta: item.has_baseline && Number.isFinite(Number(item.delta)) ? Number(item.delta) : null,
    current: Number.isFinite(Number(item.current)) ? Number(item.current) : null,
    previous: Number.isFinite(Number(item.previous)) ? Number(item.previous) : null,
    sparkline: [],
  })).filter((item) => item.topic);

  const pulseHistory = trendFromPulseHistory(dashboard?.pulse_history);
  const topShifts = sortedSignals.slice(0, 3).map(normalizeShift).filter((shift) => shift.headline);
  const alertsAvailable = Array.isArray(alerts?.alerts) || Array.isArray(dashboard?.alerts);
  const alertRows = Array.isArray(alerts?.alerts) ? alerts.alerts : Array.isArray(dashboard?.alerts) ? dashboard.alerts : [];
  const highImpactAlerts = alertRows.filter((alert) => ['critical', 'warning', 'high'].includes(String(alert.severity || '').toLowerCase())).length;

  return {
    user,
    preferences: {
      topics,
      regions,
      entities: trackedEntities,
      hasPreferences: Boolean(topics.length || regions.length || trackedEntities.length),
    },
    cache: {
      cachedAt: dashboard?.cached_at || dashboard?.generated_at || null,
      cacheAgeSeconds: Number.isFinite(Number(dashboard?.cache_age_seconds)) ? Number(dashboard.cache_age_seconds) : null,
      isStale: Boolean(dashboard?.is_stale),
      refreshType: dashboard?.refresh_type || dashboard?.pipeline_status?.news || null,
      nextRefreshAt: dashboard?.next_refresh_at || null,
    },
    worldPulse: {
      value: worldPulseValue,
      label: dashboard?.world_pulse_label || null,
      delta: averageDelta,
      deltaLabel: averageDelta === null ? null : averageDelta > 0 ? `+${averageDelta} from yesterday` : averageDelta < 0 ? `${averageDelta} from yesterday` : 'Stable',
    },
    pulseHistory,
    changesToday,
    topShifts,
    quickGlance: Array.isArray(dashboard?.quick_glance) ? dashboard.quick_glance : [],
    alerts: alertRows,
    sources: dashboard?.sources || [],
    pipelineStatus: dashboard?.pipeline_status || null,
    raw: dashboard,
  };
}

export function formatRelativeTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export { compactLabel, clamp, normalizeAiStatus };
