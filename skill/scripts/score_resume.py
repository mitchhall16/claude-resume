#!/usr/bin/env python3
"""
ATS Resume Scoring Algorithm
Calculates a compatibility score between a resume and job description.
"""

import re
import json
from collections import Counter
from typing import Dict, List, Tuple, Set


def extract_keywords(text: str) -> Set[str]:
    """Extract meaningful keywords from text."""
    # Remove common stop words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'that', 'this', 'these', 'those', 'it', 'its', 'we', 'you', 'they',
        'their', 'our', 'your', 'who', 'which', 'what', 'where', 'when', 'why',
        'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
        'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
        'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
        'about', 'above', 'after', 'again', 'against', 'any', 'because',
        'before', 'being', 'below', 'between', 'during', 'into', 'once',
        'out', 'over', 'through', 'under', 'until', 'up', 'while',
        # Resume-specific stop words
        'experience', 'work', 'job', 'position', 'role', 'responsibilities',
        'ability', 'skills', 'years', 'year', 'strong', 'excellent', 'good',
        'team', 'working', 'knowledge', 'including', 'using', 'used', 'etc',
        'based', 'within', 'across', 'various', 'multiple', 'new', 'high',
        'ensure', 'provide', 'support', 'including', 'related', 'required'
    }

    # Extract words (keep compound words and acronyms)
    words = re.findall(r'\b[A-Za-z][A-Za-z0-9+#.-]*\b', text.lower())

    # Filter and clean
    keywords = set()
    for word in words:
        if len(word) > 2 and word not in stop_words:
            keywords.add(word)

    return keywords


def extract_technical_terms(text: str) -> Set[str]:
    """Extract technical terms and acronyms."""
    # Common technical terms pattern (includes compound words with periods/dashes)
    patterns = [
        r'\b[A-Z]{2,}(?:\.[A-Z]+)*\b',  # Acronyms: AWS, GCP, CI/CD
        r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b',  # CamelCase: JavaScript, PostgreSQL
        r'\b[a-z]+(?:-[a-z]+)+\b',  # kebab-case: node-js, vue-router
        r'\b[a-z]+(?:_[a-z]+)+\b',  # snake_case: scikit_learn
        r'\b[A-Za-z]+\d+\b',  # With versions: Python3, ES6, OAuth2
    ]

    terms = set()
    for pattern in patterns:
        matches = re.findall(pattern, text)
        terms.update(match.lower() for match in matches)

    return terms


def calculate_keyword_match(job_keywords: Set[str], resume_keywords: Set[str]) -> Tuple[float, Set[str], Set[str]]:
    """Calculate keyword match percentage."""
    matched = job_keywords.intersection(resume_keywords)
    missing = job_keywords - resume_keywords

    if not job_keywords:
        return 100.0, set(), set()

    match_percentage = (len(matched) / len(job_keywords)) * 100
    return match_percentage, matched, missing


def score_experience_relevance(
    experience: List[Dict],
    job_keywords: Set[str],
    job_technical: Set[str]
) -> List[Dict]:
    """Score each experience item for relevance."""
    scored = []

    for exp in experience:
        exp_text = f"{exp.get('title', '')} {exp.get('company', '')} {' '.join(exp.get('bullets', []))}"
        exp_keywords = extract_keywords(exp_text)
        exp_technical = extract_technical_terms(exp_text)

        # Calculate component scores
        keyword_overlap = len(exp_keywords.intersection(job_keywords))
        technical_overlap = len(exp_technical.intersection(job_technical))

        # Check for quantified achievements
        metrics_pattern = r'\b\d+[%$KMB]?\b|\b\$[\d,]+\b|\b\d+(?:\.\d+)?x\b'
        has_metrics = len(re.findall(metrics_pattern, exp_text)) > 0

        # Calculate weighted score (0-10)
        score = min(10, (
            (keyword_overlap * 0.4) +
            (technical_overlap * 0.8) +
            (3 if has_metrics else 0)
        ))

        scored.append({
            'title': exp.get('title', 'Unknown'),
            'company': exp.get('company', 'Unknown'),
            'score': round(score, 1),
            'matched_keywords': list(exp_keywords.intersection(job_keywords))[:5],
            'matched_technical': list(exp_technical.intersection(job_technical))[:5]
        })

    # Sort by score
    scored.sort(key=lambda x: x['score'], reverse=True)
    return scored


