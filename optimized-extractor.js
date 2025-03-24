const axios = require('axios');
const fs = require('fs').promises;

const API_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const OUTPUT_FILE = 'extracted_names.json';
const CONCURRENCY_LIMIT = 5;
const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';
const REQUEST_DELAY = 200; 

let totalRequests = 0;
let uniqueNames = new Set();
let prefixesExplored = new Set();
let startTime = Date.now();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithThrottle(prefix, attempt = 1) {
  totalRequests++;
  
  try {
    const response = await axios.get(`${API_URL}?query=${encodeURIComponent(prefix)}`);
    return response.data;
  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status === 503)) {
      const backoffTime = Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`Rate limited on "${prefix}". Backing off for ${backoffTime}ms. Attempt: ${attempt}`);
      await sleep(backoffTime);
      return fetchWithThrottle(prefix, attempt + 1);
    }
    
    console.error(`Error fetching data for "${prefix}": ${error.message}`);
    return [];
  }
}

function shouldExpandPrefix(prefix, results) {
  if (results.length > 0 && prefix.length < 3) {
    return true;
  }
  
  if (results.length >= 10 && prefix.length <= 2) {
    return true;
  }
  
  return false;
}

async function processPrefix(prefix) {
  if (prefixesExplored.has(prefix)) return [];
  prefixesExplored.add(prefix);
  
  await sleep(REQUEST_DELAY + Math.random() * 100);
  
  const results = await fetchWithThrottle(prefix);
  
  results.forEach(name => uniqueNames.add(name));
  
  if (totalRequests % 10 === 0 || results.length > 0) {
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`[${elapsedMinutes}m] Prefix: "${prefix}" found ${results.length} names. Total unique: ${uniqueNames.size}. Requests: ${totalRequests}`);
  }
  
  const nextPrefixes = [];
  
  if (shouldExpandPrefix(prefix, results)) {
    for (const char of CHARACTERS) {
      nextPrefixes.push(prefix + char);
    }
  }
  
  return nextPrefixes;
}

const requestTimes = [];
function analyzeRatePattern() {
  if (requestTimes.length < 10) return;
  
  const intervals = [];
  for (let i = 1; i < requestTimes.length; i++) {
    intervals.push(requestTimes[i] - requestTimes[i-1]);
  }
  
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  if (avgInterval < 100) {
    console.log(`Warning: Average request interval is ${avgInterval.toFixed(2)}ms - consider slowing down requests`);
  }
}

async function processBatch(prefixes) {
  let nextBatch = [];
  
  for (let i = 0; i < prefixes.length; i += CONCURRENCY_LIMIT) {
    const chunk = prefixes.slice(i, i + CONCURRENCY_LIMIT);
    
    const results = await Promise.all(
      chunk.map(async prefix => {
        requestTimes.push(Date.now());
        if (requestTimes.length > 50) requestTimes.shift();
        
        analyzeRatePattern();
        return processPrefix(prefix);
      })
    );
    
    nextBatch = nextBatch.concat(...results);
  }
  
  return nextBatch;
}

async function extractAllNames() {
  console.log('Starting name extraction process...');
  startTime = Date.now();
  
  let currentBatch = CHARACTERS.split('');
  
  while (currentBatch.length > 0) {
    currentBatch = await processBatch(currentBatch);
    
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`Progress update: ${elapsedMinutes} minutes elapsed. Found ${uniqueNames.size} names. Made ${totalRequests} requests. Queue size: ${currentBatch.length}`);
  }
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...uniqueNames], null, 2));
  
  const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
  console.log(`Extraction complete in ${elapsedMinutes} minutes!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${uniqueNames.size}`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
  
  const sampleNames = [...uniqueNames].slice(0, 10);
  console.log('Sample of extracted names:', sampleNames);
}

async function exploreAPIBehavior() {
  console.log('Exploring API behavior...');
  
  const testPrefixes = ['a', 'b', 'jo', 'ma', 'z', ''];
  
  for (const prefix of testPrefixes) {
    const results = await fetchWithThrottle(prefix);
    console.log(`Query "${prefix}" returned ${results.length} results`);
    
    if (results.length > 0) {
      console.log(`Sample results: ${results.slice(0, 3).join(', ')}...`);
    }
    
    await sleep(500);
  }
  
  const resultCounts = await Promise.all(
    testPrefixes.map(async prefix => {
      if (prefix === '') return 0;
      const results = await fetchWithThrottle(prefix);
      await sleep(500);
      return results.length;
    })
  );
  
  const maxCount = Math.max(...resultCounts.filter(count => count > 0));
  const prefixesWithMaxCount = testPrefixes.filter((prefix, i) => resultCounts[i] === maxCount && prefix !== '');
  
  if (prefixesWithMaxCount.length > 1) {
    console.log(`Multiple prefixes returned exactly ${maxCount} results, indicating a possible result limit.`);
  }
  
  console.log('API exploration complete. Starting full extraction...');
}

async function main() {
  try {
    await exploreAPIBehavior();
    
    await extractAllNames();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
