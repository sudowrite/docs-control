# Documentation Orchestration System

AI-powered documentation maintenance system for Sudowrite. Automatically detects documentation that needs updating when product changes are announced.

## Features

- **Two-Stage AI Audit**: Keyword filtering + deep AI analysis for accuracy
- **Version Control**: Git-based documentation storage with full history
- **Full-Scroll Export**: Generate consolidated markdown for AI training
- **Featurebase Integration**: Sync with Featurebase help center
- **GitHub Automation**: Auto-create issues for documentation updates
- **Edit Links**: Direct links to Featurebase editor for quick fixes

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Featurebase API
FEATUREBASE_API_KEY=your-key-here
FEATUREBASE_HELP_CENTER_ID=your-help-center-id

# Anthropic API (for Claude Haiku 4.5)
ANTHROPIC_API_KEY=your-key-here

# GitHub (optional - for issue creation)
GITHUB_TOKEN=your-token-here
GITHUB_REPO=owner/repo
```

### 3. Run Your First Audit

```bash
npm run audit
```

## Commands

### Core Operations

- `npm run audit` - Run AI audit on sample changelog (V3 two-stage)
- `npm run export` - Generate full-scroll markdown export
- `npm run import` - Import from Notion export
- `npm run reconcile` - Compare local articles with Featurebase

### Testing

- `npm run test:audit` - Test V1 audit (baseline)
- `npm run test:audit:improved` - Test improved audit
- `npm run test:audit:v2` - Test Gemini-based audit
- `npm run test:audit:v3` - Test two-stage audit (default)
- `npm run test:keyword-filter` - Test keyword filtering alone
- `npm run test:webhook` - Test webhook endpoint locally

### Sync ✅ IMPLEMENTED

- `npm run sync:to-featurebase` - Push local changes to Featurebase
- `npm run sync:from-featurebase` - Pull updates from Featurebase
- `npm run generate:rollups` - Generate AI knowledge files (llms.txt + docs-rollup.md)

**Features:**
- Bidirectional sync with conflict detection
- Last-write-wins automatic resolution
- Both versions saved for manual review
- Incremental sync (only changed articles)
- Full sync state tracking
- Auto-generates AI knowledge files after sync

**See**: [SYNC-GUIDE.md](SYNC-GUIDE.md) for complete documentation

### AI Knowledge Files ✅ NEW

Two formats for AI training and knowledge sources:

**llms.txt** (156 lines)
- Structured index following [llmstxt.org](https://llmstxt.org/) standard
- Organized by collection/subcollection hierarchy
- Includes article URLs and descriptions
- Perfect for AI discovery and navigation
- Designed for web serving at `/llms.txt`

**docs-rollup.md** (4,155 lines)
- Complete documentation in single file
- All 78 articles with full content
- Organized by collection hierarchy
- Includes metadata (IDs, slugs, timestamps)
- Perfect for AI training and context loading
- Single-file knowledge base for upload to AI tools

Both files auto-regenerate after any sync operation and are committed to git.

## How It Works

### Two-Stage Audit (V3)

**Stage 1: Keyword Filtering**
- Extracts keywords from changelog (feature names, numbers, models)
- Scores all articles for relevance
- Filters to top 20 most relevant articles
- Reduces context from ~52K words to ~35K tokens

**Stage 2: AI Deep Dive**
- Passes filtered articles to Claude Haiku 4.5
- Identifies exact contradictions with quotes
- Flags incomplete lists (e.g., missing features)
- Returns actionable edit suggestions with URLs

### Why Two-Stage?

- ✅ **More accurate**: Focused context = fewer hallucinations
- ✅ **Catches more**: Found 5 articles vs 2 in V1
- ✅ **Scalable**: Works even with hundreds of articles
- ✅ **Cost-effective**: Only processes relevant articles

## Architecture

```
docs-control/
├── sudowrite-documentation/       # Main documentation folder (nested structure)
│   ├── getting-started/
│   │   ├── introduction/
│   │   └── sudowrite-manual/
│   ├── plans-and-account/
│   │   ├── sudowrite-plans/
│   │   ├── credits/
│   │   └── your-account/
│   ├── using-sudowrite/
│   │   ├── features/
│   │   ├── workflows/
│   │   ├── story-bible/
│   │   ├── story-smarts/
│   │   ├── plugins/
│   │   └── sudowrite-mobile-app/
│   ├── resources/
│   ├── frequently-asked-questions/
│   ├── legal-stuff/
│   ├── about-sudowrite/
│   ├── .sync-state.json      # Sync tracking (gitignored)
│   └── .conflicts/            # Conflict backups (gitignored)
├── lib/
│   ├── audit-engine-v3.js      # Two-stage audit (ACTIVE)
│   ├── keyword-filter.js       # Stage 1: keyword filtering
│   ├── featurebase-client.js   # Featurebase API wrapper
│   ├── featurebase-sync.js     # Bidirectional sync utilities
│   ├── collection-hierarchy.js # Collection ID mapping
│   └── github-client.js        # GitHub issue creation
├── scripts/
│   ├── sync-to-featurebase.js    # Push local changes
│   ├── sync-from-featurebase.js  # Pull remote changes
│   ├── generate-rollups.js       # Create AI knowledge files
│   └── test-audit-v3.js          # Test two-stage audit
├── api/
│   └── webhooks/
│       └── changelog.js        # Vercel webhook receiver (DEPLOYED)
├── llms.txt                    # AI-optimized index (156 lines)
└── docs-rollup.md              # Complete knowledge base (4,155 lines)
```

## Audit Output Example

```
1. Sudowrite Muse (sudowrite-muse)
   Edit: https://do.featurebase.app/help-center/.../articles/sudowrite-muse/edit
   Confidence: high
   Change Type: update
   Issue: Changelog states 'Rewrite now uses Muse' but docs don't list Rewrite
   Existing: "Muse is available in Draft, Write, and Expand..."
   Corrected: "Muse is available in Draft, Write, Expand, and Rewrite..."
```

## Webhook Integration ✅ DEPLOYED

The webhook is **live on Vercel** and ready to receive Featurebase changelog webhooks.

**Production Webhook URL:**
```
https://sw-docs-control.vercel.app/api/webhooks/changelog
```

**Next Steps:**
1. Configure webhook in Featurebase (see [FEATUREBASE-WEBHOOK-SETUP.md](FEATUREBASE-WEBHOOK-SETUP.md))
2. Set webhook URL to the production URL above
3. Test with a changelog publication

**Testing:**
```bash
# Test webhook locally
npm run test:webhook

# Test production webhook
curl -X POST https://sw-docs-control.vercel.app/api/webhooks/changelog \
  -H "Content-Type: application/json" \
  -d '{"id":"test","title":"Test","content":"Test content","publishedAt":"2026-01-15T12:00:00Z","url":"https://example.com","tags":[]}'
```

**Documentation:**
- [Vercel Deployment Guide](VERCEL-DEPLOYMENT.md)
- [Featurebase Webhook Setup](FEATUREBASE-WEBHOOK-SETUP.md)
- [Deployment Summary](DEPLOYMENT-SUMMARY.md)

## Development

### Adding New Audit Engines

Create a new file in `lib/audit-engine-vX.js`:

```javascript
export async function runAudit(changelogEntry) {
  // Your audit logic here
  return {
    affected_articles: [...],
    summary: "..."
  };
}
```

### Customizing Keyword Extraction

Edit `lib/keyword-filter.js` to adjust:
- `extractKeywords()` - What terms to extract
- `scoreArticle()` - How to score relevance
- `minScore` - Threshold for filtering

## License

MIT
