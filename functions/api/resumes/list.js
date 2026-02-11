export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const status = url.searchParams.get('status'); // Optional filter
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get resumes from KV
    const data = await env.RESUME_DATA.get(`resumes:${email}`);

    if (!data) {
      return new Response(JSON.stringify({
        resumes: [],
        total: 0,
        stats: {
          generated: 0,
          applied: 0,
          interviewing: 0,
          offered: 0,
          rejected: 0,
          withdrawn: 0
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let resumes = [];
    try {
      resumes = JSON.parse(data);
    } catch {
      resumes = [];
    }

    // Calculate stats before filtering
    const stats = {
      generated: 0,
      applied: 0,
      interviewing: 0,
      offered: 0,
      rejected: 0,
      withdrawn: 0,
      total: resumes.length,
      avgScore: 0
    };

    let totalScore = 0;
    resumes.forEach(r => {
      const s = r.status || 'generated';
      if (stats.hasOwnProperty(s)) {
        stats[s]++;
      } else {
        stats.generated++;
      }
      totalScore += r.score || 0;
    });

    stats.avgScore = resumes.length > 0 ? Math.round(totalScore / resumes.length) : 0;

    // Filter by status if provided
    let filteredResumes = resumes;
    if (status && status !== 'all') {
      filteredResumes = resumes.filter(r => r.status === status);
    }

    // Apply pagination
    const paginatedResumes = filteredResumes.slice(offset, offset + limit);

    // Return summary data for list view (don't include full resume text)
    const summaryResumes = paginatedResumes.map(r => ({
      id: r.id,
      company: r.company,
      title: r.title,
      jobUrl: r.jobUrl,
      score: r.score,
      status: r.status || 'generated',
      matchedKeywords: r.matchedKeywords || [],
      matchedKeywordsCount: r.matchedKeywords?.length || 0,
      missingKeywords: r.missingKeywords || [],
      missingKeywordsCount: r.missingKeywords?.length || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      notes: r.notes,
      aiScores: r.aiScores || null
    }));

    return new Response(JSON.stringify({
      resumes: summaryResumes,
      total: filteredResumes.length,
      offset,
      limit,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('List resumes error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get a single resume by ID
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, resumeId } = await request.json();

    if (!email || !resumeId) {
      return new Response(JSON.stringify({ error: 'Email and resumeId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await env.RESUME_DATA.get(`resumes:${email}`);

    if (!data) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resumes = JSON.parse(data);
    const resume = resumes.find(r => r.id === resumeId);

    if (!resume) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(resume), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Get resume error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