def calculate_ats_score(
    job_description: str,
    resume: Dict
) -> Dict:
    """
    Calculate comprehensive ATS score.

    Args:
        job_description: Full text of job posting
        resume: Dict with profile, experience, skills, education

    Returns:
        Dict with score breakdown and recommendations
    """
    # Extract keywords from job description
    job_keywords = extract_keywords(job_description)
    job_technical = extract_technical_terms(job_description)

    # Build resume text
    resume_parts = []

    # Profile/Summary
    profile = resume.get('profile', {})
    resume_parts.append(profile.get('summary', ''))

    # Experience
    for exp in resume.get('experience', []):
        resume_parts.append(exp.get('title', ''))
        resume_parts.append(exp.get('company', ''))
        resume_parts.extend(exp.get('bullets', []))

    # Skills
    skills = resume.get('skills', {})
    resume_parts.extend(skills.get('technical', []))
    resume_parts.extend(skills.get('tools', []))
    resume_parts.extend(skills.get('soft', []))

    # Education
    for edu in resume.get('education', []):
        resume_parts.append(edu.get('degree', ''))
        resume_parts.append(edu.get('school', ''))
        resume_parts.append(edu.get('extras', ''))

    # Certifications
    for cert in resume.get('certs', []):
        resume_parts.append(cert.get('name', ''))
        resume_parts.append(cert.get('org', ''))

    resume_text = ' '.join(resume_parts)
    resume_keywords = extract_keywords(resume_text)
    resume_technical = extract_technical_terms(resume_text)

    # Calculate keyword match
    keyword_score, matched_keywords, missing_keywords = calculate_keyword_match(
        job_keywords, resume_keywords
    )

    # Calculate technical match
    tech_score, matched_tech, missing_tech = calculate_keyword_match(
        job_technical, resume_technical
    )

    # Score experience relevance
    experience_scores = score_experience_relevance(
        resume.get('experience', []),
        job_keywords,
        job_technical
    )

    # Calculate overall score (weighted average)
    overall_score = int(
        (keyword_score * 0.35) +
        (tech_score * 0.45) +
        (min(100, sum(e['score'] * 10 for e in experience_scores[:3]) / 3) * 0.20)
    )

    # Cap at 100
    overall_score = min(100, max(0, overall_score))

    return {
        'overall_score': overall_score,
        'keyword_match': round(keyword_score, 1),
        'technical_match': round(tech_score, 1),
        'matched_keywords': list(matched_keywords)[:20],
        'missing_keywords': list(missing_keywords)[:10],
        'matched_technical': list(matched_tech)[:15],
        'missing_technical': list(missing_tech)[:10],
        'experience_relevance': experience_scores,
        'recommendations': generate_recommendations(
            overall_score, missing_keywords, missing_tech, experience_scores
        )
    }


def generate_recommendations(
    score: int,
    missing_keywords: Set[str],
    missing_tech: Set[str],
    experience_scores: List[Dict]
) -> List[str]:
    """Generate actionable recommendations based on analysis."""
    recs = []

    if score < 60:
        recs.append("Consider adding more keywords from the job description to your resume")

    if missing_tech:
        top_missing = list(missing_tech)[:3]
        recs.append(f"Add these technical skills if you have them: {', '.join(top_missing)}")

    if experience_scores:
        top_exp = experience_scores[0]
        if top_exp['score'] < 5:
            recs.append("Your experience may not closely match this role - consider highlighting transferable skills")

    if len(missing_keywords) > len(missing_tech):
        recs.append("Your technical skills match well, but consider using more industry terminology from the job posting")

    if not recs:
        recs.append("Your resume is well-matched to this role - focus on quantifying achievements")

    return recs


def main():
    """CLI interface for the scoring tool."""
    import sys

    if len(sys.argv) < 3:
        print("Usage: python score_resume.py <job_description.txt> <resume.json>")
        print("\nResume JSON format:")
        print(json.dumps({
            "profile": {"summary": "..."},
            "experience": [{"title": "...", "company": "...", "bullets": ["..."]}],
            "skills": {"technical": ["..."], "tools": ["..."]},
            "education": [{"degree": "...", "school": "..."}],
            "certs": [{"name": "...", "org": "..."}]
        }, indent=2))
        sys.exit(1)

    # Read job description
    with open(sys.argv[1], 'r') as f:
        job_description = f.read()

    # Read resume
    with open(sys.argv[2], 'r') as f:
        resume = json.load(f)

    # Calculate score
    result = calculate_ats_score(job_description, resume)

    # Output result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
