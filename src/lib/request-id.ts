import { NextRequest, NextResponse } from 'next/server';

export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}

export function jsonWithRequestId<T>(
  req: NextRequest,
  payload: T,
  init?: number | ResponseInit
): NextResponse {
  const response = typeof init === 'number'
    ? NextResponse.json(payload, { status: init })
    : NextResponse.json(payload, init);

  response.headers.set('x-request-id', getRequestId(req));
  return response;
}

export function withRequestId(req: NextRequest, response: NextResponse): NextResponse {
  response.headers.set('x-request-id', getRequestId(req));
  return response;
}
