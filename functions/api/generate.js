export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { profile, experience, education, certs, skills, jobDescription, targetRole, additionalInstructions } = data;

    // Build the prompt
    const prompt = buildPrompt(profile, experience, education, certs, skills, jobDescription, targetRole, additionalInstructions);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return new Response(JSON.stringify({ error: 'Claude API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    const content = result.content[0].text;

    // Parse the response
    const parsed = parseResponse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function buildPrompt(profile, experience, education, certs, skills, jobDescription, targetRole, additionalInstructions) {
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

  const allSkills = [
    ...(skills.technical || []),
    ...(skills.soft || []),
    ...(skills.tools || [])
  ];

  return `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist. Your task is to create a tailored, ATS-optimized resume based on the candidate's information and the job description.

## CANDIDATE INFORMATION

**Name:** ${profile.fullName || 'Not provided'}
**Email:** ${profile.email || ''}
**Phone:** ${profile.phone || ''}
**Location:** ${profile.location || ''}
**LinkedIn:** ${profile.linkedin || ''}
**GitHub:** ${profile.github || ''}
**Portfolio:** ${profile.portfolio || ''}

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
**Interests:** ${skills.interests?.join(', ') || 'None listed'}

## JOB DESCRIPTION
${jobDescription}

${targetRole ? `## TARGET ROLE: ${targetRole}` : ''}

${additionalInstructions ? `## ADDITIONAL INSTRUCTIONS: ${additionalInstructions}` : ''}

## YOUR TASK

1. **Analyze the job description** - Extract key requirements, skills, and keywords that ATS systems will scan for.

2. **Create an ATS-optimized resume** that:
   - Uses exact keywords and phrases from the job description
   - Tailors the professional summary specifically for this role
   - Reorders and emphasizes relevant experience
   - Highlights matching skills prominently
   - Uses standard section headers (Professional Summary, Experience, Education, Skills, Certifications)
   - Uses clean, ATS-friendly formatting
   - Quantifies achievements where possible

3. **Provide analysis** including:
   - ATS match score (0-100%)
   - Keywords successfully matched
   - Important keywords to consider adding (if candidate has the experience but didn't mention it)

## RESPONSE FORMAT

Respond in this exact format:

---ATS_SCORE---
[number between 0-100]

---MATCHED_KEYWORDS---
[comma-separated list of keywords from job description that appear in the resume]

---MISSING_KEYWORDS---
[comma-separated list of important keywords candidate might want to add if they have that experience]

---RESUME---
[The complete, formatted resume text ready to copy/paste. Use plain text formatting that works in any document editor.]
`;
}

function parseResponse(content) {
  const scoreMatch = content.match(/---ATS_SCORE---\s*(\d+)/);
  const matchedMatch = content.match(/---MATCHED_KEYWORDS---\s*([^\n]+(?:\n(?!---)[^\n]+)*)/);
  const missingMatch = content.match(/---MISSING_KEYWORDS---\s*([^\n]+(?:\n(?!---)[^\n]+)*)/);
  const resumeMatch = content.match(/---RESUME---\s*([\s\S]+)$/);

  const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;
  const matchedKeywords = matchedMatch
    ? matchedMatch[1].trim().split(',').map(k => k.trim()).filter(k => k)
    : [];
  const missingKeywords = missingMatch
    ? missingMatch[1].trim().split(',').map(k => k.trim()).filter(k => k)
    : [];
  const resume = resumeMatch ? resumeMatch[1].trim() : content;

  return {
    score,
    matchedKeywords,
    missingKeywords,
    resume
  };
}
