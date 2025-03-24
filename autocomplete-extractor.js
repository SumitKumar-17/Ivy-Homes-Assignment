const axios = require('axios');
const fs = require('fs').promises;

// API configuration
const API_BASE_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const DELAY_MS = 100; // Delay between requests to avoid rate limiting
const MAX_CONCURRENT = 5; // Maximum concurrent requests
const OUTPUT_FILE = 'extracted_names.json';

// Track statistics
let totalRequests = 0;
let totalNames = new Set();
let requestQueue = [];
let activeRequests = 0;

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Make a request to the autocomplete API
async function makeAutocompleteRequest(query) {
  totalRequests++;
  try {
    const response = await axios.get(`${API_BASE_URL}?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error(`Error querying with "${query}": ${error.message}`);
    
    // If rate limited, retry after some time
    if (error.response && (error.response.status === 429 || error.response.status === 503)) {
      console.log(`Rate limited. Waiting before retrying "${query}"...`);
      await delay(2000); // Wait longer for rate limit
      return makeAutocompleteRequest(query);
    }
    
    return [];
  }
}

// Process the character prefix and handle queueing
async function processPrefix(prefix) {
  // Check if we need to wait for other requests
  while (activeRequests >= MAX_CONCURRENT) {
    await delay(50);
  }
  
  activeRequests++;
  
  try {
    const names = await makeAutocompleteRequest(prefix);
    
    // Add all new names to our set
    names.forEach(name => totalNames.add(name));
    
    console.log(`[${prefix}] Found ${names.length} names. Total unique names: ${totalNames.size}`);
    
    // If we have results and the prefix isn't too long, explore further
    if (names.length > 0 && prefix.length < 3) {
      // Add all possible next characters to the queue
      for (const char of 'abcdefghijklmnopqrstuvwxyz') {
        const newPrefix = prefix + char;
        requestQueue.push(newPrefix);
      }
    }
  } catch (error) {
    console.error(`Error processing prefix "${prefix}": ${error.message}`);
  } finally {
    activeRequests--;
  }
}

// Main function to extract all names
async function extractAllNames() {
  console.log('Starting name extraction process...');
  
  // Initialize with all single letters
  for (const char of 'abcdefghijklmnopqrstuvwxyz') {
    requestQueue.push(char);
  }
  
  // Process the queue
  while (requestQueue.length > 0) {
    const prefix = requestQueue.shift();
    await processPrefix(prefix);
    await delay(DELAY_MS); // Respect rate limits
  }
  
  // Save results to file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...totalNames], null, 2));
  
  console.log(`Extraction complete!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${totalNames.size}`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
}

// A more efficient version that uses a breadth-first search approach
async function extractNamesEfficiently() {
  console.log('Starting efficient name extraction process...');
  
  // Keep track of prefixes we've already processed
  const processedPrefixes = new Set();
  
  // Initialize with single letters
  const initialPrefixes = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  // Process in batches for efficiency
  let currentBatch = initialPrefixes;
  
  while (currentBatch.length > 0) {
    const nextBatch = [];
    
    // Process current batch with limited concurrency
    await Promise.all(
      currentBatch.map(async (prefix) => {
        if (processedPrefixes.has(prefix)) return;
        processedPrefixes.add(prefix);
        
        await delay(DELAY_MS); // Respect rate limits
        const results = await makeAutocompleteRequest(prefix);
        
        // Add all names to our collection
        results.forEach(name => totalNames.add(name));
        
        // If we got a full batch of results, we might need to refine further
        // This assumes API might be limiting results per query
        if (results.length >= 10) { // Assuming 10 as a possible limit
          for (const char of 'abcdefghijklmnopqrstuvwxyz') {
            nextBatch.push(prefix + char);
          }
        }
        
        console.log(`[${prefix}] Found ${results.length} names. Total: ${totalNames.size}`);
      })
    );
    
    currentBatch = nextBatch;
  }
  
  // Save results
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...totalNames], null, 2));
  
  console.log(`Extraction complete!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${totalNames.size}`);
}

// Binary search approach to find if there's a maximum number of results returned per query
async function determineAPILimits() {
  console.log('Determining API limits...');
  
  // Test with various letters to see response patterns
  const testLetters = ['a', 'b', 'c', 'd', 'e'];
  
  for (const letter of testLetters) {
    const results = await makeAutocompleteRequest(letter);
    console.log(`Query "${letter}" returned ${results.length} results`);
    await delay(500);
  }
  
  // Test if the API has pagination or result limits
  // Let's check if all queries return the same number of results
  const counts = await Promise.all(
    testLetters.map(async letter => {
      const results = await makeAutocompleteRequest(letter);
      await delay(500);
      return results.length;
    })
  );
  
  const allSameCount = counts.every(count => count === counts[0]);
  
  if (allSameCount) {
    console.log(`API seems to return exactly ${counts[0]} results per query - likely has a result limit`);
  } else {
    console.log(`API returns different numbers of results for different queries`);
  }
  
  // Check if there's a rate limit by making rapid requests
  console.log('Testing for rate limits...');
  let rateLimit = false;
  
  try {
    for (let i = 0; i < 10; i++) {
      await makeAutocompleteRequest('a');
    }
    console.log('No obvious rate limiting detected on rapid requests');
  } catch (error) {
    console.log('Rate limiting detected:', error.message);
    rateLimit = true;
  }
  
  return {
    possibleResultLimit: allSameCount ? counts[0] : null,
    hasRateLimit: rateLimit
  };
}

// Start the extraction process
async function main() {
  console.log('Starting API exploration...');
  
  // First determine API limits
  const limits = await determineAPILimits();
  console.log('API Limits:', limits);
  
  // Choose extraction strategy based on API behavior
  if (limits.possibleResultLimit) {
    console.log('Using efficient extraction method due to result limits');
    await extractNamesEfficiently();
  } else {
    console.log('Using standard extraction method');
    await extractAllNames();
  }
}

main().catch(console.error);
