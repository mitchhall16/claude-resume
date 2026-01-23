# Claude Resume

AI-Powered ATS Resume Builder that tailors your resume for every job application.

![Claude Resume](https://img.shields.io/badge/Powered%20by-Claude%20AI-blueviolet)
![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-orange)

## Features

- **AI Resume Tailoring** - Automatically customizes your resume for each job description
- **ATS Optimization** - Ensures your resume passes Applicant Tracking Systems
- **Batch Processing** - Compare your fit across 3-5 jobs simultaneously
- **Resume Library** - Save and manage multiple resume versions
- **Application Tracking** - Track status (Applied → Interviewing → Offered)
- **LinkedIn Import** - Import your profile data from LinkedIn export
- **Recruiter Assessment** - Get AI feedback from a recruiter's perspective

## Architecture

```mermaid
flowchart TB
    subgraph "Frontend (index.html)"
        UI[Tab-Based UI]
        State[State Object]
        LocalStorage[localStorage]
    end

    subgraph "Cloudflare Pages"
        subgraph "Functions (Workers)"
            Parse[/api/parse]
            Generate[/api/generate]
            Batch[/api/batch/process]
            Save[/api/user/save]
            Load[/api/user/load]
            ResumesSave[/api/resumes/save]
            ResumesList[/api/resumes/list]
            AppUpdate[/api/applications/update]
        end
        KV[(Cloudflare KV)]
    end

    subgraph "External Services"
        Claude[Claude API]
        Google[Google OAuth]
    end

    UI --> State
    State <--> LocalStorage
    UI --> Parse & Generate & Batch
    UI --> Save & Load
    UI --> ResumesSave & ResumesList & AppUpdate
    Parse & Generate & Batch --> Claude
    Save & Load & ResumesSave & ResumesList --> KV
    UI --> Google
```

## User Workflow

```mermaid
flowchart TD
    Start([User Opens App]) --> Auth{Logged In?}
    Auth -->|No| Login[Google OAuth Login]
    Auth -->|Yes| Dashboard[Dashboard Tab]
    Login --> Dashboard

    Dashboard --> Import[Import Data]
    Dashboard --> Edit[Edit Profile/Experience]
    Dashboard --> Generate[Generate Resume]
    Dashboard --> Batch[Batch Processing]
    Dashboard --> Library[Resume Library]

    subgraph "Data Import Options"
        Import --> Paste[Paste Resume Text]
        Import --> LinkedIn[Upload LinkedIn ZIP]
        Import --> Manual[Manual Entry]
        Paste --> AIparse[AI Parse to Structured Data]
        LinkedIn --> ZIPparse[Extract CSV Data]
        AIparse --> PopulateState
        ZIPparse --> PopulateState
        Manual --> PopulateState[Populate State]
    end

    subgraph "Single Resume Generation"
        Edit --> Profile[Profile Tab]
        Edit --> Experience[Experience Tab]
        Edit --> Skills[Skills Tab]
        Profile --> GenTab[Generate Tab]
        Experience --> GenTab
        Skills --> GenTab
        GenTab --> JobDesc[Paste Job Description]
        JobDesc --> CallClaude[Call Claude API]
        CallClaude --> FiveStep[5-Step Process]
        FiveStep --> Results[Display Results]
        Results --> ATSscore[ATS Score]
        Results --> Keywords[Matched/Missing Keywords]
        Results --> Tailored[Tailored Resume]
        Results --> Recruiter[Recruiter Assessment]
    end

    subgraph "Batch Processing"
        Batch --> MultiJob[Enter 3-5 Job Descriptions]
        MultiJob --> BatchAPI[/api/batch/process]
        BatchAPI --> ParallelGen[Generate All in Parallel]
        ParallelGen --> Compare[Side-by-Side Comparison]
        Compare --> Rank[Rank by Fit Score]
    end

    subgraph "Resume Library"
        Library --> SaveVersion[Save Resume Version]
        Library --> ViewHistory[View All Versions]
        Library --> TrackApps[Track Applications]
        SaveVersion --> LibraryKV[(KV Storage)]
        ViewHistory --> LibraryKV
        TrackApps --> AppStatus[Update Status]
    end
```

## 5-Step Resume Generation Process

```mermaid
flowchart LR
    subgraph "Step 1: Job Analysis"
        JD[Job Description] --> Extract[Extract Keywords]
        Extract --> Required[Required Skills]
        Extract --> Preferred[Preferred Skills]
    end

    subgraph "Step 2: Experience Mining"
        Experience[User Experience] --> Score[Relevance Scoring]
        Score --> Tech[Technical 40%]
        Score --> Resp[Responsibility 30%]
        Score --> Industry[Industry 20%]
        Score --> Impact[Impact 10%]
    end

    subgraph "Step 3: Company Context"
        JD --> Infer[Infer Context]
        Infer --> Priorities[Strategic Priorities]
        Infer --> Culture[Cultural Values]
    end

    subgraph "Step 4: Content Optimization"
        Score --> Rewrite[Rewrite Content]
        Priorities --> Rewrite
        Rewrite --> Summary[Tailored Summary]
        Rewrite --> Bullets[Optimized Bullets]
    end

    subgraph "Step 5: Recruiter Analysis"
        Summary --> Assessment[Full Assessment]
        Bullets --> Assessment
        Assessment --> FitScore[Fit Score 0-100]
        Assessment --> Gaps[Gap Analysis]
    end
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Hosting | Cloudflare Pages |
| API | Cloudflare Workers (Functions) |
| Storage | Cloudflare KV |
| AI | Claude API (claude-3-5-sonnet) |
| Auth | Google OAuth |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/parse` | POST | Parse resume text to structured data |
| `/api/generate` | POST | Generate tailored resume (single job) |
| `/api/user/save` | POST | Save user profile data |
| `/api/user/load` | GET | Load user profile data |
| `/api/batch/process` | POST | Process multiple jobs in parallel |
| `/api/resumes/save` | POST | Save resume version to library |
| `/api/resumes/list` | GET/POST | List or get single resume |
| `/api/resumes/delete` | POST | Delete saved resume |
| `/api/applications/update` | POST | Update application status/notes |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/mitchhall16/claude-resume.git
cd claude-resume
```

### 2. Create KV namespace

```bash
wrangler kv namespace create RESUME_DATA
# Copy the ID to wrangler.toml
```

### 3. Set API key

```bash
wrangler pages secret put ANTHROPIC_API_KEY --project=claude-resume
```

### 4. Deploy

```bash
wrangler pages deploy . --project-name=claude-resume
```

## LinkedIn Data Import

To import your LinkedIn data:

1. Go to **LinkedIn → Settings → Data Privacy**
2. Click **Get a copy of your data**
3. Select **"Download larger data archive"** (not the fast basic one)
4. Wait for email (10 min - 24 hours)
5. Upload the ZIP file in the app

The full export includes: `Profile.csv`, `Positions.csv`, `Education.csv`, `Skills.csv`

## Skill Package

This project includes a portable skill package (`skill/`) following Anthropic's framework:

```
skill/
├── SKILL.md                    # Main skill instructions
├── references/
│   ├── ats-optimization.md     # ATS keyword strategies
│   ├── recruiter-patterns.md   # What recruiters look for
│   └── bullet-formulas.md      # Achievement bullet templates
└── scripts/
    └── score_resume.py         # ATS scoring algorithm
```

Can be used with Claude Desktop or Claude.ai Projects.

## License

MIT
