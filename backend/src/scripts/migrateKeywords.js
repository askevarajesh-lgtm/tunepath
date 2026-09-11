const mongoose = require('mongoose');
const WorkspaceKeyword = require('../modules/seoWorkspace/models/workspaceKeyword.model');

/**
 * Migration script for legacy SEO Workspace Keywords.
 * Aligns legacy `verificationStatus` to the new strict evidence-based rules.
 * 
 * Safe to run multiple times (idempotent).
 * Use --dry-run to preview changes without modifying the database.
 */
async function migrateKeywords() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('[MIGRATION] Running in DRY-RUN mode. No data will be modified.');
  } else {
    console.log('[MIGRATION] Running in APPLY mode. Modifying data...');
  }

  let verifiedCount = 0;
  let candidateCount = 0;
  let unverifiedCount = 0;

  try {
    if (isDryRun) {
      console.log('Dry-run does not perform actual updates. Run without --dry-run to apply.');
      return;
    }

    // 1. Valid SERP evidence -> VERIFIED_RANKING
    const serpResult = await WorkspaceKeyword.updateMany(
      { 
        'ranking.currentRank': { $ne: null },
        'ranking.status': 'FOUND',
        verificationStatus: { $ne: 'VERIFIED_RANKING' }
      },
      { $set: { verificationStatus: 'VERIFIED_RANKING', 'ranking.rankingSource': 'SERP' } }
    );
    verifiedCount += serpResult.modifiedCount;

    // 2. Valid GSC evidence -> VERIFIED_RANKING
    const gscResult = await WorkspaceKeyword.updateMany(
      { 
        'gsc.averagePosition': { $ne: null },
        verificationStatus: { $ne: 'VERIFIED_RANKING' }
      },
      { $set: { verificationStatus: 'VERIFIED_RANKING' } }
    );
    verifiedCount += gscResult.modifiedCount;

    // 3. AI/NLP/Provider suggestion without ranking evidence -> CANDIDATE
    const candidateResult = await WorkspaceKeyword.updateMany(
      { 
        $and: [
          { 'ranking.currentRank': null },
          { 'gsc.averagePosition': null },
          { source: { $in: ['NLP_CANDIDATE', 'discovery_crawler', 'DataForSEO'] } },
          { verificationStatus: { $nin: ['CANDIDATE', 'NOT_RANKING'] } } // Never overwrite NOT_RANKING
        ]
      },
      { $set: { verificationStatus: 'CANDIDATE' } }
    );
    candidateCount += candidateResult.modifiedCount;

    // 4. Legacy records without reliable evidence -> UNVERIFIED
    const unverifiedResult = await WorkspaceKeyword.updateMany(
      { 
        $and: [
          { 'ranking.currentRank': null },
          { 'gsc.averagePosition': null },
          { source: { $nin: ['NLP_CANDIDATE', 'discovery_crawler', 'DataForSEO'] } },
          { verificationStatus: { $nin: ['UNVERIFIED', 'NOT_RANKING', 'CANDIDATE', 'VERIFIED_RANKING'] } }
        ]
      },
      { $set: { verificationStatus: 'UNVERIFIED' } }
    );
    unverifiedCount += unverifiedResult.modifiedCount;

    // NOT_RANKING is never inferred from missing data, only from active SERP checks.

    console.log('--------------------------------------------------');
    console.log('Migration Complete.');
    console.log(`Updated to VERIFIED_RANKING: ${verifiedCount}`);
    console.log(`Updated to CANDIDATE:        ${candidateCount}`);
    console.log(`Updated to UNVERIFIED:       ${unverifiedCount}`);
    console.log('--------------------------------------------------');

  } catch (err) {
    console.error('Migration failed:', err);
  }
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  require('../config/db')().then(async () => {
    await migrateKeywords();
    process.exit(0);
  });
}

module.exports = migrateKeywords;
