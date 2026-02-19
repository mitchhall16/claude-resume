const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400, headers: CORS
      });
    }

    const userData = await env.RESUME_DATA.get('user:' + email);

    if (!userData) {
      return new Response(JSON.stringify({ projects: [] }), { headers: CORS });
    }

    const parsed = JSON.parse(userData);
    const projects = (parsed.projects || []).map(p => ({
      name: p.name || '',
      shortDesc: p.shortDesc || '',
      tech: p.tech || '',
      features: p.features || [],
      url: p.githubPrivate ? null : (p.url || null),
      liveUrl: p.liveUrl || null,
      aiAssisted: p.aiAssisted || false,
      githubPrivate: p.githubPrivate || false
    }));

    return new Response(JSON.stringify({ projects }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: CORS
    });
  }
}
