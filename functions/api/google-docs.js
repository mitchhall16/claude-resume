// Google Docs Export API
// Creates a new Google Doc with the resume content

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const { accessToken, resumeData } = await request.json();

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No access token provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a new Google Doc
    const docTitle = `Resume - ${resumeData.fullName} - ${resumeData.company} ${resumeData.title}`;

    // First, create an empty document
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: docTitle
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Create doc error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create document. Please check your Google account permissions.' }), {
        status: createResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const doc = await createResponse.json();
    const documentId = doc.documentId;

    // Build the document content using batchUpdate
    const requests = buildDocumentRequests(resumeData);

    // Apply the content to the document
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error('Update doc error:', error);
      // Document was created but content failed - still return the URL
    }

    return new Response(JSON.stringify({
      success: true,
      docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
      documentId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Google Docs API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function buildDocumentRequests(data) {
  const requests = [];
  let currentIndex = 1; // Google Docs index starts at 1

  // Helper to add text and track index
  const addText = (text, bold = false, fontSize = 11, color = null) => {
    if (!text) return;

    const endIndex = currentIndex + text.length;

    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: text
      }
    });

    const textStyle = {
      fontSize: { magnitude: fontSize, unit: 'PT' },
      bold: bold
    };

    if (color) {
      textStyle.foregroundColor = {
        color: { rgbColor: color }
      };
    }

    requests.push({
      updateTextStyle: {
        range: { startIndex: currentIndex, endIndex: endIndex },
        textStyle: textStyle,
        fields: 'fontSize,bold' + (color ? ',foregroundColor' : '')
      }
    });

    currentIndex = endIndex;
  };

  const addNewLine = () => {
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: '\n'
      }
    });
    currentIndex += 1;
  };

  const addSectionHeader = (title) => {
    addNewLine();
    addText(title.toUpperCase(), true, 12, { red: 0.15, green: 0.39, blue: 0.92 });
    addNewLine();
    // Add a horizontal line effect (using underscores or paragraph border would be better but keeping simple)
    addText('─'.repeat(60), false, 8);
    addNewLine();
  };

  // === HEADER ===
  // Name (centered, large, bold)
  addText(data.fullName || 'Your Name', true, 18);
  addNewLine();

  // Contact info
  const contactParts = [];
  if (data.email) contactParts.push(data.email);
  if (data.phone) contactParts.push(data.phone);
  if (data.location) contactParts.push(data.location);
  if (data.linkedin) contactParts.push(data.linkedin.replace('https://', ''));
  if (data.github) contactParts.push(data.github.replace('https://', ''));

  if (contactParts.length > 0) {
    addText(contactParts.join(' | '), false, 10);
    addNewLine();
  }

  // === SUMMARY ===
  if (data.summary) {
    addSectionHeader('Professional Summary');
    addText(data.summary, false, 11);
    addNewLine();
  }

  // === EXPERIENCE ===
  // Parse from the generated resume text
  if (data.resume) {
    const experienceContent = parseExperienceFromResume(data.resume);
    if (experienceContent) {
      addSectionHeader('Professional Experience');
      addText(experienceContent, false, 11);
      addNewLine();
    }
  }

  // === EDUCATION ===
  if (data.education && data.education.length > 0) {
    addSectionHeader('Education');
    data.education.forEach(edu => {
      addText(edu.degree, true, 11);
      if (edu.startYear || edu.endYear) {
        addText(` (${edu.startYear || ''} - ${edu.endYear || ''})`, false, 10);
      }
      addNewLine();
      addText(`${edu.school}${edu.location ? ', ' + edu.location : ''}`, false, 10);
      addNewLine();
      if (edu.gpa) {
        addText(`GPA: ${edu.gpa}`, false, 10);
        addNewLine();
      }
      addNewLine();
    });
  }

  // === SKILLS ===
  const allSkills = [
    ...(data.skills?.technical || []),
    ...(data.skills?.tools || [])
  ];
  if (allSkills.length > 0) {
    addSectionHeader('Skills');
    addText(allSkills.join(', '), false, 11);
    addNewLine();
  }

  // === PROJECTS ===
  if (data.projects && data.projects.length > 0) {
    addSectionHeader('Projects');
    data.projects.slice(0, 3).forEach(proj => {
      addText(proj.name, true, 11);
      if (proj.url) {
        addText(` - ${proj.url.replace('https://', '')}`, false, 10);
      }
      addNewLine();
      if (proj.shortDesc) {
        addText(proj.shortDesc, false, 10);
        addNewLine();
      }
      if (proj.technologies && proj.technologies.length > 0) {
        addText(`Technologies: ${proj.technologies.join(', ')}`, false, 10);
        addNewLine();
      }
      addNewLine();
    });
  }

  // === CERTIFICATIONS ===
  if (data.certs && data.certs.length > 0) {
    addSectionHeader('Certifications');
    data.certs.forEach(cert => {
      addText(`${cert.name} - ${cert.org}`, true, 11);
      if (cert.date) {
        addText(` (${cert.date})`, false, 10);
      }
      addNewLine();
    });
  }

  // === COVER LETTER (on new page if present) ===
  if (data.coverLetter) {
    // Add page break
    addNewLine();
    requests.push({
      insertPageBreak: {
        location: { index: currentIndex }
      }
    });
    currentIndex += 1;

    // Cover letter header
    addNewLine();
    addText(data.fullName || 'Your Name', true, 14);
    addNewLine();

    const clContactParts = [];
    if (data.email) clContactParts.push(data.email);
    if (data.phone) clContactParts.push(data.phone);
    if (data.location) clContactParts.push(data.location);
    if (clContactParts.length > 0) {
      addText(clContactParts.join(' | '), false, 10);
      addNewLine();
    }
    addNewLine();

    // Date
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    addText(dateStr, false, 11);
    addNewLine();
    addNewLine();

    // Company/Position
    if (data.company) {
      addText(data.company, true, 11);
      addNewLine();
    }
    if (data.title) {
      addText(`Re: ${data.title}`, false, 11);
      addNewLine();
    }
    addNewLine();

    // Cover letter body
    addText(data.coverLetter, false, 11);
    addNewLine();
  }

  return requests;
}

function parseExperienceFromResume(resumeText) {
  if (!resumeText) return '';

  const lines = resumeText.split('\n');
  let inExperience = false;
  let experienceLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (/^(EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE)/i.test(trimmed)) {
      inExperience = true;
      continue;
    }
    if (/^(EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|TECHNICAL SKILLS)/i.test(trimmed)) {
      inExperience = false;
      continue;
    }

    if (inExperience && trimmed) {
      experienceLines.push(trimmed);
    }
  }

  return experienceLines.join('\n');
}
