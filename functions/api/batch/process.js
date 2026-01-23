export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { profile, experience, education, certs, skills, jobs } = data;

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one job description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (jobs.length > 5) {
      return new Response(JSON.stringify({ error: 'Maximum 5 jobs allowed per batch' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process all jobs in parallel
    const results = await Promise.all(
      jobs.map((job, index) => processJob(env, profile, experience, education, certs, skills, job, index))
    );

    // Sort results by score
    results.sort((a, b) => b.score - a.score);

    // Generate comparison summary
    const comparison = generateComparison(results);

    return new Response(JSON.stringify({
      results,
      comparison,
      processedAt: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Batch process error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function processJob(env, profile, experience, education, certs, skills, job, index) {
  const { jobDescription, company, title, url } = job;

  const prompt = buildBatchPrompt(profile, experience, education, certs, skills, jobDescription, title);

  try {
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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content[0].text;
    const parsed = parseBatchResponse(content);

    return {
      index,
      company: company || extractCompanyFromJD(jobDescription),
      title: title || parsed.inferredTitle,
      url: url || null,
      score: parsed.score,
      matchedKeywords: parsed.matchedKeywords,
      missingKeywords: parsed.missingKeywords,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      recommendation: parsed.recommendation,
      tailoredSummary: parsed.tailoredSummary,
      resume: parsed.resume
    };

  } catch (e) {
    return {
      index,
      company: company || 'Unknown',
      title: title || 'Unknown',
      url: url || null,
      score: 0,
      error: e.message,
      matchedKeywords: [],
      missingKeywords: [],
      strengths: [],
      concerns: ['Failed to process this job'],
      recommendation: 'Error'
    };
  }
}

function buildBatchPrompt(profile, experience, education, certs, skills, jobDescription, targetRole) {
  const experienceText = experience.map(exp => `
**${exp.title}** at **${exp.company}**
${exp.start} - ${exp.end || 'Present'}
${exp.bullets.map(b => '• ' + b).join('\n')}
`).join('\n');

  return `You are an expert ATS resume analyzer. Analyze this candidate's fit for the job and generate a tailored resume. Be efficient and concise.

## CANDIDATE DATA

**Profile:**
Name: ${profile.fullName || 'Not provided'}
Email: ${profile.email || ''} | Phone: ${profile.phone || ''} | Location: ${profile.location || ''}
LinkedIn: ${profile.linkedin || ''} | GitHub: ${profile.github || ''}
Summary: ${profile.summary || 'Not provided'}

**Experience:**
${experienceText || 'No experience provided'}

**Skills:**
Technical: ${skills.technical?.join(', ') || 'None'}
Tools: ${skills.tools?.join(', ') || 'None'}
Soft: ${skills.soft?.join(', ') || 'None'}

## JOB DESCRIPTION
${targetRole ? `Target Role: ${targetRole}\n` : ''}
${jobDescription}

## OUTPUT (use these exact section markers)

---INFERRED_TITLE---
[Job title from the posting]

---ATS_SCORE---
[0-100]

---MATCHED_KEYWORDS---
[comma-separated list]

---MISSING_KEYWORDS---
[comma-separated list]

---STRENGTHS---
• [strength 1]
• [strength 2]
• [strength 3]

---CONCERNS---
• [concern 1]
• [concern 2]

---RECOMMENDATION---
[Strong Match / Good Match / Potential Match / Weak Match]

---TAILORED_SUMMARY---
[2-3 sentence professional summary for this role]

---RESUME---
[Full ATS-optimized resume]

---END---`;
}

function parseBatchResponse(content) {
  const getSection = (marker, nextMarker) => {
    const regex = new RegExp(`---${marker}---\\s*([\\s\\S]*?)(?=---${nextMarker}---|$)`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  };

  const scoreMatch = content.match(/---ATS_SCORE---\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

  const matchedText = getSection('MATCHED_KEYWORDS', 'MISSING_KEYWORDS');
  const matchedKeywords = matchedText ? matchedText.split(',').map(k => k.trim()).filter(k => k && k.length < 50) : [];

  const missingText = getSection('MISSING_KEYWORDS', 'STRENGTHS');
  const missingKeywords = missingText ? missingText.split(',').map(k => k.trim()).filter(k => k && k.length < 50) : [];

  const strengthsText = getSection('STRENGTHS', 'CONCERNS');
  const strengths = strengthsText.split('\n').filter(s => s.trim().startsWith('•')).map(s => s.replace('•', '').trim());

  const concernsText = getSection('CONCERNS', 'RECOMMENDATION');
  const concerns = concernsText.split('\n').filter(s => s.trim().startsWith('•')).map(s => s.replace('•', '').trim());

  const recommendation = getSection('RECOMMENDATION', 'TAILORED_SUMMARY').split('\n')[0].trim();
  const tailoredSummary = getSection('TAILORED_SUMMARY', 'RESUME');
  const resume = getSection('RESUME', 'END');
  const inferredTitle = getSection('INFERRED_TITLE', 'ATS_SCORE').split('\n')[0].trim();

  return {
    score,
    matchedKeywords,
    missingKeywords,
    strengths,
    concerns,
    recommendation,
    tailoredSummary,
    resume,
    inferredTitle
  };
}

function extractCompanyFromJD(jobDescription) {
  // Try to extract company name from common patterns
  const patterns = [
    /(?:at|for|with|join)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+(?:is|are|we|as|to|,|\.|!))/i,
    /^([A-Z][A-Za-z0-9\s&]+?)\s+(?:is|are|seeking|looking)/im,
    /About\s+([A-Z][A-Za-z0-9\s&]+?)[\n:]/i
  ];

  for (const pattern of patterns) {
    const match = jobDescription.match(pattern);
    if (match && match[1].length < 50) {
      return match[1].trim();
    }
  }

  return 'Company';
}

function generateComparison(results) {
  const validResults = results.filter(r => !r.error);

  if (validResults.length === 0) {
    return { summary: 'No jobs were successfully processed', rankings: [] };
  }

  // Find common keywords across all jobs
  const allKeywords = validResults.flatMap(r => r.matchedKeywords);
  const keywordCounts = {};
  allKeywords.forEach(k => {
    keywordCounts[k] = (keywordCounts[k] || 0) + 1;
  });

  const commonKeywords = Object.entries(keywordCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword]) => keyword);

  // Find unique missing keywords per job
  const allMissing = validResults.flatMap(r => r.missingKeywords);
  const missingCounts = {};
  allMissing.forEach(k => {
    missingCounts[k] = (missingCounts[k] || 0) + 1;
  });

  const frequentlyMissing = Object.entries(missingCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword);

  // Generate rankings with insights
  const rankings = validResults.map((r, i) => ({
    rank: i + 1,
    company: r.company,
    title: r.title,
    score: r.score,
    recommendation: r.recommendation,
    topStrength: r.strengths[0] || 'N/A',
    topConcern: r.concerns[0] || 'N/A'
  }));

  // Calculate average score
  const avgScore = Math.round(validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length);

  // Best fit determination
  const bestFit = validResults[0];
  const strongMatches = validResults.filter(r => r.score >= 75).length;

  return {
    summary: `Analyzed ${validResults.length} positions. Average fit score: ${avgScore}%. ${strongMatches} strong match${strongMatches !== 1 ? 'es' : ''} found.`,
    bestFit: bestFit ? { company: bestFit.company, title: bestFit.title, score: bestFit.score } : null,
    rankings,
    commonStrengths: commonKeywords,
    frequentlyMissing,
    recommendation: avgScore >= 70
      ? 'Your profile matches well with these positions. Focus on the highest-scoring opportunities.'
      : avgScore >= 50
        ? 'Consider gaining experience in the frequently missing skills to improve your match rate.'
        : 'These positions may require significant skill development. Consider more entry-level roles or adjacent positions.'
  };
}
