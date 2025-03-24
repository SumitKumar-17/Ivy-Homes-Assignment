const axios = require('axios');
const fs = require('fs').promises;

const API_BASE_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const DELAY_MS = 100; 
const MAX_CONCURRENT = 5; 
const OUTPUT_FILE = 'extracted_names.json';

let totalRequests = 0;
let totalNames = new Set();
let requestQueue = [];
let activeRequests = 0;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAutocompleteRequest(query) {
  totalRequests++;
  try {
    const response = await axios.get(`${API_BASE_URL}?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error(`Error querying with "${query}": ${error.message}`);
    
    if (error.response && (error.response.status === 429 || error.response.status === 503)) {
      console.log(`Rate limited. Waiting before retrying "${query}"...`);
      await delay(2000); 
      return makeAutocompleteRequest(query);
    }
    
    return [];
  }
}

async function processPrefix(prefix) {
  while (activeRequests >= MAX_CONCURRENT) {
    await delay(50);
  }
  
  activeRequests++;
  
  try {
    const names = await makeAutocompleteRequest(prefix);
    
    names.forEach(name => totalNames.add(name));
    
    console.log(`[${prefix}] Found ${names.length} names. Total unique names: ${totalNames.size}`);
    
    if (names.length > 0 && prefix.length < 3) {
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

async function extractAllNames() {
  console.log('Starting name extraction process...');
  
  for (const char of 'abcdefghijklmnopqrstuvwxyz') {
    requestQueue.push(char);
  }
  
  while (requestQueue.length > 0) {
    const prefix = requestQueue.shift();
    await processPrefix(prefix);
    await delay(DELAY_MS); 
     }
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...totalNames], null, 2));
  
  console.log(`Extraction complete!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${totalNames.size}`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
}

async function extractNamesEfficiently() {
  console.log('Starting efficient name extraction process...');
  
  const processedPrefixes = new Set();
  
  const initialPrefixes = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  let currentBatch = initialPrefixes;
  
  while (currentBatch.length > 0) {
    const nextBatch = [];
    
    await Promise.all(
      currentBatch.map(async (prefix) => {
        if (processedPrefixes.has(prefix)) return;
        processedPrefixes.add(prefix);
        
        await delay(DELAY_MS);
        const results = await makeAutocompleteRequest(prefix);
        
        results.forEach(name => totalNames.add(name));
        
        if (results.length >= 10) { 
          for (const char of 'abcdefghijklmnopqrstuvwxyz') {
            nextBatch.push(prefix + char);
          }
        }
        
        console.log(`[${prefix}] Found ${results.length} names. Total: ${totalNames.size}`);
      })
    );
    
    currentBatch = nextBatch;
  }
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify([...totalNames], null, 2));
  
  console.log(`Extraction complete!`);
  console.log(`Total API requests made: ${totalRequests}`);
  console.log(`Total unique names extracted: ${totalNames.size}`);
}

async function determineAPILimits() {
  console.log('Determining API limits...');
  
  const testLetters = ['a', 'b', 'c', 'd', 'e'];
  
  for (const letter of testLetters) {
    const results = await makeAutocompleteRequest(letter);
    console.log(`Query "${letter}" returned ${results.length} results`);
    await delay(500);
  }
  
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

async function main() {
  console.log('Starting API exploration...');
  

  const limits = await determineAPILimits();
  console.log('API Limits:', limits);
  
  if (limits.possibleResultLimit) {
    console.log('Using efficient extraction method due to result limits');
    await extractNamesEfficiently();
  } else {
    console.log('Using standard extraction method');
    await extractAllNames();
  }
}

main().catch(console.error);
