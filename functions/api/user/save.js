export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { email, profile, experience, education, certs, skills } = data;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store in KV
    const userData = { profile, experience, education, certs, skills, updatedAt: new Date().toISOString() };
    await env.RESUME_DATA.put('user:' + email, JSON.stringify(userData));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
