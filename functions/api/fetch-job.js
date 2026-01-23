export async function onRequestPost(context) {
  const { request } = context;

  try {
    const { url } = await request.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the job posting page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const html = await response.text();

    // Parse based on the job board
    let result;
    if (url.includes('greenhouse.io')) {
      result = parseGreenhouse(html);
    } else if (url.includes('lever.co')) {
      result = parseLever(html);
    } else if (url.includes('ashbyhq.com')) {
      result = parseAshby(html);
    } else if (url.includes('workday.com')) {
      result = parseWorkday(html);
    } else {
      result = parseGeneric(html);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Fetch job error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function parseGreenhouse(html) {
  // Extract title from <h1> or title tag
  const titleMatch = html.match(/<h1[^>]*class="[^"]*app-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^|<]+)/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  // Extract company from various places
  const companyMatch = html.match(/<span[^>]*class="[^"]*company-name[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i) ||
                       html.match(/at\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+[-|]|\s*<)/i);
  const company = companyMatch ? cleanText(companyMatch[1]) : '';

  // Extract job description content
  const descMatch = html.match(/<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*id="application"|<form)/i) ||
                    html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*application/i) ||
                    html.match(/<section[^>]*>([\s\S]*?)<\/section>/i);

  let description = '';
  if (descMatch) {
    description = htmlToText(descMatch[1]);
  } else {
    // Fallback: extract all text from body, removing scripts/styles
    description = htmlToText(html);
  }

  // Extract location
  const locationMatch = html.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                        html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
  const location = locationMatch ? cleanText(locationMatch[1]) : '';

  return { title, company, description, location };
}

function parseLever(html) {
  const titleMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/i) ||
                     html.match(/<title>([^-<]+)/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  const companyMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i) ||
                       html.match(/<title>[^-]+-\s*([^<]+)<\/title>/i);
  const company = companyMatch ? cleanText(companyMatch[1]) : '';

  const descMatch = html.match(/<div[^>]*class="[^"]*section-wrapper[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*lever-application/i) ||
                    html.match(/<div[^>]*data-qa="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch ? htmlToText(descMatch[1]) : htmlToText(html);

  const locationMatch = html.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                        html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
  const location = locationMatch ? cleanText(locationMatch[1]) : '';

  return { title, company, description, location };
}

function parseAshby(html) {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^|<]+)/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  const companyMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  const company = companyMatch ? cleanText(companyMatch[1]) : '';

  const descMatch = html.match(/<div[^>]*class="[^"]*ashby-job-posting-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch ? htmlToText(descMatch[1]) : htmlToText(html);

  const locationMatch = html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
  const location = locationMatch ? cleanText(locationMatch[1]) : '';

  return { title, company, description, location };
}

function parseWorkday(html) {
  const titleMatch = html.match(/<h2[^>]*data-automation-id="[^"]*jobPostingHeader[^"]*"[^>]*>([^<]+)<\/h2>/i) ||
                     html.match(/<title>([^|<]+)/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  const companyMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  const company = companyMatch ? cleanText(companyMatch[1]) : '';

  const descMatch = html.match(/<div[^>]*data-automation-id="[^"]*jobPostingDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch ? htmlToText(descMatch[1]) : htmlToText(html);

  return { title, company, description, location: '' };
}

function parseGeneric(html) {
  // Try common patterns
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^|<\-]+)/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  const companyMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i) ||
                       html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i);
  const company = companyMatch ? cleanText(companyMatch[1]) : '';

  // Try to find job description in common containers
  const descMatch = html.match(/<div[^>]*class="[^"]*job[-_]?description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const description = descMatch ? htmlToText(descMatch[1]) : htmlToText(html);

  return { title, company, description, location: '' };
}

function htmlToText(html) {
  if (!html) return '';

  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert common elements to text with spacing
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n');

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&bull;/g, '•');
  text = text.replace(/&#\d+;/g, '');

  // Clean up whitespace
  text = text.replace(/\t/g, ' ');
  text = text.replace(/  +/g, ' ');
  text = text.replace(/\n +/g, '\n');
  text = text.replace(/ +\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}
