// generate.js
exports.handler = async function (event) {

  // Log whether the API key is present (never log the actual key)
  console.log('ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);

  // Always return JSON — helper used throughout
  function jsonResponse(statusCode, obj) {
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set');
    return jsonResponse(500, { error: 'Server configuration error: API key not set. Add ANTHROPIC_API_KEY to your Netlify environment variables.' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (parseErr) {
    console.error('ERROR: Failed to parse request body:', parseErr.message);
    return jsonResponse(400, { error: 'Invalid JSON in request body' });
  }

  const { who, problem, solution } = body;
  if (!who || !problem || !solution) {
    console.error('ERROR: Missing fields. Received:', Object.keys(body));
    return jsonResponse(400, { error: 'Missing required fields: who, problem, solution' });
  }

  console.log('Calling Anthropic API...');

  const prompt =
    'You are an expert lead magnet copywriter.\n\n' +
    'Create a complete written lead magnet for:\n' +
    'Audience: ' + who + '\n' +
    'Problem: ' + problem + '\n' +
    'Solution: ' + solution + '\n\n' +
    'Write the FULL lead magnet including:\n' +
    '- A compelling title (mark it with a single # at the start of the line)\n' +
    '- An opening hook paragraph\n' +
    '- 3 to 5 complete sections, each with a ## heading and full written content\n' +
    '- A strong call to action at the end\n\n' +
    'Format rules: use # for the main title, ## for section headings, ### for any sub-headings, ' +
    '--- on its own line for a visual divider, **text** for bold emphasis, and - for bullet list items.\n\n' +
    'Write it ready to publish. Warm, friendly tone. No jargon. Talk like you\'re explaining to a 5th grader.';

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1100,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch (fetchErr) {
    console.error('ERROR: Network request to Anthropic failed:', fetchErr.message);
    return jsonResponse(502, { error: 'Failed to reach Anthropic API: ' + fetchErr.message });
  }

  console.log('Anthropic API response status:', response.status);

  // Read the raw response body once so we can inspect it regardless of content type
  let rawBody;
  try {
    rawBody = await response.text();
  } catch (readErr) {
    console.error('ERROR: Could not read Anthropic response body:', readErr.message);
    return jsonResponse(502, { error: 'Could not read response from Anthropic API' });
  }

  console.log('Anthropic raw response (first 300 chars):', rawBody.slice(0, 300));

  // Parse the body as JSON — if it fails, surface the raw text for debugging
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (jsonErr) {
    console.error('ERROR: Anthropic response was not valid JSON. Raw body:', rawBody.slice(0, 500));
    return jsonResponse(502, {
      error: 'Anthropic API returned an unexpected response (not JSON). Status: ' + response.status,
      detail: rawBody.slice(0, 300)
    });
  }

  if (!response.ok) {
    console.error('ERROR: Anthropic API error response:', data);
    return jsonResponse(response.status, {
      error: (data.error && data.error.message) ? data.error.message : 'Anthropic API error',
      detail: data
    });
  }

  const text = (data.content || []).map(function(b) { return b.text || ''; }).join('');
  if (!text) {
    console.error('ERROR: Anthropic returned OK but content was empty. Full response:', data);
    return jsonResponse(500, { error: 'No content returned from Claude' });
  }

  console.log('Success — lead magnet generated, length:', text.length);
  return jsonResponse(200, { result: text });
};
