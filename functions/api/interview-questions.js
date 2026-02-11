export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { jobDescription, profile, experience, skills, projects, questionNumber, previousQuestions } = await request.json();

    if (!jobDescription) {
      return new Response(JSON.stringify({ error: 'Job description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build experience summary
    const experienceText = (experience || []).slice(0, 3).map(exp =>
      `${exp.title} at ${exp.company} (${exp.start} - ${exp.end || 'Present'})`
    ).join('; ');

    // Build skills summary
    const skillsText = [
      skills?.technical?.slice(0, 10).join(', '),
      skills?.tools?.slice(0, 5).join(', ')
    ].filter(Boolean).join('; ');

    // Build projects summary
    const projectsText = (projects || []).slice(0, 3).map(p => p.name).join(', ');

    // Previous questions to avoid repetition
    const prevQuestionsText = (previousQuestions || []).length > 0
      ? `\n\nDO NOT ask any of these questions again:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const prompt = `You are a hiring manager conducting a mock interview. Generate ONE interview question for this candidate.

## JOB DESCRIPTION
${jobDescription}

## CANDIDATE BACKGROUND
Name: ${profile?.fullName || 'Candidate'}
Experience: ${experienceText || 'Not provided'}
Skills: ${skillsText || 'Not provided'}
Projects: ${projectsText || 'Not provided'}
${prevQuestionsText}

## INSTRUCTIONS
This is question ${questionNumber || 1} of the interview. Generate a relevant interview question that:
1. Is tailored to both the job requirements AND the candidate's background
2. Tests skills/experience mentioned in the job description
3. Gives the candidate a chance to highlight their relevant experience
4. Varies the question type (behavioral, technical, situational, competency-based)

For question 1: Start with a warm-up question about their background or interest in the role.
For questions 2-3: Ask behavioral questions (Tell me about a time when...)
For questions 4-5: Ask technical or problem-solving questions relevant to the role.

## OUTPUT FORMAT
Respond with JSON only:
{
  "question": "The interview question to ask",
  "type": "behavioral|technical|situational|competency",
  "tip": "Brief tip for the candidate on how to approach this question",
  "timeHint": "1-2 minutes"
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
      return new Response(JSON.stringify({ error: 'AI API error: ' + error.substring(0, 200) }), {
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
        question: parsed.question,
        type: parsed.type || 'behavioral',
        tip: parsed.tip || '',
        timeHint: parsed.timeHint || '1-2 minutes'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // If JSON parsing fails, extract question from content
      return new Response(JSON.stringify({
        question: content,
        type: 'behavioral',
        tip: 'Take a moment to think before answering.',
        timeHint: '1-2 minutes'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('Interview questions API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
