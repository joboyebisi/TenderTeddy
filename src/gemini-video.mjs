const ALLOWED_SOURCES = new Set(['licensed-upload', 'owned-upload', 'public-youtube-url']);

export function buildVideoAnalysisRequest({ sourceType, uri, lessonGoal, childAgeBand }) {
  if (!ALLOWED_SOURCES.has(sourceType)) throw new Error('Video source is not permitted');
  if (!uri || !lessonGoal) throw new Error('Video URI and lesson goal are required');
  return {
    contents: [{
      role: 'user',
      parts: [
        { file_data: { file_uri: uri, mime_type: sourceType === 'public-youtube-url' ? 'video/youtube' : 'video/mp4' } },
        { text: `Create candidate learning moments for ${childAgeBand || 'early years'} about ${lessonGoal}. Return timestamps, a short question, expected concept, and confidence. Do not reproduce dialogue or copyrighted frames.` }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  };
}

export function approveCandidate(candidate, reviewer) {
  if (!reviewer?.id || reviewer.role !== 'educator') throw new Error('Educator review required');
  if (!candidate.timestamp || !candidate.question) throw new Error('Incomplete candidate');
  return { ...candidate, status: 'approved', reviewedBy: reviewer.id };
}
