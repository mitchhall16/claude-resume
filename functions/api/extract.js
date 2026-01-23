export async function onRequestPost(context) {
  const { request } = context;
  const API_KEY = 'REDACTED';

  try {
    const { readme } = await request.json();

    if (!readme || readme.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'README content too short' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
        messages: [{
          role: 'user',
          content: `Extract the key features and technologies from this project README. Return JSON only.

README:
${readme.substring(0, 8000)}

Return this exact JSON format:
{
  "shortDesc": "One sentence description of what this project does",
  "features": ["feature 1 - brief description", "feature 2 - brief description"],
  "technologies": ["tech1", "tech2", "tech3"]
}

Rules:
- shortDesc: One compelling sentence (under 120 chars) describing what the project does
- features: 5-8 key user-facing features, each as "Name - brief description" (under 100 chars)
- technologies: Programming languages, frameworks, databases, tools (just names)
- Focus on what makes this project useful
- Return ONLY valid JSON`
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: 'API error: ' + error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    let content = result.content[0].text;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const extracted = JSON.parse(content);

    return new Response(JSON.stringify({
      shortDesc: extracted.shortDesc || '',
      features: extracted.features || [],
      technologies: extracted.technologies || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
