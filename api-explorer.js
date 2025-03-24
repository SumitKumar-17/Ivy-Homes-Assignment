const axios = require('axios');

const API_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function exploreQueryPatterns() {
  console.log('Exploring API query patterns...');
  
  const testQueries = [
    '',           
      'a',          
      'b',          
      'jo',         
      'john',       
      'z',          
      'zzz',        
      'a1',         
      '123',        
      '_',          
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
    
    await sleep(500);
  }
}

async function testRateLimiting() {
  console.log('\nTesting rate limiting behavior...');
  
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
      
      await sleep(1000);
    }
  }
  
  const successfulRequests = results.filter(r => r.status === 'success').length;
  const failedRequests = results.filter(r => r.status === 'error').length;
  
  console.log(`\nRate limiting analysis:`);
  console.log(`- Successful requests: ${successfulRequests} / 10`);
  console.log(`- Failed requests: ${failedRequests} / 10`);
  
  if (failedRequests > 0) {
    console.log('- API appears to have rate limiting');
    
    const failurePoints = results.findIndex(r => r.status === 'error');
    if (failurePoints > 0) {
      console.log(`- Rate limit triggered after ${failurePoints} requests`);
    }
  } else {
    console.log('- No rate limiting detected with rapid requests');
  }
}

async function testResultLimits() {
  console.log('\nTesting for result limits...');
  
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

async function exploreEndpoints() {
  console.log('\nExploring for additional endpoints or parameters...');
  
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

async function exploreAPI() {
  console.log('Starting API exploration...');
  
  await exploreQueryPatterns();
  await testRateLimiting();
  await testResultLimits();
  await exploreEndpoints();
  
  console.log('\nExploration complete!');
}

exploreAPI().catch(error => {
  console.error('Exploration failed:', error);
});
