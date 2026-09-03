const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Domain = require('../modules/domains/domain.model');
const Website = require('../modules/websites/website.model');
const Page = require('../modules/websites/page.model');

async function testDomainRouting() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Create Mock / Test Domain & Website
    const testDomainName = `test-custom-domain-${Date.now()}.com`;
    const mockWorkspaceId = new mongoose.Types.ObjectId();

    console.log(`Creating test website and domain: ${testDomainName}...`);
    
    const website = new Website({
      workspaceId: mockWorkspaceId,
      name: 'Test Custom Domain Site',
      description: 'A website to test custom domain routing',
      status: 'Published',
      theme: { fontFamily: 'Inter', primaryColor: '#10b981' }
    });
    await website.save();

    const homePage = new Page({
      websiteId: website._id,
      title: 'Home Page',
      path: '/',
      isHome: true,
      html: '<h1>Welcome to Custom Domain Test</h1>',
      css: 'h1 { color: #10b981; }'
    });
    await homePage.save();

    const aboutPage = new Page({
      websiteId: website._id,
      title: 'About Page',
      path: '/about',
      isHome: false,
      html: '<h1>About Us Page</h1>',
      css: 'h1 { color: #3b82f6; }'
    });
    await aboutPage.save();

    const domainDoc = new Domain({
      workspaceId: mockWorkspaceId,
      domain: testDomainName,
      propertyType: 'Website',
      propertyId: website._id,
      status: 'Connected',
      txtVerificationToken: 'test_token_123'
    });
    await domainDoc.save();

    website.domainId = domainDoc._id;
    await website.save();

    console.log(`Test environment setup complete. Domain ID: ${domainDoc._id}`);

    // 2. Test Normalization & Domain Resolution (simulate resolveWebsiteByDomain logic)
    async function simulateResolution(incomingDomain, incomingPath) {
      let domainStr = incomingDomain.trim().toLowerCase().split(':')[0];
      
      const reserved = ['localhost', '127.0.0.1', 'tunepath.askeva.io', 'm1.workforce.themilabs.com'];
      if (reserved.some(p => domainStr === p || domainStr.endsWith('.' + p))) {
        return { success: true, isPlatformDomain: true };
      }

      const domainVariants = [domainStr];
      if (domainStr.startsWith('www.')) {
        domainVariants.push(domainStr.replace(/^www\./, ''));
      } else {
        domainVariants.push(`www.${domainStr}`);
      }

      const foundDomain = await Domain.findOne({ domain: { $in: domainVariants }, isDeleted: { $ne: true } });
      if (!foundDomain) {
        return { success: false, status: 404, error: 'Website not found for domain' };
      }

      const foundWebsite = await Website.findOne({ _id: foundDomain.propertyId, isDeleted: false });
      if (!foundWebsite) {
        return { success: false, status: 404, error: 'Website record missing' };
      }

      let reqPath = incomingPath || '/';
      if (!reqPath.startsWith('/')) reqPath = '/' + reqPath;

      const pages = await Page.find({ websiteId: foundWebsite._id, isDeleted: false });
      let matched = null;
      if (reqPath === '/') {
        matched = pages.find(p => p.isHome) || pages.find(p => p.path === '/') || pages[0];
      } else {
        const cleanPath = reqPath.toLowerCase();
        matched = pages.find(p => p.path.toLowerCase() === cleanPath || ('/' + p.path.replace(/^\//, '')).toLowerCase() === cleanPath);
      }

      if (!matched) {
        return { success: false, status: 404, error: 'Page not found', website: foundWebsite };
      }

      return { success: true, website: foundWebsite, page: matched };
    }

    // Run Test Cases
    console.log('\n--- Running Test Cases ---');

    // Test Case 1: Exact Domain & Home Path
    const res1 = await simulateResolution(testDomainName, '/');
    console.log(`Test 1 (Exact Domain, Home Path): ${res1.success && res1.page?.title === 'Home Page' ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Test Case 2: WWW Variant & About Path
    const res2 = await simulateResolution(`www.${testDomainName}`, '/about');
    console.log(`Test 2 (WWW Variant, About Path): ${res2.success && res2.page?.title === 'About Page' ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Test Case 3: Case-insensitive & Port Stripping
    const res3 = await simulateResolution(`${testDomainName.toUpperCase()}:8080`, 'about');
    console.log(`Test 3 (Uppercase & Port, About Path): ${res3.success && res3.page?.title === 'About Page' ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Test Case 4: Platform Domain Check
    const res4 = await simulateResolution('tunepath.askeva.io', '/');
    console.log(`Test 4 (Platform Domain Check): ${res4.isPlatformDomain ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Test Case 5: Unknown Domain 404
    const res5 = await simulateResolution('unknown-random-domain-12345.com', '/');
    console.log(`Test 5 (Unknown Domain 404): ${!res5.success && res5.status === 404 ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Test Case 6: Unknown Page 404
    const res6 = await simulateResolution(testDomainName, '/non-existent-page');
    console.log(`Test 6 (Unknown Page 404): ${!res6.success && res6.error === 'Page not found' ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Cleanup Test Data
    console.log('\nCleaning up test data...');
    await Domain.deleteOne({ _id: domainDoc._id });
    await Website.deleteOne({ _id: website._id });
    await Page.deleteMany({ websiteId: website._id });
    console.log('Cleanup complete.');

    await mongoose.disconnect();
    console.log('\nAll custom domain routing tests finished cleanly!');

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

testDomainRouting();
