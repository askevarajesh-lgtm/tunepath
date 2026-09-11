require('dotenv').config();
const mongoose = require('mongoose');
const WorkspaceKeyword = require('../modules/seoWorkspace/models/workspaceKeyword.model');

async function migrateKeywords() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath');
  console.log('Connected.');

  console.log('Fetching keywords...');
  const keywords = await WorkspaceKeyword.find({});
  let migratedCount = 0;
  let candidateCount = 0;
  let unverifiedCount = 0;
  let serpCount = 0;
  let gscCount = 0;
  let gscSerpCount = 0;

  for (const kw of keywords) {
    let changed = false;

    // Ensure metrics object exists
    if (!kw.metrics) {
       kw.metrics = { searchVolume: 0, cpc: 0, keywordDifficulty: 0, competition: 0, intent: 'unknown' };
       changed = true;
    }

    // Determine evidence
    const hasSerpEvidence = kw.ranking && kw.ranking.currentRank != null && kw.ranking.currentRank > 0;
    const hasGscEvidence = kw.gsc && kw.gsc.averagePosition != null;

    if (hasSerpEvidence || hasGscEvidence) {
      kw.verificationStatus = 'VERIFIED_RANKING';
      
      if (hasSerpEvidence && hasGscEvidence) {
         kw.ranking.rankingSource = 'GSC_AND_SERP';
         gscSerpCount++;
      } else if (hasSerpEvidence) {
         kw.ranking.rankingSource = 'SERP';
         serpCount++;
      } else if (hasGscEvidence) {
         kw.ranking.rankingSource = 'GSC';
         gscCount++;
         // Rule B: currentRank MUST remain null unless independently verified by SERP
         kw.ranking.currentRank = null; 
      }
      changed = true;
    } else if (kw.source === 'NLP_CANDIDATE' || kw.source === 'keyword-research-agent') {
      kw.verificationStatus = 'CANDIDATE';
      candidateCount++;
      changed = true;
    } else {
      // Legacy keyword marked Ranking but no evidence -> UNVERIFIED
      // Never NOT_RANKING since it wasn't explicitly checked and failed.
      kw.verificationStatus = 'UNVERIFIED';
      unverifiedCount++;
      changed = true;
    }

    if (changed) {
      await kw.save();
      migratedCount++;
    }
  }

  console.log(`Migration Complete. Migrated ${migratedCount} keywords.`);
  console.log(`- SERP Verified: ${serpCount}`);
  console.log(`- GSC Verified: ${gscCount}`);
  console.log(`- GSC+SERP Verified: ${gscSerpCount}`);
  console.log(`- Candidates: ${candidateCount}`);
  console.log(`- Unverified: ${unverifiedCount}`);

  process.exit(0);
}

migrateKeywords().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
