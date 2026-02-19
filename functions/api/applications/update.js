export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, resumeId, status, notes, jobUrl, interviewDate, interviewNotes, aiScores, resume, coverLetter, tailoredSummary, editedSkills, editedProjects } = await request.json();

    if (!email || !resumeId) {
      return new Response(JSON.stringify({ error: 'Email and resumeId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Valid statuses
    const validStatuses = ['generated', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];
    if (status && !validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }), {
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
    const resumeIndex = resumes.findIndex(r => r.id === resumeId);

    if (resumeIndex === -1) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the resume
    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (status) {
      updates.status = status;
      updates.statusUpdatedAt = new Date().toISOString();

      // Track status history
      if (!resumes[resumeIndex].statusHistory) {
        resumes[resumeIndex].statusHistory = [];
      }
      resumes[resumeIndex].statusHistory.push({
        status,
        date: new Date().toISOString()
      });
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (jobUrl !== undefined) {
      updates.jobUrl = jobUrl;
    }

    if (aiScores !== undefined) {
      updates.aiScores = aiScores;
    }

    if (resume !== undefined) {
      updates.resume = resume;
    }

    if (coverLetter !== undefined) {
      updates.coverLetter = coverLetter;
    }

    if (tailoredSummary !== undefined) {
      updates.tailoredSummary = tailoredSummary;
    }

    if (editedSkills !== undefined) {
      updates.editedSkills = editedSkills;
    }

    if (editedProjects !== undefined) {
      updates.editedProjects = editedProjects;
    }

    if (interviewDate) {
      if (!resumes[resumeIndex].interviews) {
        resumes[resumeIndex].interviews = [];
      }
      resumes[resumeIndex].interviews.push({
        date: interviewDate,
        notes: interviewNotes || '',
        addedAt: new Date().toISOString()
      });
    }

    resumes[resumeIndex] = {
      ...resumes[resumeIndex],
      ...updates
    };

    // Save updated list
    await env.RESUME_DATA.put(`resumes:${email}`, JSON.stringify(resumes));

    return new Response(JSON.stringify({
      success: true,
      resume: {
        id: resumes[resumeIndex].id,
        company: resumes[resumeIndex].company,
        title: resumes[resumeIndex].title,
        status: resumes[resumeIndex].status,
        notes: resumes[resumeIndex].notes,
        updatedAt: resumes[resumeIndex].updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Update application error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
