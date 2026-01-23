export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY || 'REDACTED';

  try {
    const { question, context: jobContext, length, profile, experience, education, skills, projects } = await request.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build experience summary
    const experienceText = (experience || []).map(exp => `
**${exp.title}** at **${exp.company}** (${exp.start} - ${exp.end || 'Present'})
${(exp.bullets || []).map(b => '• ' + b).join('\n')}
`).join('\n');

    // Build skills summary
    const skillsText = [
      skills?.technical?.length ? `Technical: ${skills.technical.join(', ')}` : '',
      skills?.tools?.length ? `Tools: ${skills.tools.join(', ')}` : '',
      skills?.soft?.length ? `Soft Skills: ${skills.soft.join(', ')}` : ''
    ].filter(Boolean).join('\n');

    // Build projects summary
    const projectsText = (projects || []).slice(0, 3).map(p =>
      `**${p.name}**: ${p.shortDesc || ''} (${p.tech || ''})${p.context ? `\n  Why I built this: ${p.context}` : ''}`
    ).join('\n');

    // Length instructions
    const lengthInstructions = {
      short: 'Keep your answer to 2-3 sentences. Be concise and direct.',
      medium: 'Write 1 solid paragraph (4-6 sentences). Include a specific example.',
      long: 'Write 2-3 paragraphs using the STAR format (Situation, Task, Action, Result). Be detailed and specific.'
    };

    const prompt = `You are helping a job candidate answer an application question. Use ONLY their actual experience provided below.

## CRITICAL RULES
1. ONLY mention companies, projects, roles, and details that are EXPLICITLY listed below
2. DO NOT invent, hallucinate, or embellish ANY details
3. Use the EXACT project names, company names, and descriptions provided
4. If something isn't in their background, DO NOT mention it
5. Stick to facts from the data below - no creative additions
6. If the question contains text in [brackets], treat it as a hint for what to focus on or include in your answer - e.g., "[mention handleof.it]" means emphasize that project, "[use robotics experience]" means focus on robotics-related work

## CANDIDATE'S BACKGROUND (USE ONLY THIS DATA)

**Name:** ${profile?.fullName || 'Not provided'}
**Summary:** ${profile?.summary || 'Not provided'}

**Work Experience:**
${experienceText || 'No experience provided'}

**Skills:**
${skillsText || 'No skills provided'}

**Projects (USE EXACT NAMES):**
${projectsText || 'No projects provided'}

**Education:**
${(education || []).map(e => `${e.degree} - ${e.school}`).join(', ') || 'Not provided'}

${jobContext ? `## JOB/COMPANY CONTEXT\n${jobContext}\n` : ''}

## QUESTION TO ANSWER
${question}

## INSTRUCTIONS
${lengthInstructions[length] || lengthInstructions.medium}

Write in first person as the candidate. Reference ONLY the actual roles, companies, projects, and achievements listed above. Use EXACT names - do not change or "improve" project names or company names.

If the question is "Why do you want to work at [Company]?" and no company context is provided, write a template answer they can customize with [brackets] for company-specific details.

Sound natural and conversational, not robotic.

## OUTPUT FORMAT
Respond with JSON only:
{
  "answer": "Your crafted answer here...",
  "tips": "• Tip 1 for delivering this answer\\n• Tip 2\\n• Tip 3"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return new Response(JSON.stringify({ error: 'AI API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    let content = result.content[0].text;

    // Parse JSON response
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify({
        answer: parsed.answer || content,
        tips: parsed.tips || ''
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // If JSON parsing fails, return raw content
      return new Response(JSON.stringify({
        answer: content,
        tips: ''
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('Answer API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
