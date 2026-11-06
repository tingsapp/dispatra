import assert from 'node:assert/strict';
import { codeLocation } from '../src/portal/runtimeDiagnostics';

const event = (filename: string, name = 'TypeError') => ({ filename, lineno: 27, error: { name, message: 'private customer data' }, message: 'secret' }) as ErrorEvent;
assert.deepEqual(codeLocation(event('http://localhost:3000/src/components/Foo.tsx?token=secret'), 'http://localhost:3000'),
  { code_path: 'src/components/Foo.tsx', code_line: 27, error_type: 'TypeError' });
assert.deepEqual(codeLocation(event('https://external.test/src/Foo.tsx'), 'http://localhost:3000'), { error_type: 'TypeError' });
assert.deepEqual(codeLocation(event('http://localhost:3000/private/customer/123'), 'http://localhost:3000'), { error_type: 'TypeError' });
assert.deepEqual(codeLocation(event('', 'CustomerSecret'), 'http://localhost:3000'), {});
assert.deepEqual(codeLocation({} as ErrorEvent), {});
console.log('5 diagnostic location privacy checks passed');
