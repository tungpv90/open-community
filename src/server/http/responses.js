const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : 'Server error';
  const status = /authentication required|sign in/i.test(message)
    ? 401
    : /administrator access|required role|permission denied/i.test(message)
      ? 403
      : 400;

  return json({ error: message }, status);
}

export { errorResponse, json };
