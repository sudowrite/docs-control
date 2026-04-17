# Sync Fix - Session Notes

**Date:** January 15, 2026
**Status:** ✅ CRITICAL FIXES COMPLETED - System Ready for Testing

---

## Problems Identified

### Issue 1: Only 10 Articles Syncing (Should be 71+)
- **Root Cause:** Featurebase API call missing `limit` parameter
- **Default behavior:** API returns only 10 articles without explicit limit
- **Expected:** 71 articles total across all collections

### Issue 2: Articles Have No Content
- **Root Cause:** Sync was looking for `content` field, but Featurebase uses `body`
- **Content format:** HTML in the `body` field that needs conversion to Markdown
- **Result:** Articles only had frontmatter metadata, no actual article text

### Issue 3: No Collection Organization
- **Root Cause:** Original sync used flat file structure
- **Expected:** Organized by collection structure matching Featurebase
- **Collections:** Features, Story Bible, Credits, Plugins, etc.

---

## Solutions Implemented

### 1. Updated Core Sync Library (`lib/featurebase-sync.js`)

**New Functions Added:**
```javascript
extractArticleContent(article)  // Extracts body field and converts HTML to Markdown
titleToFilename(title)          // Clean filename generation
collectionToFolderName(name)    // Clean folder names for collections
```

**Modified Functions:**
- `generateLocalPath()` - Now supports collection folder organization
- `createLocalArticle()` - Uses extractArticleContent() and accepts collectionName
- `updateLocalArticle()` - Uses extractArticleContent() and accepts collectionName
- `writeLocalArticle()` - Ensures directories exist, adds collection_name to frontmatter
- `scanLocalArticles()` - Recursively scans collection folders

### 2. Created New Sync Script (`scripts/sync-from-featurebase-v2.js`)

**Key Features:**
- Fetches ALL articles with `limit: 100` parameter (gets 71 articles)
- Fetches all collections and builds ID-to-name mapping
- Properly extracts HTML `body` content
- Converts HTML to Markdown using Turndown
- Organizes files into collection folders
- Groups sync results by collection in output

**Process Flow:**
1. Test Featurebase connection
2. Fetch all collections (21 total)
3. Build collection map: `{ id: "5442133" -> name: "Features" }`
4. Fetch all articles with pagination (`limit: 100`)
5. For each article:
   - Determine collection from `parentId`
   - Extract HTML body and convert to Markdown
   - Create/update file in appropriate collection folder
6. Save sync state with hashes for conflict detection

### 3. Updated Configuration

**package.json:**
```json
"sync:from-featurebase": "node scripts/sync-from-featurebase-v2.js"
```

**.gitignore:**
- Excludes `.sync-state.json` (local tracking only)
- Excludes `.conflicts/` directory
- Excludes `INDEX.md` (auto-generated)
- Excludes old structure (`docs-source/`, `notion-export/`)

---

## Current State

### ✅ Successfully Synced
- **Total Articles:** 71 (up from 10)
- **Total Size:** 480KB of documentation content
- **All Content:** Full HTML converted to Markdown

### 📁 Folder Structure
```
sudowrite-documentation/
├── classes/                    (1 article)
├── community/                  (3 articles)
├── credits/                    (5 articles)
├── features/                   (14 articles) ⭐ Including Write, Rewrite, Describe
├── introduction/               (2 articles)
├── plugins/                    (4 articles)
├── story-bible/               (10 articles) ⭐ Including Characters, Synopsis
├── story-smarts/              (6 articles)
├── sudowrite-manual/          (4 articles)
├── sudowrite-plans/           (5 articles)
├── workflows/                 (5 articles)
├── your-account/              (2 articles)
└── [10 root-level articles]   (FAQ, Legal, Contact, etc.)
```

### 🔍 Sample Articles Verified
- `features/write.md` - 16KB, full content with images
- `story-bible/characters.md` - Complete documentation
- `features/visualize.md` - Full content
- All articles have proper frontmatter + markdown content

