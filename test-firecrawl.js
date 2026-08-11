// Test script untuk Firecrawl API
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const FIRECRAWL_API_KEY = envVars.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
  console.error('❌ FIRECRAWL_API_KEY tidak ditemukan di .env.local');
  process.exit(1);
}

console.log('🔑 API Key ditemukan:', FIRECRAWL_API_KEY.substring(0, 10) + '...');

// Test 1: Scrape URL
async function testScrape() {
  console.log('\n📄 Test 1: Scrape URL');
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown'],
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Scrape gagal:', response.status, data);
      return false;
    }

    console.log('✅ Scrape berhasil!');
    console.log('   URL:', data.data?.url);
    console.log('   Content preview:', data.data?.markdown?.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Test 2: Search
async function testSearch() {
  console.log('\n🔍 Test 2: Search');
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: 'artificial intelligence',
        limit: 3,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Search gagal:', response.status, data);
      return false;
    }

    console.log('✅ Search berhasil!');
    console.log(`   Ditemukan ${data.data?.length || 0} hasil`);
    if (data.data && data.data.length > 0) {
      console.log('   Hasil pertama:', data.data[0].url);
    }
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Test 3: Check credits/quota
async function testCredits() {
  console.log('\n💳 Test 3: Check Credits');
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Check credits gagal:', response.status, data);
      return false;
    }

    console.log('✅ Account info berhasil diambil!');
    console.log('   Credits remaining:', data.credits_remaining || 'N/A');
    console.log('   Plan:', data.plan || 'N/A');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Memulai test Firecrawl API...\n');
  console.log('='.repeat(50));
  
  const results = {
    scrape: await testScrape(),
    search: await testSearch(),
    credits: await testCredits(),
  };

  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Hasil Test:');
  console.log('   Scrape:', results.scrape ? '✅ PASS' : '❌ FAIL');
  console.log('   Search:', results.search ? '✅ PASS' : '❌ FAIL');
  console.log('   Credits:', results.credits ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log('\n' + (allPassed ? '✅ Semua test PASSED!' : '❌ Ada test yang FAILED'));
}

runTests();
