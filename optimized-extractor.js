const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const API_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const OUTPUT_FILE = 'extracted_names.json';
const CONCURRENCY_LIMIT = 5;
const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';
const REQUEST_DELAY = 200; // ms between requests

// Statistics
let totalRequests = 0;
let uniqueNames = new Set();
let prefixesExplored = new Set();
let startTime = Date.now();

// Utility to add delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Throttle mechanism with exponential backoff
async function fetchWithThrottle(prefix, attempt = 1) {
  totalRequests++;
  
  try {
    const response = await axios.get(`${API_URL}?query=${encodeURIComponent(prefix)}`);
    return response.data;
  } catch (error) {
    // Handle rate limiting with exponential backoff
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

// Check if a prefix should be expanded further
function shouldExpandPrefix(prefix, results) {
  // If we got names back and prefix isn't too long, keep exploring
  if (results.length > 0 && prefix.length < 3) {
    return true;
  }
  
  // Special case: If we have many results with a short prefix, expand it
  if (results.length >= 10 && prefix.length <= 2) {
    return true;
  }
  
  return false;
}

// Process a prefix and decide whether to expand
async function processPrefix(prefix) {
  if (prefixesExplored.has(prefix)) return [];
  prefixesExplored.add(prefix);
  
  // Add some randomized delay to avoid predictable patterns
  await sleep(REQUEST_DELAY + Math.random() * 100);
  
  const results = await fetchWithThrottle(prefix);
  
  // Save all new names
  results.forEach(name => uniqueNames.add(name));
  
  // Log progress regularly
  if (totalRequests % 10 === 0 || results.length > 0) {
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`[${elapsedMinutes}m] Prefix: "${prefix}" found ${results.length} names. Total unique: ${uniqueNames.size}. Requests: ${totalRequests}`);
  }
  
  // Get prefixes to explore next
  const nextPrefixes = [];
  
  if (shouldExpandPrefix(prefix, results)) {
    for (const char of CHARACTERS) {
      nextPrefixes.push(prefix + char);
    }
  }
  
  return nextPrefixes;
}

// Track the last N request times for rate limiting analysis
const requestTimes = [];
function analyzeRatePattern() {
  if (requestTimes.length < 10) return;
  
  const intervals = [];
  for (let i = 1; i < requestTimes.length; i++) {
    intervals.push(requestTimes[i] - requestTimes[i-1]);
  }
  
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  // If average interval is too small, we might need to slow down
  if (avgInterval < 100) {
    console.log(`Warning: Average request interval is ${avgInterval.toFixed(2)}ms - consider slowing down requests`);
  }
}

// Process a batch of prefixes with controlled concurrency
async function processBatch(prefixes) {
  let nextBatch = [];
  
  // Process in smaller chunks to maintain controlled concurrency
  for (let i = 0; i < prefixes.length; i += CONCURRENCY_LIMIT) {
    const chunk = prefixes.slice(i, i + CONCURRENCY_LIMIT);
    
    // Process this chunk concurrently
    const results = await Promise.all(
      chunk.map(async prefix => {
        requestTimes.push(Date.now());
        if (requestTimes.length > 50) requestTimes.shift();
        
        analyzeRatePattern();
        return processPrefix(prefix);
      })
    );
    
    // Collect all new prefixes to explore
    nextBatch = nextBatch.concat(...results);
  }
  
  return nextBatch;
}

// Main extraction function
async function extractAllNames() {
  console.log('Starting name extraction process...');
  startTime = Date.now();
  
  // Start with single letters
  let currentBatch = CHARACTERS.split('');
  
  // Process batches until we run out of prefixes to explore
  while (currentBatch.length > 0) {
    currentBatch = await processBatch(currentBatch);
    
    // Display interim stats
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`Progress update: ${elapsedMinutes} minutes elapsed. Found ${uniqueNames.size} names. Made ${totalRequests} requests. Queue size: ${currentBatch.length}`);
  }
  
  // Save results to file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...uniqueNames], null, 2));
  
  const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
  console.log(`Extraction complete in ${elapsedMinutes} minutes!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${uniqueNames.size}`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
  
  // List some sample names as verification
  const sampleNames = [...uniqueNames].slice(0, 10);
  console.log('Sample of extracted names:', sampleNames);
}

// Additional API exploration functions
async function exploreAPIBehavior() {
  console.log('Exploring API behavior...');
  
  // Test with various prefixes to understand response patterns
  const testPrefixes = ['a', 'b', 'jo', 'ma', 'z', ''];
  
  for (const prefix of testPrefixes) {
    const results = await fetchWithThrottle(prefix);
    console.log(`Query "${prefix}" returned ${results.length} results`);
    
    if (results.length > 0) {
      console.log(`Sample results: ${results.slice(0, 3).join(', ')}...`);
    }
    
    await sleep(500);
  }
  
  // Check for maximum results per query
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

// Main function
async function main() {
  try {
    // First explore API behavior
    await exploreAPIBehavior();
    
    // Then extract all names
    await extractAllNames();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Start extraction
main();
