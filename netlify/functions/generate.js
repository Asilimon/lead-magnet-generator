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
    'You are an expert direct-response content strategist and educational writer.\n' +
    'Your job is to create a COMPLETE, polished, high-value lead magnet.\n' +
    'You are writing the FINAL lead magnet. Not notes. Not an outline. The full piece.\n\n' +
    'INPUT VARIABLES:\n' +
    'AUDIENCE: ' + who + '\n' +
    'PROBLEM: ' + problem + '\n' +
    'SOLUTION / OFFER: ' + solution + '\n' +
    'FORMAT: PDF-style downloadable guide\n' +
    'TONE: Warm, friendly, no jargon. Like explaining to a 5th grader.\n' +
    'WORD COUNT RANGE: 1,200 to 1,800 words\n' +
    'NUMBER OF SECTIONS: 3\n\n' +
    'REQUIRED STRUCTURE:\n' +
    '1. Title (use # heading)\n' +
    '2. Short 2 sentence opening hook\n' +
    '3. What you will walk away with (3 bullet points)\n' +
    '4. Three main content sections (use ## headings) - each with practical advice, real examples, exact prices, and specific scripts or prompts\n' +
    '5. Quick Start Checklist\n' +
    '6. CTA offering the next step with the creator\n' +
    '7. Strong closing paragraph\n\n' +
    'QUALITY RULES:\n' +
    '- Be specific, never vague\n' +
    '- Include real examples, exact prices, word-for-word scripts\n' +
    '- Never say "charge a fair price" - say "charge $25-40 per project"\n' +
    '- Never say "find clients online" - say exactly where and what to say\n' +
    '- Every sentence should teach something usable TODAY\n\n' +
    'COMPLETION RULES:\n' +
    '- Write the full piece in one response\n' +
    '- Do not stop early\n' +
    '- Do not say "continued" or "part 1"\n' +
    '- Never end mid-sentence, mid-list, or mid-section\n' +
    '- If space is tight, compress earlier sections but finish everything\n' +
    '- Prioritize completion over elaboration\n' +
    '- If nearing the word limit, compress earlier sections but STILL finish all sections, the checklist, and the CTA\n' +
'- If space is tight, CUT explanation but KEEP at least 1 example per section, the price table, the scripts, and the checklist\n\n' +
    'FORMAT: use # for title, ## for sections, **bold** for emphasis, - for bullets, --- for dividers.\n\n' +
    'Now write the complete finished lead magnet in full. Do not explain what you are about to write. Just write it.';

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2300,
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
