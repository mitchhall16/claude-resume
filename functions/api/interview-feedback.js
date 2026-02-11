export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

  try {
    const { question, answer, jobDescription, profile, experience, skills, projects } = await request.json();

    if (!question || !answer) {
      return new Response(JSON.stringify({ error: 'Question and answer are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build experience summary for context
    const experienceText = (experience || []).slice(0, 3).map(exp =>
      `${exp.title} at ${exp.company}: ${(exp.bullets || []).slice(0, 2).join('; ')}`
    ).join('\n');

    // Build skills summary
    const skillsText = skills?.technical?.slice(0, 10).join(', ') || 'Not provided';

    // Build projects summary
    const projectsText = (projects || []).slice(0, 3).map(p =>
      `${p.name}: ${p.shortDesc || ''}`
    ).join('\n');

    const prompt = `You are a tough but fair interview coach. Evaluate this answer HONESTLY - most practice answers have real problems.

## INTERVIEW QUESTION
"${question}"

## CANDIDATE'S ANSWER
"${answer}"

## JOB CONTEXT
${jobDescription || 'General interview practice'}

## CANDIDATE'S ACTUAL BACKGROUND (for reference)
Experience: ${experienceText || 'Not provided'}
Skills: ${skillsText}
Projects: ${projectsText || 'Not provided'}

## SCORING GUIDE (be strict!)
- 90-100: Exceptional. Clear STAR format, specific metrics, compelling story, perfect relevance. RARE.
- 75-89: Good. Has structure and examples but missing some specifics or polish.
- 60-74: Okay. Answers the question but vague, no metrics, weak structure.
- 40-59: Needs work. Rambling, off-topic, or too short. Missing key elements.
- 0-39: Poor. Doesn't answer the question, no examples, very unclear.

## COMMON PROBLEMS TO LOOK FOR
- Too vague ("I worked on projects" vs "I led a 5-person team to ship X")
- No numbers/metrics ("improved performance" vs "reduced load time by 40%")
- Missing the Result in STAR format
- Not actually answering what was asked
- Too short or too rambling
- Not connecting to the job requirements

## OUTPUT FORMAT
Respond with JSON only:
{
  "score": [be honest - most answers are 50-75],
  "strengths": [
    "Specific thing they did well (if any)",
    "Another strength (only if genuine)"
  ],
  "improvements": [
    "Most important thing to fix",
    "Second priority improvement",
    "Third thing to work on"
  ],
  "exampleAnswer": "Show them HOW to improve one weak part - rewrite 1-2 sentences as an example",
  "overallFeedback": "One honest sentence - what's the main issue or win?"
}

Be direct. Vague praise doesn't help them improve.`;

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
        score: parsed.score || 50,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        exampleAnswer: parsed.exampleAnswer || '',
        overallFeedback: parsed.overallFeedback || 'Answer evaluated.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // If JSON parsing fails, return basic feedback
      return new Response(JSON.stringify({
        score: 50,
        strengths: ['You provided an answer'],
        improvements: ['Try to be more specific with examples'],
        exampleAnswer: '',
        overallFeedback: 'Keep practicing!'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('Interview feedback API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
