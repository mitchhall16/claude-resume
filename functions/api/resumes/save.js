export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const {
      email,
      resumeId,
      company,
      title,
      jobUrl,
      jobDescription,
      score,
      matchedKeywords,
      missingKeywords,
      tailoredSummary,
      resume,
      recruiterAssessment,
      coverLetter,
      status,
      notes
    } = data;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique ID if not provided (for new resumes)
    const id = resumeId || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const resumeData = {
      id,
      company: company || 'Unknown Company',
      title: title || 'Unknown Position',
      jobUrl: jobUrl || null,
      jobDescription: jobDescription || '',
      score: score || 0,
      matchedKeywords: matchedKeywords || [],
      missingKeywords: missingKeywords || [],
      tailoredSummary: tailoredSummary || '',
      resume: resume || '',
      recruiterAssessment: recruiterAssessment || '',
      coverLetter: coverLetter || null,
      status: status || 'generated',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Get existing resumes list
    const existingData = await env.RESUME_DATA.get(`resumes:${email}`);
    let resumes = [];

    if (existingData) {
      try {
        resumes = JSON.parse(existingData);
      } catch {
        resumes = [];
      }
    }

    // Check if updating existing or adding new
    const existingIndex = resumes.findIndex(r => r.id === id);
    if (existingIndex >= 0) {
      // Update existing resume
      resumes[existingIndex] = {
        ...resumes[existingIndex],
        ...resumeData,
        createdAt: resumes[existingIndex].createdAt, // Preserve original creation date
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new resume
      resumes.unshift(resumeData);
    }

    // Limit to 100 saved resumes per user
    if (resumes.length > 100) {
      resumes = resumes.slice(0, 100);
    }

    // Save back to KV
    await env.RESUME_DATA.put(`resumes:${email}`, JSON.stringify(resumes));

    return new Response(JSON.stringify({
      success: true,
      resumeId: id,
      totalResumes: resumes.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Save resume error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
