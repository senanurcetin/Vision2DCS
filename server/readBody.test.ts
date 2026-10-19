import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readBody } from './node';

const fakeRequest = () => {
  const request = new EventEmitter() as unknown as IncomingMessage;
  request.complete = false;
  request.resume = () => request;
  return request;
};

describe('Node HTTP request body lifecycle (offline)', () => {
  it('collects a complete, valid payload without waiting for connection close', async () => {
    const req = fakeRequest();
    const response = readBody(req, 100);
    req.emit('data', Buffer.from('{"ok":'));
    req.emit('data', Buffer.from('true}'));
    req.complete = true;
    req.emit('end');
    expect((await response).toString('utf8')).toBe('{"ok":true}');
    req.emit('close');
  });

  it('rejects an oversized upload at the first overflowing chunk, before end', async () => {
    const req = fakeRequest();
    const response = readBody(req, MAX_BODY_BYTES);
    req.emit('data', Buffer.alloc(MAX_BODY_BYTES + 1));
    await expect(response).rejects.toThrow();
    // No 'end' event; the read nevertheless settled.
  });

  it('settles early close even when Node reports complete but emits no end event', async () => {
    const req = fakeRequest();
    req.complete = true;
    const response = readBody(req, 100);
    req.emit('close');
    await expect(response).rejects.toThrow(/Client upload closed/);
  });

  it('settles interrupted body reads on both explicit abort and premature close', async () => {
    for (const event of ['aborted', 'close'] as const) {
      const req = fakeRequest();
      const response = readBody(req, 100);
      req.emit('data', Buffer.from('{'));
      req.emit(event);
      await expect(response).rejects.toThrow(/Client upload/);
    }
  });
});
