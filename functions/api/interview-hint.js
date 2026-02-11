export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

  try {
    const { question, jobDescription, profile, experience, skills, projects } = await request.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build experience details
    const experienceText = (experience || []).map(exp =>
      `**${exp.title}** at **${exp.company}** (${exp.start} - ${exp.end || 'Present'}):\n${(exp.bullets || []).map(b => '  - ' + b).join('\n')}`
    ).join('\n\n');

    // Build skills
    const skillsText = skills?.technical?.join(', ') || 'Not provided';

    // Build projects
    const projectsText = (projects || []).map(p =>
      `**${p.name}**: ${p.shortDesc || ''} (${p.tech || ''})`
    ).join('\n');

    const prompt = `You are an interview coach helping a candidate answer a specific question. Your job is to find the CONNECTION between their experience and what the question is asking about.

## INTERVIEW QUESTION
"${question}"

## CANDIDATE'S REAL EXPERIENCE
${experienceText || 'No experience provided'}

## SKILLS
${skillsText}

## PROJECTS
${projectsText || 'No projects provided'}

## JOB CONTEXT
${jobDescription || 'General interview'}

## CRITICAL INSTRUCTIONS
1. First, identify what TOPIC/SKILL the question is really asking about (e.g., AI, leadership, problem-solving, teamwork)
2. Then find experiences from their background that RELATE to that topic - even if indirectly
3. Help them FRAME their experience in terms the question is asking about

For example:
- If asked about "AI experience" and they worked on autonomous tractors → frame it as "working with AI-powered autonomous systems, sensor fusion, machine learning models for navigation"
- If asked about "leadership" and they managed demos → frame it as "leading cross-functional teams, coordinating stakeholders"

## TASK
Give 3-4 talking points that BRIDGE their experience to what the question asks.
- Explicitly connect their work to the question's topic
- Use terminology from the question in your suggestions
- Help them see how their experience IS relevant (even if they don't realize it)

## OUTPUT FORMAT
Respond with JSON only:
{
  "hints": [
    "Your work on [X] is actually AI experience - frame it as: [how to describe it]",
    "Connect your [experience] to [question topic] by explaining how [connection]",
    "Mention [specific achievement] and emphasize the [relevant aspect]"
  ]
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
        max_tokens: 512,
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
        hints: parsed.hints || ['Think about a relevant experience from your background']
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      return new Response(JSON.stringify({
        hints: ['Think about specific examples from your experience', 'Use the STAR format: Situation, Task, Action, Result']
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('Interview hint API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
