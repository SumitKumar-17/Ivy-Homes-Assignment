const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const OUTPUT_FILE = 'extracted_names.json';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const MAX_CONCURRENCY = 3;
const BASE_DELAY = 150;

let totalRequests = 0;
let uniqueNames = new Set();
let processedPrefixes = new Set();
let activeRequests = 0;
let startTime = Date.now();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(prefix, retryCount = 0) {
  totalRequests++;
  
  try {
    const response = await axios.get(`${API_URL}?query=${encodeURIComponent(prefix)}`);
    return response.data;
  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status === 503)) {
      if (retryCount >= 5) {
        console.log(`Too many retries for "${prefix}", skipping.`);
        return [];
      }
      
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`Rate limited for "${prefix}". Backing off for ${backoffTime}ms. Retry: ${retryCount + 1}`);
      await sleep(backoffTime);
      return makeRequest(prefix, retryCount + 1);
    }
    
    console.error(`Error for "${prefix}": ${error.message}`);
    return [];
  }
}

async function processPrefix(prefix) {
  if (processedPrefixes.has(prefix)) return [];
  processedPrefixes.add(prefix);
  
  await sleep(BASE_DELAY + Math.random() * 50);
  
  const results = await makeRequest(prefix);
  const newNames = results.filter(name => !uniqueNames.has(name));
  
  newNames.forEach(name => uniqueNames.add(name));
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[${elapsed}s] Prefix "${prefix}" - ${newNames.length} new names, total: ${uniqueNames.size}`);
  
  const nextPrefixes = [];
  
  if (results.length > 0) {
    if (prefix.length <= 2) {
      for (const char of ALPHABET) {
        nextPrefixes.push(prefix + char);
      }
    }
  }
  
  return nextPrefixes;
}

async function saveProgress() {
  const namesArray = Array.from(uniqueNames);
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(namesArray, null, 2)
  );
  console.log(`Progress saved: ${namesArray.length} names to ${OUTPUT_FILE}`);
}

async function extractNames() {
  const queue = ALPHABET.split('');
  
  console.log(`Starting extraction with ${queue.length} initial prefixes`);
  
  while (queue.length > 0) {
    const batch = [];
    
    while (batch.length < MAX_CONCURRENCY && queue.length > 0) {
      batch.push(queue.shift());
    }
    
    const nextPrefixesArrays = await Promise.all(
      batch.map(prefix => processPrefix(prefix))
    );
    
    const nextPrefixes = [].concat(...nextPrefixesArrays);
    queue.push(...nextPrefixes);
    
    if (totalRequests % 50 === 0) {
      saveProgress();
    }
    
    console.log(`Queue size: ${queue.length}, Processed: ${processedPrefixes.size}, Names: ${uniqueNames.size}`);
  }
  
  saveProgress();
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\nExtraction complete!`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Total names: ${uniqueNames.size}`);
  console.log(`Time taken: ${elapsed} minutes`);
}

async function main() {
  console.log('Starting name extraction from autocomplete API');
  startTime = Date.now();
  
  try {
    await extractNames();
  } catch (error) {
    console.error('Fatal error:', error);
    saveProgress();
  }
}

main();
