import test from 'node:test';
import assert from 'node:assert/strict';
import { customerStatementHtml } from './family-statement-print.js';
test('customer print projection excludes internal fields and escapes all user data',()=>{const source={reference:'<script>unsafe</script>',rows:[{code:'B<&',currency:'EGP',charged:'4000',paid:'2500',outstanding:'1500',commission:'100.01',cost:'2000'}],totals:[{currency:'EGP',charged:'4000',paid:'2500',outstanding:'1500'}]};const html=customerStatementHtml(source);assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(html.includes('B&lt;&amp;'));assert.ok(html.includes('dir="rtl"'));assert.ok(html.includes('1500'));assert.ok(!html.includes('100.01'));assert.ok(!html.includes('2000'));assert.ok(!html.includes('<script>'));});
