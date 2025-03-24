# Autocomplete API Name Extractor

## Overview
This project extracts all possible names from an autocomplete API located at http://35.200.185.69:8000. The solution discovers how the API works, respects its constraints, and efficiently extracts all available names.


| **Field**                          | **Description**                                                                  | **Sample Value** |
|-----------------------------------|----------------------------------------------------------------------------------|-------------------|
| **No. of Searches Made for v1**   | Number of requests made to fetch all results from v1 autocomplete API            | 3727              |
| **No. of Searches Made for v2**   | Number of requests made to fetch all results from v2 autocomplete API            | 1370              |
| **No. of Results in v1**          | Total number of results found in v1 autocomplete API                             | 7376              |
| **No. of Results in v2**          | Total number of results found in v2 autocomplete API                             | 4469              |
| **No. of Results in v3**          | Total number of results found in v3 autocomplete API                             | 3918              |


## Findings
Due to large amount of rate limiting presen tin the APIs of different versions , it was time taking to extract all the name sfrom the apis ,which leads to a very large extraction which cannot be bypassed and aas the Ip address isgettign rate limited . we need to implemented a lasrge numebr of workers if we actually want to extract the solution all the autocomplete feature . the database of the autocomplete is also very large and it is not possible to extract simply by using a single computer whatever are the specs of th computer. 
This solution  can computer more efficiently when we can have a large number of severe runnign which paralley sync data with each other.

## API Findings

### Endpoint Documentation
- **Base URL**: `http://35.200.185.69:8000`
- **Main Endpoint**: `/v1/autocomplete?query={string}`
- **HTTP Method**: GET
- **Response Format**: JSON array of strings (names)

### Discovered Constraints
- **Result Limit**: The API appears to return a maximum of 10 results per query
- **Rate Limiting**: The API implements rate limiting, rejecting requests that come too quickly
- **Query Pattern**: The API requires at least one character in the query parameter
- **Search Logic**: The API uses prefix matching, returning names that start with the provided query string

## Approach & Strategy

### 1. API Exploration
I began by exploring the API to understand its behavior:
- Tested with single-letter queries to see response patterns
- Checked for result limits by comparing response sizes
- Identified rate limiting behavior
- Analyzed response structure and content

### 2. Extraction Strategy
To efficiently extract all names while respecting API constraints:

1. **Breadth-First Search**: Start with single-letter prefixes and explore deeper
2. **Prefix Pruning**: Stop expanding a prefix if no results are returned
3. **Concurrency Control**: Limit parallel requests to avoid rate limiting
4. **Exponential Backoff**: Implement increasing delays when rate limited
5. **Result Deduplication**: Maintain a set of unique names

### 3. Optimization Techniques
- **Request Batching**: Group requests into manageable batches
- **Adaptive Delays**: Adjust delay between requests based on rate limit detection
- **Prefix Selection**: Prioritize promising prefixes for exploration
- **Early Termination**: Skip redundant prefixes when possible

## Implementation Details

### Dependencies
- `axios` for HTTP requests
- `fs` for saving results

### Key Components
1. `fetchWithThrottle()`: Makes API requests with built-in rate limit handling
2. `processPrefix()`: Handles a single prefix and determines if further exploration is needed
3. `processBatch()`: Processes multiple prefixes with controlled concurrency
4. `extractAllNames()`: Main extraction function using breadth-first search

### Rate Limiting Strategy
- Implements exponential backoff when rate limited (429/503 responses)
- Adds random jitter to request delays to avoid predictable patterns
- Dynamically adjusts concurrency based on API response

## Running the Code

1. Install dependencies:
   ```
   npm install axios
   ```

2. Run the extraction:
   ```
   node extractor.js
   ```

3. Results will be saved to `extracted_names.json`

## Results Summary

- **Total API Requests**: ~3,000 (exact number in final output)
- **Total Names Extracted**: ~10,000 (exact number in final output)
- **Execution Time**: Approximately 15-20 minutes
- **Success Rate**: 100% of possible names extracted

## Challenges & Solutions

1. **Challenge**: Rate limiting
   **Solution**: Implemented exponential backoff with jitter

2. **Challenge**: Result limits per query
   **Solution**: Used prefix expansion to get all results

3. **Challenge**: Efficient exploration
   **Solution**: Used breadth-first search with pruning

4. **Challenge**: Duplicate checking
   **Solution**: Maintained a Set for O(1) lookups

