export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

  try {
    const data = await request.json();

    // Check if this is a README extraction request
    if (data.mode === 'extract' && data.readme) {
      return handleExtract(data.readme, API_KEY);
    }

    // Check if this is a bullet enhancement request
    if (data.mode === 'enhance' && data.bullets) {
      return handleEnhance(data.bullets, data.title, data.company, data.enhanceMode || 'supercharge', API_KEY);
    }

    const resumeText = data.resumeText;

    const prompt = `Parse this resume text and extract structured data. Return ONLY valid JSON, no other text.

RESUME TEXT:
${resumeText}

Return this exact JSON structure (fill in what you can find, use empty strings/arrays for missing data):

{
  "profile": {
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "portfolio": "",
    "summary": ""
  },
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start": "2020-01",
      "end": "2023-12",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "school": "School Name",
      "location": "City, State",
      "start": "2016",
      "end": "2020",
      "gpa": "",
      "extras": ""
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "interests": []
  }
}

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
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

    // Clean up any markdown formatting
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleExtract(readme, API_KEY) {
  try {
    const prompt = `Extract the key features and technologies from this project README. Return JSON only.

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
- Return ONLY valid JSON`;

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
    return new Response(JSON.stringify({ error: 'Extraction error: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleEnhance(bullets, title, company, enhanceMode, API_KEY) {
  try {
    const bulletCount = bullets.split('\n').filter(b => b.trim()).length;

  const cleanupPrompt = `You are a proofreader. Fix grammar, spelling, and awkward phrasing in these bullet points. Make minimal changes.

Job Title: ${title || 'Not specified'}
Company: ${company || 'Not specified'}

Current bullet points:
${bullets}

STRICT RULES:
1. Fix ONLY grammar, spelling, and awkward phrasing
2. Keep the EXACT same number of bullets (${bulletCount} in → ${bulletCount} out)
3. Do NOT combine bullets
4. Do NOT add metrics or numbers that aren't there
5. Do NOT significantly reword - just clean up
6. Start each bullet with a strong action verb if not already
7. Preserve the original meaning exactly

Return ONLY a JSON array of strings:
["bullet 1", "bullet 2", ...]`;

  const superchargePrompt = `You are an expert resume writer. Transform these rough bullet points into powerful achievement statements.

Job Title: ${title || 'Not specified'}
Company: ${company || 'Not specified'}

Current bullet points:
${bullets}

RULES:
1. PRESERVE all real metrics/numbers exactly as written (%, $, counts, etc.)
2. You MAY combine related bullets for better flow
3. You MAY add reasonable estimated metrics (e.g., "team of 5+", "reduced by ~20%") where it makes sense
4. Start each bullet with a strong action verb
5. Make bullets impactful and professional
6. Return 4-8 polished bullets

Return ONLY a JSON array of strings:
["bullet 1", "bullet 2", ...]`;

  const prompt = enhanceMode === 'cleanup' ? cleanupPrompt : superchargePrompt;

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
    return new Response(JSON.stringify({ error: 'API error: ' + error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await response.json();
  let content = result.content[0].text;
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Extract just the JSON array from the response
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('No JSON array found in response');
  }

  let jsonStr = arrayMatch[0];
  // Fix common JSON issues: trailing commas before ]
  jsonStr = jsonStr.replace(/,\s*\]/g, ']');

  const enhanced = JSON.parse(jsonStr);

  return new Response(JSON.stringify({ bullets: enhanced }), {
    headers: { 'Content-Type': 'application/json' }
  });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Enhancement error: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
