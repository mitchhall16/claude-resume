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
    const { text, type } = await request.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prompt = `You are an AI detection expert. Analyze this ${type || 'text'} and rate how likely it appears to be AI-generated.

## TEXT TO ANALYZE
"${text.substring(0, 3000)}"

## DETECTION CRITERIA
Look for these AI red flags:
1. **Generic phrases**: "I'm excited to...", "passionate about", "leverage", "utilize", "synergy", "dynamic environment"
2. **Perfect structure**: Too organized, every paragraph same length, formulaic flow
3. **Lack of personality**: No quirks, humor, unique voice, or specific personal details
4. **Hedging language**: "I believe", "I feel that", excessive qualifiers
5. **Buzzword density**: Too many corporate/tech buzzwords stacked together
6. **Unnatural transitions**: "Furthermore", "Moreover", "Additionally" overused
7. **Too polished**: Real humans make small imperfections, have casual moments
8. **Vague specifics**: Says "significant impact" without real numbers, generic achievements

## HUMAN INDICATORS (lowers AI score)
- Specific numbers and dates
- Casual/conversational moments
- Unique personal anecdotes
- Imperfect but natural phrasing
- Industry-specific jargon used correctly
- Personality showing through

## OUTPUT FORMAT
Respond with JSON only:
{
  "score": [1-10 where 1=definitely human, 10=definitely AI],
  "confidence": "low|medium|high",
  "redFlags": [
    "Specific phrase or pattern that looks AI-generated",
    "Another red flag found"
  ],
  "humanElements": [
    "Thing that makes it seem human",
    "Another human element"
  ],
  "suggestions": [
    "How to make it sound more human",
    "Specific edit suggestion"
  ],
  "verdict": "One sentence summary - e.g. 'Reads like polished AI with some personal touches' or 'Mostly human with minor AI-like phrases'"
}

Be honest and specific. A score of 5-6 means "could go either way."`;

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

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify({
        score: parsed.score || 5,
        confidence: parsed.confidence || 'medium',
        redFlags: parsed.redFlags || [],
        humanElements: parsed.humanElements || [],
        suggestions: parsed.suggestions || [],
        verdict: parsed.verdict || 'Unable to determine'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      return new Response(JSON.stringify({
        score: 5,
        confidence: 'low',
        redFlags: [],
        humanElements: [],
        suggestions: ['Could not analyze - try again'],
        verdict: 'Analysis failed'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('AI check error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
