export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY || 'REDACTED';

  try {
    const data = await request.json();
    const { profile, experience, education, certs, skills, projects, jobDescription, targetRole, additionalInstructions, includeCoverLetter } = data;

    // Validate required data
    if (!jobDescription) {
      return new Response(JSON.stringify({ error: 'Job description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the enhanced prompt based on ClaudeSkills approach
    const prompt = buildEnhancedPrompt(profile || {}, experience || [], education || [], certs || [], skills || {}, projects || [], jobDescription, targetRole, additionalInstructions, includeCoverLetter);

    console.log('Calling Claude API with prompt length:', prompt.length);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return new Response(JSON.stringify({ error: 'Claude API error: ' + error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    const content = result.content[0].text;

    // Parse the response
    const parsed = parseEnhancedResponse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Generate API Error:', e.message, e.stack);
    return new Response(JSON.stringify({
      error: 'Server error: ' + e.message,
      details: e.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function buildEnhancedPrompt(profile, experience, education, certs, skills, projects, jobDescription, targetRole, additionalInstructions, includeCoverLetter) {
  const experienceText = experience.map(exp => `
**${exp.title}** at **${exp.company}** (${exp.location})
${exp.start} - ${exp.end || 'Present'}
${exp.bullets.map(b => '• ' + b).join('\n')}
`).join('\n');

  const educationText = education.map(edu => `
**${edu.degree}** - ${edu.school} (${edu.start}-${edu.end})${edu.gpa ? ' GPA: ' + edu.gpa : ''}
${edu.extras || ''}
`).join('\n');

  const certsText = certs.map(c => `• ${c.name} - ${c.org} (${c.date})`).join('\n');

  const projectsText = (projects || []).map(proj => `
**${proj.name}**
${proj.shortDesc || ''}
Technologies: ${proj.tech || 'Not specified'}
${proj.url ? `URL: ${proj.url}` : ''}
${proj.features ? proj.features.map(f => '• ' + f).join('\n') : ''}
${proj.readme ? `\nDetailed Description:\n${proj.readme.substring(0, 1000)}${proj.readme.length > 1000 ? '...' : ''}` : ''}
`).join('\n');

  return `You are an expert resume customization system combining ATS optimization with recruiter-level strategic analysis. Follow this systematic 5-step process:

## CANDIDATE RESUME DATABANK

**Personal Information:**
- Name: ${profile.fullName || 'Not provided'}
- Email: ${profile.email || ''}
- Phone: ${profile.phone || ''}
- Location: ${profile.location || ''}
- LinkedIn: ${profile.linkedin || ''}
- GitHub: ${profile.github || ''}
- Portfolio: ${profile.portfolio || ''}

**Professional Summary (base version):**
${profile.summary || 'Not provided'}

**Work Experience:**
${experienceText || 'No experience provided'}

**Education:**
${educationText || 'No education provided'}

**Certifications:**
${certsText || 'None'}

**Technical Skills:** ${skills.technical?.join(', ') || 'None listed'}
**Soft Skills:** ${skills.soft?.join(', ') || 'None listed'}
**Tools & Technologies:** ${skills.tools?.join(', ') || 'None listed'}
**Personal Interests:** ${skills.interests?.join(', ') || 'None listed'}

**Projects & Portfolio:**
${projectsText || 'No projects provided'}

---

## TARGET JOB DESCRIPTION

${jobDescription}

${targetRole ? `**Target Role Override:** ${targetRole}` : ''}
${additionalInstructions ? `**Additional Instructions:** ${additionalInstructions}` : ''}

---

## YOUR 5-STEP PROCESS

### STEP 1: JOB ANALYSIS
Parse the job description and extract:
- Required technical skills
- Preferred/nice-to-have skills
- Key responsibilities
- Experience level required
- Industry-specific terminology
- Company values and culture keywords

### STEP 2: EXPERIENCE MINING & RELEVANCE SCORING
For EACH experience in the candidate's databank:
- Calculate a relevance score (0-10) based on:
  - Technical skill alignment (40% weight)
  - Responsibility alignment (30% weight)
  - Industry/domain relevance (20% weight)
  - Impact and quantified achievements (10% weight)
- Rank all experiences by relevance
- Select top 2-4 bullet points per role that best match the job

### STEP 3: COMPANY CONTEXT
Based on the job description, infer:
- Company's strategic priorities
- Department goals
- Technology preferences
- Cultural values

### STEP 4: CONTENT OPTIMIZATION
Create the tailored resume with:
- Rewritten professional summary specific to this role
- Experiences ordered by relevance (not just chronology)
- Bullet points using keywords from the job description
- Skills section prioritized by job requirements
- Action verbs: Led, Developed, Increased, Reduced, Implemented, Designed, Built, Managed, Delivered, Optimized

Bullet Point Format:
• [Action Verb] [Specific Achievement] using [Technology/Method] resulting in [Quantified Impact]

### STEP 5: RECRUITER ANALYSIS
Simulate a recruiter's perspective:
- Overall fit score (0-100)
- Key strengths that match
- Concerns or gaps
- Questions they'd likely ask
- Interview preparation tips
- Honest recommendation

---

## REQUIRED OUTPUT FORMAT

Respond in EXACTLY this format with these section markers:

---RELEVANCE_RANKINGS---
[For each experience, show: Company - Role: X/10 relevance score with brief reason]

---ATS_SCORE---
[Single number 0-100 representing overall ATS match percentage]

---MATCHED_KEYWORDS---
[Comma-separated list of job description keywords successfully incorporated]

---MISSING_KEYWORDS---
[Comma-separated list of important keywords candidate could add if they have the experience]

---TAILORED_SUMMARY---
[2-3 sentence professional summary rewritten specifically for this role]

---RESUME---
[Complete ATS-optimized resume in clean plain text format ready to copy/paste]

---RECRUITER_ASSESSMENT---
**Fit Score:** [X/100]
**Recommendation:** [Strong Match / Good Match / Potential Match / Weak Match]

**Strengths:**
• [Strength 1]
• [Strength 2]
• [Strength 3]

**Concerns:**
• [Concern 1]
• [Concern 2]

**Gap Analysis:**
[Honest assessment of missing qualifications and how to address them]

**Interview Questions to Prepare For:**
1. [Question about potential weakness]
2. [Question about specific experience]
3. [Behavioral question relevant to role]

**Talking Points:**
• [Key achievement to emphasize]
• [Transferable skill to highlight]
• [Story that demonstrates fit]

${includeCoverLetter ? `
---COVER_LETTER---
[Write a compelling cover letter that:
- Opens with enthusiasm for the specific role and company
- Highlights 2-3 most relevant experiences that match the job requirements
- Mentions relevant projects if they demonstrate required skills
- Shows understanding of the company's needs
- Closes with a call to action
- Keep it to 3-4 paragraphs, professional but personable tone
- Do NOT use generic phrases like "I am writing to apply" - be creative]
` : ''}
---END---
`;
}

function parseEnhancedResponse(content) {
  // Extract each section
  const relevanceMatch = content.match(/---RELEVANCE_RANKINGS---\s*([\s\S]*?)(?=---ATS_SCORE---|$)/);
  const scoreMatch = content.match(/---ATS_SCORE---\s*(\d+)/);
  const matchedMatch = content.match(/---MATCHED_KEYWORDS---\s*([^\n]+(?:\n(?!---)[^\n]+)*)/);
  const missingMatch = content.match(/---MISSING_KEYWORDS---\s*([^\n]+(?:\n(?!---)[^\n]+)*)/);
  const summaryMatch = content.match(/---TAILORED_SUMMARY---\s*([\s\S]*?)(?=---RESUME---|$)/);
  const resumeMatch = content.match(/---RESUME---\s*([\s\S]*?)(?=---RECRUITER_ASSESSMENT---|$)/);
  const recruiterMatch = content.match(/---RECRUITER_ASSESSMENT---\s*([\s\S]*?)(?=---END---|$)/);

  const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;

  const matchedKeywords = matchedMatch
    ? matchedMatch[1].trim().split(',').map(k => k.trim()).filter(k => k && k.length < 50)
    : [];

  const missingKeywords = missingMatch
    ? missingMatch[1].trim().split(',').map(k => k.trim()).filter(k => k && k.length < 50)
    : [];

  const relevanceRankings = relevanceMatch ? relevanceMatch[1].trim() : '';
  const tailoredSummary = summaryMatch ? summaryMatch[1].trim() : '';
  const resume = resumeMatch ? resumeMatch[1].trim() : content;
  const recruiterAssessment = recruiterMatch ? recruiterMatch[1].trim() : '';

  // Extract cover letter if present
  const coverLetterMatch = content.match(/---COVER_LETTER---\s*([\s\S]*?)(?=---END---|$)/);
  const coverLetter = coverLetterMatch ? coverLetterMatch[1].trim() : null;

  return {
    score,
    matchedKeywords,
    missingKeywords,
    relevanceRankings,
    tailoredSummary,
    resume,
    recruiterAssessment,
    coverLetter
  };
}
