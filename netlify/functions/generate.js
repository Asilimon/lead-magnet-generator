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
    'You are an expert lead magnet writer.\n' +
    'Your task is to generate a COMPLETE, polished, skimmable lead magnet.\n' +
    'Return only final formatted content.\n' +
    'Do not output notes, planning text, explanations, or an outline.\n' +
    'Do not stop early.\n' +
    'Do not ask if the user wants part 2.\n' +
    'Do not end mid-sentence, mid-list, mid-table, or mid-section.\n' +
    'If the draft becomes too long, shorten explanations and examples, but ALWAYS complete the full document.\n\n' +
    'AUDIENCE: ' + who + '\n' +
    'PROBLEM: ' + problem + '\n' +
    'SOLUTION / OFFER: ' + solution + '\n\n' +
    'A successful output MUST include ALL of the following sections in this order:\n' +
    '1. Title\n' +
    '2. Hook\n' +
    '3. What You Will Walk Away With (3-5 bullets)\n' +
    '4. Section 1 (first core topic)\n' +
    '5. Section 2 (second core topic)\n' +
    '6. Section 3 (third core topic)\n' +
    '7. 7-Day Action Plan\n' +
    '8. Quick Start Checklist\n' +
    '9. Closing CTA mentioning ' + solution + '\n' +
    '10. Final closing paragraph\n\n' +
    'Do NOT add extra sections.\n' +
    'Do NOT rename or reorder these sections.\n\n' +
    'HARD LIMITS:\n' +
    '- Total length: 1,200 to 1,600 words\n' +
    '- Maximum 3 core services or main ideas\n' +
    '- Maximum 1 example per service\n' +
    '- Maximum 1 pricing table\n' +
    '- Maximum 3 outreach or sales scripts\n' +
    '- Maximum 2 bullets per day in the 7-Day Action Plan\n' +
    '- Maximum 8 bullets in the Quick Start Checklist\n\n' +
    'If token or length pressure occurs, REDUCE DETAIL, NOT COMPLETENESS.\n\n' +
    'COMPLETION RULE:\n' +
    'Before ending, silently verify that:\n' +
    '- All 10 required sections are present\n' +
    '- The 7-Day Action Plan is complete\n' +
    '- The Quick Start Checklist has 5-8 bullets\n' +
    '- There is at least 1 pricing table\n' +
    '- There is a Closing CTA AND a final closing paragraph\n' +
    'If ANY required section is missing, shorten earlier sections and COMPLETE the missing parts BEFORE ending.\n\n' +
    'FORMAT: use # for title, ## for sections, **bold** for emphasis, - for bullets, --- for dividers.\n' +
    'Tone: warm, friendly, no jargon, specific to the audience. Use exact prices and real scripts.\n\n' +
    'Now generate the final complete lead magnet. Do not explain. Just write it.';

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
        max_tokens: 2400,
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