### 💾 Git Status
- **Commit:** `7f8d55c` - "Fix Featurebase sync: Pull ALL articles with full content"
- **Files Changed:** 66 files, 4,315 insertions
- **Pushed to GitHub:** ✅ https://github.com/sudowrite/docs-control

---

## Featurebase API Details

### Collections Endpoint
```javascript
client.getCollections({ help_center_id, limit: 100 })
```

**Response Structure:**
- `data[]` - Array of collection objects
- Each collection has: `id`, `name`, `description`, `slug`, `parentId`

**Collections Found (21 total):**
- Getting Started (0585229)
- Plans & Account (4351287)
- Resources (9276699)
- Using Sudowrite (1670181)
- Legal Stuff (9077729)
- About Sudowrite (9257617)
- Introduction (7475072)
- Sudowrite Manual (6149413)
- Sudowrite Plans (6550900)
- Credits (5445363)
- Your Account (4304666)
- Features (5442133) ⭐
- Workflows (5279540)
- Story Bible (9773420) ⭐
- Story Smarts (5566496)
- Plugins (2165317)
- Classes (5844132)
- Community (8291256)
- Frequently Asked Questions (4621459)
- The Fine Print (4964533)
- More About Us (8861565)

### Articles Endpoint
```javascript
client.getArticles({ help_center_id, limit: 100 })
```

**Response Structure:**
- `data[]` - Array of article objects
- `nextCursor` - For pagination (if more than limit)

**Key Article Fields:**
- `id` - Unique article ID
- `title` - Article title
- `slug` - URL slug
- `body` - **HTML content** (this is the main content!)
- `description` - Short description
- `parentId` - Collection ID
- `updatedAt` - Last modified timestamp
- `createdAt` - Creation timestamp
- `helpCenterId` - Help center ID
- `state` - "live" or "draft"
- `isPublished` - Boolean

**Important:**
- Content is in `body` field as HTML
- Must use Turndown to convert HTML → Markdown
- Default limit is 10, must specify `limit: 100` for more

---

## Testing Performed

### ✅ Debug Script Results
Created `scripts/debug-featurebase-api.js` to test API:
- **Test 1:** Default params → 10 articles
- **Test 2:** Collections fetch → 21 collections (some titles undefined)
- **Test 3:** `limit: 100` → 71 articles ✅
- **Test 4:** Single article fetch → Full content in `body` field ✅

### ✅ Sync Test Results
Ran `npm run sync:from-featurebase`:
```
✅ Connected to Featurebase
📚 Found 21 collections
📄 Found 71 remote articles

⬇️  Pulled:    20 articles (updated existing)
📝 Created:   41 articles (new files)
⏭️  Skipped:   10 articles (unchanged)
⚠️  Conflicts: 0 articles
❌ Errors:    0 articles
```

### ✅ Content Verification
- Checked `features/write.md` - Full content present (16KB)
- Checked `story-bible/characters.md` - Complete with images
- Checked `features/brainstorm.md` - Full content
- All verified articles have proper HTML→Markdown conversion

---

## Known Limitations & Notes

### Pagination
- Current implementation uses `limit: 100`
- If Featurebase grows beyond 100 articles per collection, will need to implement cursor-based pagination
- API provides `nextCursor` field for this purpose

### Collections
- Some collection names come back as `undefined` in initial list
- Names are properly extracted from `translations.en.name` field
- Not all collections have articles yet (e.g., "Getting Started" has 0 articles)

### Sync State
- `.sync-state.json` tracks last sync time and content hashes
- Used for conflict detection (last-write-wins)
- Excluded from git (local tracking only)

### Images
- Images are Featurebase CDN URLs with expiring signatures
- URLs include `X-Amz-Expires=3600` (1 hour expiry)
- May need to handle image downloads/hosting in future

---

## Next Steps

### Immediate Testing Needed
1. **Test Bidirectional Sync**
   - Edit an article in Featurebase UI
   - Run `npm run sync:from-featurebase`
   - Verify changes appear locally
   - Commit to GitHub

