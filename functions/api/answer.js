export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

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

    const prompt = `You are helping a job candidate answer an application question.

## CRITICAL RULES
1. If the user provides HINTS or INSTRUCTIONS in the context section below, FOLLOW THEM. They're telling you what story to tell.
2. User hints might include personal stories not in their formal resume - USE THEM if provided.
3. For formal resume items, use EXACT company/project names as listed.
4. Don't invent details that weren't provided anywhere.

## CANDIDATE'S BACKGROUND

**Name:** ${profile?.fullName || 'Not provided'}
**Summary:** ${profile?.summary || 'Not provided'}

**Work Experience:**
${experienceText || 'No experience provided'}

**Skills:**
${skillsText || 'No skills provided'}

**Projects:**
${projectsText || 'No projects provided'}

**Education:**
${(education || []).map(e => `${e.degree} - ${e.school}`).join(', ') || 'Not provided'}

${jobContext ? `## USER'S HINTS & CONTEXT (PRIORITIZE THIS!)
The user wrote these notes about what they want to include. USE THESE as your primary guide:
---
${jobContext}
---
If they mention specific stories, experiences, or angles (even if not in their formal resume above), incorporate those into the answer. They're giving you direction on what to focus on.
` : ''}

## QUESTION TO ANSWER
${question}

## INSTRUCTIONS
${lengthInstructions[length] || lengthInstructions.medium}

Write in first person as the candidate. Sound natural and conversational.

If the user gave hints about what to mention (moving to California, working their way up, a specific project, etc.), MAKE SURE to include those - that's why they wrote them!

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
