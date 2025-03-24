const axios = require('axios');

const API_URL = 'http://35.200.185.69:8000/v1/autocomplete';

// Utility to add delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test different query patterns
async function exploreQueryPatterns() {
  console.log('Exploring API query patterns...');
  
  const testQueries = [
    '',           // Empty query
    'a',          // Single letter
    'b',          // Another single letter
    'jo',         // Two letters
    'john',       // Common name
    'z',          // Less common letter
    'zzz',        // Unlikely prefix
    'a1',         // Letter + number
    '123',        // Numbers only
    '_',          // Special character
  ];
  
  for (const query of testQueries) {
    try {
      const response = await axios.get(`${API_URL}?query=${encodeURIComponent(query)}`);
      console.log(`Query: "${query}" | Status: ${response.status} | Results: ${response.data.length}`);
      
      if (response.data.length > 0) {
        console.log(`Sample results: ${response.data.slice(0, 3).join(', ')}...`);
      }
    } catch (error) {
      console.log(`Query: "${query}" | Error: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status} | Message: ${error.response.statusText}`);
      }
    }
    
    // Add delay between requests
    await sleep(500);
  }
}

// Test rate limiting behavior
async function testRateLimiting() {
  console.log('\nTesting rate limiting behavior...');
  
  // Make 10 rapid requests
  const results = [];
  
  for (let i = 0; i < 10; i++) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${API_URL}?query=a`);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results.push({
        attempt: i + 1,
        status: 'success',
        duration,
        resultCount: response.data.length
      });
      
      console.log(`Request #${i + 1}: Success in ${duration}ms | Results: ${response.data.length}`);
      
      // No delay to test rate limiting
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results.push({
        attempt: i + 1,
        status: 'error',
        duration,
        error: error.message
      });
      
      console.log(`Request #${i + 1}: Failed in ${duration}ms | Error: ${error.message}`);
      
      // Add delay after error
      await sleep(1000);
    }
  }
  
  // Analyze rate limiting pattern
  const successfulRequests = results.filter(r => r.status === 'success').length;
  const failedRequests = results.filter(r => r.status === 'error').length;
  
  console.log(`\nRate limiting analysis:`);
  console.log(`- Successful requests: ${successfulRequests} / 10`);
  console.log(`- Failed requests: ${failedRequests} / 10`);
  
  if (failedRequests > 0) {
    console.log('- API appears to have rate limiting');
    
    // Calculate average time to failure
    const failurePoints = results.findIndex(r => r.status === 'error');
    if (failurePoints > 0) {
      console.log(`- Rate limit triggered after ${failurePoints} requests`);
    }
  } else {
    console.log('- No rate limiting detected with rapid requests');
  }
}

// Test result limit patterns
async function testResultLimits() {
  console.log('\nTesting for result limits...');
  
  // Test common first letters that likely have many names
  const commonLetters = ['a', 'b', 'c', 'j', 'm', 's'];
  const resultCounts = {};
  
  for (const letter of commonLetters) {
    try {
      const response = await axios.get(`${API_URL}?query=${letter}`);
      resultCounts[letter] = response.data.length;
      console.log(`Letter "${letter}" returned ${response.data.length} results`);
    } catch (error) {
      console.log(`Letter "${letter}" query failed: ${error.message}`);
    }
    
    await sleep(500);
  }
  
  // Analyze if there's a consistent result limit
  const counts = Object.values(resultCounts);
  const maxCount = Math.max(...counts);
  const lettersWithMaxCount = Object.keys(resultCounts).filter(letter => resultCounts[letter] === maxCount);

  if (lettersWithMaxCount.length > 1) {
    console.log(`\nFound ${lettersWithMaxCount.length} letters all returning exactly ${maxCount} results:`);
    console.log(lettersWithMaxCount.join(', '));
    console.log('This suggests a result limit of approximately', maxCount);
  } else {
    console.log('\nNo consistent result limit detected across different queries');
  }
}

// Test pagination or alternative endpoints
async function exploreEndpoints() {
  console.log('\nExploring for additional endpoints or parameters...');
  
  // Test potential pagination parameters
  const paginationParams = [
    'limit=20',
    'offset=10',
    'page=2',
    'count=20',
    'max=20'
  ];
  
  for (const param of paginationParams) {
    try {
      const response = await axios.get(`${API_URL}?query=a&${param}`);
      console.log(`Parameter "${param}" | Status: ${response.status} | Results: ${response.data.length}`);
    } catch (error) {
      console.log(`Parameter "${param}" | Error: ${error.message}`);
    }
    
    await sleep(500);
  }
  
  // Test for other endpoint variations
  const endpointVariations = [
    '/v1/autocomplete/count?query=a',
    '/v1/search?query=a',
    '/v1/suggest?query=a',
    '/v1/names?query=a',
    '/v1/autocomplete/all'
  ];
  
  for (const endpoint of endpointVariations) {
    try {
      const response = await axios.get(`http://35.200.185.69:8000${endpoint}`);
      console.log(`Endpoint "${endpoint}" | Status: ${response.status} | Type: ${typeof response.data}`);
    } catch (error) {
      console.log(`Endpoint "${endpoint}" | Error: ${error.message}`);
    }
    
    await sleep(500);
  }
}

// Run all exploration tests
async function exploreAPI() {
  console.log('Starting API exploration...');
  
  // Run tests
  await exploreQueryPatterns();
  await testRateLimiting();
  await testResultLimits();
  await exploreEndpoints();
  
  console.log('\nExploration complete!');
}

exploreAPI().catch(error => {
  console.error('Exploration failed:', error);
});
