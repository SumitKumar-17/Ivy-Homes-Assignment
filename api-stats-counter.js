const axios = require('axios');

async function countAPIStats(version) {
  const baseUrl = `http://35.200.185.69:8000/v${version}/autocomplete`;
  let requestCount = 0;
  let uniqueNames = new Set();
  let processedPrefixes = new Set();

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchNames(prefix) {
    requestCount++;
    try {
      const response = await axios.get(`${baseUrl}?query=${encodeURIComponent(prefix)}`);
      // Extract the results array from the response
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      } else if (response.data && typeof response.data === 'object') {
        console.log(`Got response with structure:`, Object.keys(response.data));
        return response.data.results || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error(`Error fetching ${prefix}: ${error.message}`);
      if (error.response && [429, 503].includes(error.response.status)) {
        console.log(`Rate limited, waiting 2 seconds...`);
        await delay(2000);
        return fetchNames(prefix);
      }
      return [];
    }
  }

  async function exploreAllPrefixes() {
    const queue = 'abcdefghijklmnopqrstuvwxyz'.split('');
    
    while (queue.length > 0) {
      const prefix = queue.shift();
      
      if (processedPrefixes.has(prefix)) continue;
      processedPrefixes.add(prefix);
      
      await delay(200);
      console.log(`Checking prefix: ${prefix}`);
      const results = await fetchNames(prefix);
      
      if (Array.isArray(results)) {
        results.forEach(name => uniqueNames.add(name));
        
        console.log(`[v${version}] Prefix: ${prefix}, Found: ${results.length}, Total unique: ${uniqueNames.size}, Requests: ${requestCount}`);
        
        if (results.length > 0 && prefix.length < 3) {
          for (const char of 'abcdefghijklmnopqrstuvwxyz') {
            const newPrefix = prefix + char;
            if (!processedPrefixes.has(newPrefix)) {
              queue.push(newPrefix);
            }
          }
        }
      } else {
        console.log(`Warning: Received non-array results for prefix "${prefix}"`);
      }
    }
  }

  console.log(`Starting API v${version} exploration...`);
  const startTime = Date.now();
  
  await exploreAllPrefixes();
  
  const duration = (Date.now() - startTime) / 1000 / 60;
  
  console.log(`\n=== API v${version} STATS ===`);
  console.log(`Total requests: ${requestCount}`);
  console.log(`Total unique names: ${uniqueNames.size}`);
  console.log(`Time taken: ${duration.toFixed(2)} minutes`);
  
  return {
    version,
    requests: requestCount,
    namesCount: uniqueNames.size
  };
}

async function main() {
  try {
    // Test with a simple request first to see response structure
    const testResponse = await axios.get('http://35.200.185.69:8000/v1/autocomplete?query=a');
    console.log('Response structure:', testResponse.data);
    
    // Count stats for all versions
    for (const version of [1, 2, 3]) {
      try {
        const stats = await countAPIStats(version);
        console.log(`\n=== FORM ANSWERS for v${version} ===`);
        console.log(`No. of searches made for v${version}: ${stats.requests}`);
        console.log(`No. of results in v${version}: ${stats.namesCount}`);
      } catch (err) {
        console.log(`Error processing v${version}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();