2. **Test Push Sync**
   - Edit a local markdown file
   - Run `npm run sync:to-featurebase`
   - Verify changes appear in Featurebase UI
   - (May need to update push script for new structure)

3. **Test Conflict Resolution**
   - Edit same article in both places
   - Run sync and verify conflict detection
   - Check `.conflicts/` folder for backups

### Improvements for Later

#### High Priority
- [ ] Update `sync-to-featurebase.js` to work with collection folders
- [ ] Test full bidirectional workflow end-to-end
- [ ] Implement cursor-based pagination for 100+ articles
- [ ] Add progress indicators for large syncs

#### Medium Priority
- [ ] Handle image downloads (optional - CDN URLs work fine)
- [ ] Add dry-run mode to preview changes before syncing
- [ ] Improve conflict resolution UI/workflow
- [ ] Add article search/filtering commands

#### Low Priority
- [ ] Generate collection README files
- [ ] Create visual sync dashboard (web UI)
- [ ] Add sync scheduling/automation
- [ ] Implement incremental sync (only changed articles)

---

## Commands Reference

### Sync Commands
```bash
# Pull all articles from Featurebase (updated version)
npm run sync:from-featurebase

# Push local changes to Featurebase (may need updates)
npm run sync:to-featurebase

# Run audit on sample changelog
npm run audit
```

### Debug Commands
```bash
# Debug API responses
node scripts/debug-featurebase-api.js

# Debug collections
node scripts/debug-collections.js

# Test webhook locally
npm run test:webhook
```

### Git Workflow
```bash
# After syncing from Featurebase
git status
git add sudowrite-documentation/
git commit -m "Sync from Featurebase: [description]"
git push

# After local edits
git add sudowrite-documentation/
npm run sync:to-featurebase
git commit -m "Update documentation: [description]"
git push
```

---

## File Reference

### Modified Files
- `lib/featurebase-sync.js` - Core sync library with new functions
- `package.json` - Updated sync command to use v2 script
- `.gitignore` - Excludes sync state and old structures

### New Files
- `scripts/sync-from-featurebase-v2.js` - Improved sync script
- `scripts/debug-featurebase-api.js` - API testing script
- `scripts/debug-collections.js` - Collection debugging script
- `sudowrite-documentation/**/*.md` - 61 new article files in collection folders

### Unchanged (but relevant)
- `lib/featurebase-client.js` - API client (working as-is)
- `scripts/sync-to-featurebase.js` - Push script (may need updates)
- `api/webhooks/changelog.js` - Webhook endpoint (deployed)
- `.env` - API credentials (not in git)

---

## Success Metrics

### ✅ Completed Goals
- [x] Pull ALL 71 articles (not just 10)
- [x] Extract full article content from HTML body
- [x] Convert HTML to Markdown properly
- [x] Organize by collection structure
- [x] Use clean, readable filenames
- [x] Commit and push to GitHub
- [x] Verify content in multiple articles

### 🎯 System Ready For
- Editing articles locally and syncing to Featurebase
- Pulling updates from Featurebase after team edits
- Version control all documentation changes via git
- Automated audits when changelog webhooks fire

---

## Questions to Resolve

### Before Production Use
1. Should we sync to Featurebase immediately or wait for manual approval?
2. How should we handle image hosting (keep CDN URLs vs download)?
3. Do we need staging/preview before pushing to live docs?
4. Should conflicts require manual resolution or auto-resolve?

### For Future Planning
1. Who will be editing documentation? (Just you, or team members too?)
2. What's the desired workflow? (Edit in GitHub vs Featurebase?)
3. Should sync be automatic or manual?
4. Do we need notifications when docs are updated?

---

## Contact & Resources

**GitHub Repo:** https://github.com/sudowrite/docs-control
**Vercel Deploy:** https://sw-docs-control.vercel.app
**Webhook URL:** https://sw-docs-control.vercel.app/api/webhooks/changelog
**Featurebase API Docs:** https://docs.featurebase.app/rest-api/help-centers

**Last Session:** January 15, 2026
**Next Session:** Ready to test bidirectional sync workflow
