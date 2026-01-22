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

    // Get existing resumes
    const data = await env.RESUME_DATA.get(`resumes:${email}`);

    if (!data) {
      return new Response(JSON.stringify({ error: 'No resumes found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let resumes = JSON.parse(data);
    const originalLength = resumes.length;

    // Filter out the resume to delete
    resumes = resumes.filter(r => r.id !== resumeId);

    if (resumes.length === originalLength) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save updated list
    await env.RESUME_DATA.put(`resumes:${email}`, JSON.stringify(resumes));

    return new Response(JSON.stringify({
      success: true,
      remainingResumes: resumes.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Delete resume error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
