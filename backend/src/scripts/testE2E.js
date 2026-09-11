require('dotenv').config();
const mongoose = require('mongoose');
const WorkspaceProject = require('../modules/seoWorkspace/models/workspaceProject.model');
const WorkspaceKeyword = require('../modules/seoWorkspace/models/workspaceKeyword.model');
const WorkspaceAuditPage = require('../modules/seoWorkspace/models/workspaceAuditPage.model');
const keywordResearchAgent = require('../modules/seoWorkspace/services/keywordResearchAgent.service');

async function testE2E() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to DB');

  const project = await WorkspaceProject.findOne({});
  if (!project) {
    console.log('No project found');
    process.exit(1);
  }
  
  console.log(`Using Project: ${project.domain} (${project._id})`);

  // Clear existing keywords for clean test
  await WorkspaceKeyword.deleteMany({ projectId: project._id });

  console.log('\n--- Running Extraction ---');
  const result = await keywordResearchAgent.run(project._id, project.companyId || project.createdBy);

  console.log('\n--- Results ---');
  console.log(`Candidate Count from Agent: ${result.candidateCount}`);
  
  const pages = await WorkspaceAuditPage.find({ projectId: project._id });
  console.log(`Crawled pages available: ${pages.length}`);

  const allKeywords = await WorkspaceKeyword.find({ projectId: project._id }).lean();
  console.log(`Candidates persisted: ${allKeywords.length}`);

  const gscCount = allKeywords.filter(k => k.source === 'GSC').length;
  console.log(`GSC queries received: ${gscCount}`);
  
  const verifiedCount = allKeywords.filter(k => k.verificationStatus === 'VERIFIED_RANKING').length;
  console.log(`VERIFIED_RANKING keywords: ${verifiedCount}`);
  
  const checkedCount = allKeywords.filter(k => k.ranking && k.ranking.status).length;
  console.log(`SERP checked keywords: ${checkedCount}`);
  
  const serpVerifiedCount = allKeywords.filter(k => k.ranking && k.ranking.rankingSource === 'SERP').length;
  console.log(`SERP VERIFIED_RANKING keywords: ${serpVerifiedCount}`);

  const notRankingCount = allKeywords.filter(k => k.verificationStatus === 'NOT_RANKING').length;
  console.log(`NOT_RANKING keywords: ${notRankingCount}`);

  const unverifiedCount = allKeywords.filter(k => k.verificationStatus === 'UNVERIFIED').length;
  console.log(`UNVERIFIED keywords: ${unverifiedCount}`);

  const candidateCount = allKeywords.filter(k => k.verificationStatus === 'CANDIDATE').length;
  console.log(`CANDIDATE keywords: ${candidateCount}`);

  console.log('\n--- Sample Keywords (up to 10) ---');
  for (const k of allKeywords.slice(0, 10)) {
     console.log(`Keyword: ${k.keyword}`);
     console.log(`Status: ${k.status} | Verification: ${k.verificationStatus} | Source: ${k.source}`);
     console.log(`Source URLs: ${k.agent?.sourceUrls ? k.agent.sourceUrls.join(', ') : 'N/A'}`);
     console.log(`Supporting Elements: ${k.agent?.supportingElements ? k.agent.supportingElements.join(', ') : 'N/A'}`);
     console.log(`GSC Data: ${k.gsc?.averagePosition ? 'Avg Pos: ' + k.gsc.averagePosition : 'None'}`);
     console.log(`SERP Current Rank: ${k.ranking?.currentRank || 'N/A'} | Ranking URL: ${k.ranking?.url || 'N/A'}`);
     console.log(`Volume: ${k.metrics?.searchVolume || 'N/A'} | CPC: ${k.metrics?.cpc || 'N/A'} | KD: ${k.metrics?.keywordDifficulty || 'N/A'}`);
     console.log('---');
  }

  process.exit(0);
}

testE2E().catch(console.error);
