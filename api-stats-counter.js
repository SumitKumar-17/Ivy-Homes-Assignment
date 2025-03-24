const axios = require('axios');
const fs = require('fs');

async function countAPIStats(version) {
  const baseUrl = `http://35.200.185.69:8000/v${version}/autocomplete`;
  const outputFile = `v${version}_names.json`;
  let requestCount = 0;
  let uniqueNames = new Set();
  let processedPrefixes = new Set();

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function saveNamesToFile() {
    const namesArray = Array.from(uniqueNames).sort();
    fs.writeFileSync(
      outputFile,
      JSON.stringify(namesArray, null, 2)
    );
    console.log(`Saved ${namesArray.length} unique names to ${outputFile}`);
  }

  async function fetchNames(prefix) {
    requestCount++;
    try {
      const response = await axios.get(`${baseUrl}?query=${encodeURIComponent(prefix)}`);
      
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      } else if (response.data && typeof response.data === 'object') {
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
        let newNames = 0;
        const resultSet = new Set(); 
        results.forEach(name => {
          if (!resultSet.has(name)) {
            resultSet.add(name);
            
            if (!uniqueNames.has(name)) {
              uniqueNames.add(name);
              newNames++;
            }
          }
        });
        
        console.log(`[v${version}] Prefix: "${prefix}", Found: ${results.length}, New unique: ${newNames}, Total unique: ${uniqueNames.size}, Requests: ${requestCount}`);
        
        if (requestCount % 10 === 0) {
          saveNamesToFile();
        }
        
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
  
  saveNamesToFile();
  
  const duration = (Date.now() - startTime) / 1000 / 60;
  
  console.log(`\n=== API v${version} STATS ===`);
  console.log(`Total requests: ${requestCount}`);
  console.log(`Total unique names: ${uniqueNames.size}`);
  console.log(`Time taken: ${duration.toFixed(2)} minutes`);
  console.log(`All unique names saved to ${outputFile}`);
  
  return {
    version,
    requests: requestCount,
    namesCount: uniqueNames.size
  };
}

async function main() {
  try {
    const summaryFile = 'api_summary.txt';
    let summary = 'API AUTOCOMPLETE SUMMARY\n';
    summary += '======================\n\n';
    
    for (const version of [1, 2, 3]) {
      try {
        console.log(`\n============ TESTING API v${version} ============`);
        
        try {
          const testResponse = await axios.get(`http://35.200.185.69:8000/v${version}/autocomplete?query=a`);
          console.log(`API v${version} is working. Test response:`, testResponse.data);
        } catch (err) {
          console.log(`API v${version} might not exist. Error:`, err.message);
          if (err.response && err.response.status === 404) {
            console.log(`Skipping API v${version} (404 Not Found)`);
            
            summary += `=== FORM ANSWERS for v${version} ===\n`;
            summary += `No. of searches made for v${version}: 0 (API does not exist)\n`;
            summary += `No. of results in v${version}: 0 (API does not exist)\n\n`;
            
            continue;
          }
        }
        
        const stats = await countAPIStats(version);
        
        summary += `=== FORM ANSWERS for v${version} ===\n`;
        summary += `No. of searches made for v${version}: ${stats.requests}\n`;
        summary += `No. of results in v${version}: ${stats.namesCount}\n\n`;
        
        console.log(`\n=== FORM ANSWERS for v${version} ===`);
        console.log(`No. of searches made for v${version}: ${stats.requests}`);
        console.log(`No. of results in v${version}: ${stats.namesCount}`);
      } catch (err) {
        console.log(`Error processing v${version}: ${err.message}`);
        summary += `Error processing v${version}: ${err.message}\n`;
      }
    }
    
    fs.writeFileSync(summaryFile, summary);
    console.log(`\nSummary saved to ${summaryFile}`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();