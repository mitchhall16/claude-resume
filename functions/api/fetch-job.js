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

    // First try to extract JSON-LD structured data (most reliable)
    let result = extractJsonLd(html);

    // If JSON-LD didn't work well, try platform-specific parsing
    if (!result.description || result.description.length < 100) {
      if (url.includes('greenhouse.io')) {
        result = { ...result, ...parseGreenhouse(html) };
      } else if (url.includes('lever.co')) {
        result = { ...result, ...parseLever(html) };
      } else if (url.includes('ashbyhq.com')) {
        result = { ...result, ...parseAshby(html) };
      } else if (url.includes('workday.com')) {
        result = { ...result, ...parseWorkday(html) };
      } else {
        result = { ...result, ...parseGeneric(html) };
      }
    }

    // Final fallback - extract meta tags
    if (!result.title) {
      result.title = extractMetaTag(html, 'og:title') || extractTitle(html);
    }
    if (!result.company) {
      result.company = extractMetaTag(html, 'og:site_name') || '';
    }
    if (!result.description || result.description.length < 100) {
      const metaDesc = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description');
      if (metaDesc && metaDesc.length > (result.description?.length || 0)) {
        result.description = metaDesc;
      }
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

function extractJsonLd(html) {
  const result = { title: '', company: '', description: '', location: '' };

  try {
    // Find all JSON-LD scripts
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);

        // Handle array of JSON-LD objects
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'JobPosting') {
            result.title = item.title || '';
            result.description = item.description ? htmlToText(item.description) : '';
            result.company = item.hiringOrganization?.name || '';
            result.location = item.jobLocation?.address?.addressLocality ||
                             item.jobLocation?.name ||
                             (typeof item.jobLocation === 'string' ? item.jobLocation : '');
            return result;
          }
        }
      } catch (e) {
        // JSON parse failed, continue to next match
      }
    }
  } catch (e) {
    // Regex failed
  }

  return result;
}

function extractMetaTag(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return '';
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? cleanText(match[1].split(/[|\-–—]/)[0]) : '';
}

function parseGreenhouse(html) {
  const result = { title: '', company: '', description: '', location: '' };

  // Greenhouse specific: look for content in #content div
  const contentMatch = html.match(/<div[^>]*id=["']content["'][^>]*>([\s\S]*?)(?=<div[^>]*id=["']application|<form|<div[^>]*class=["'][^"']*application)/i);
  if (contentMatch) {
    result.description = htmlToText(contentMatch[1]);
  }

  // Try app-body class
  if (!result.description || result.description.length < 100) {
    const appBodyMatch = html.match(/<div[^>]*class=["'][^"']*app-body[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (appBodyMatch) {
      result.description = htmlToText(appBodyMatch[1]);
    }
  }

  // Greenhouse title
  const titleMatch = html.match(/<h1[^>]*class=["'][^"']*app-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = cleanText(titleMatch[1]);

  // Greenhouse company
  const companyMatch = html.match(/<span[^>]*class=["'][^"']*company-name[^"']*["'][^>]*>([^<]+)<\/span>/i);
  if (companyMatch) result.company = cleanText(companyMatch[1]);

  // Greenhouse location
  const locationMatch = html.match(/<div[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/div>/i);
  if (locationMatch) result.location = cleanText(locationMatch[1]);

  return result;
}

function parseLever(html) {
  const result = { title: '', company: '', description: '', location: '' };

  // Lever content sections
  const sectionsMatch = html.match(/<div[^>]*class=["'][^"']*section-wrapper[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*application)/i);
  if (sectionsMatch) {
    result.description = htmlToText(sectionsMatch[1]);
  }

  const titleMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (titleMatch) result.title = cleanText(titleMatch[1]);

  const locationMatch = html.match(/<div[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/div>/i) ||
                        html.match(/<span[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/span>/i);
  if (locationMatch) result.location = cleanText(locationMatch[1]);

  return result;
}

function parseAshby(html) {
  const result = { title: '', company: '', description: '', location: '' };

  const descMatch = html.match(/<div[^>]*class=["'][^"']*ashby-job-posting-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (descMatch) {
    result.description = htmlToText(descMatch[1]);
  }

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = cleanText(titleMatch[1]);

  return result;
}

function parseWorkday(html) {
  const result = { title: '', company: '', description: '', location: '' };

  const descMatch = html.match(/<div[^>]*data-automation-id=["'][^"']*jobPostingDescription[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (descMatch) {
    result.description = htmlToText(descMatch[1]);
  }

  const titleMatch = html.match(/<h2[^>]*data-automation-id=["'][^"']*jobPostingHeader[^"']*["'][^>]*>([^<]+)<\/h2>/i);
  if (titleMatch) result.title = cleanText(titleMatch[1]);

  return result;
}

function parseGeneric(html) {
  const result = { title: '', company: '', description: '', location: '' };

  // Try common job description containers
  const descPatterns = [
    /<div[^>]*class=["'][^"']*job[-_]?description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i
  ];

  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match) {
      const text = htmlToText(match[1]);
      if (text.length > 200) {
        result.description = text;
        break;
      }
    }
  }

  // If still no description, try to get body content minus nav/header/footer
  if (!result.description || result.description.length < 100) {
    let bodyHtml = html.replace(/<header[\s\S]*?<\/header>/gi, '');
    bodyHtml = bodyHtml.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    bodyHtml = bodyHtml.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      result.description = htmlToText(bodyMatch[1]);
    }
  }

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = cleanText(titleMatch[1]);

  return result;
}

function htmlToText(html) {
  if (!html) return '';

  // Remove scripts, styles, and hidden elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Convert elements to text with proper spacing
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, ' | ');
  text = text.replace(/<hr[^>]*>/gi, '\n---\n');

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
  text = text.replace(/&hellip;/g, '...');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
  text = text.replace(/&[a-z]+;/gi, ' ');

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
