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
    'You are writing a COMPLETE but COMPACT lead magnet.\n\n' +
    'AUDIENCE: ' + who + '\n' +
    'PROBLEM: ' + problem + '\n' +
    'SOLUTION / OFFER: ' + solution + '\n\n' +
    'LENGTH:\n' +
    '- Total: 1,200 to 1,500 words\n' +
    '- Keep every section short and punchy\n' +
    '- Do not add new sections beyond what is listed below\n\n' +
    'REQUIRED SECTIONS:\n' +
    '1. Title + opening hook\n' +
    '2. What You Will Walk Away With (3-5 bullets)\n' +
    '3. Section 1: Three main services or strategies - for EACH include: 2-3 sentences on what it is and why it works, 1 simple how-to example, 1 price range, 1-2 places to find clients. No more than 1 example per service.\n' +
    '4. Section 2: Pricing and Scripts - one compact pricing table, exactly 3 outreach scripts, one short first payment script that ends the section cleanly\n' +
    '5. Section 3: 7-Day Action Plan - Days 1-7 with 1-2 bullets per day focused on getting the first client\n' +
    '6. Quick Start Checklist (5-8 checkbox bullets)\n' +
    '7. Closing encouragement + soft CTA mentioning ' + solution + '\n\n' +
    'CONSTRAINTS:\n' +
    '- Total examples per service: 1\n' +
    '- Total outreach scripts: 3\n' +
    '- Total tables: 1\n' +
    '- Do not introduce new tools or long case studies\n' +
    '- If running long, shorten explanations but still complete the 7-Day Action Plan, the Quick Start Checklist, and the closing CTA\n\n' +
    'COMPLETION RULE:\n' +
    '- Finish all 7 sections\n' +
    '- End with closing paragraph and CTA\n' +
    '- Never stop mid-sentence or mid-bullet\n' +
    '- Never say "continued" or "part 2"\n' +
    '- If nearing the word limit, compress earlier sections but STILL finish everything\n' +
    '- If space is tight, CUT explanation but KEEP the 7-Day Plan, checklist, and CTA\n\n' +
    'FORMAT: use # for title, ## for sections, **bold** for emphasis, - for bullets, --- for dividers.\n' +
    'Tone: warm, friendly, no jargon. Specific - use exact prices and real scripts.\n\n' +
    'Now write the COMPLETE lead magnet in one response. Do not explain. Just write it.';

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
