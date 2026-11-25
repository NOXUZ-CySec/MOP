'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseRecoveryLink}=require('../desktop/auth-recovery83.cjs');
const root=require('../desktop/supabase-config.cjs').url+'/auth/v1/verify';
test('Preview83 accepts only a Supabase MOP recovery verification link',()=>{assert.equal(parseRecoveryLink(root+'?token=abcDEFGhijk123456789&type=recovery'),'abcDEFGhijk123456789');assert.equal(parseRecoveryLink(root+'?token_hash=abcDEFGhijk123456789&type=recovery'),'abcDEFGhijk123456789')});
test('Preview83 rejects cross-project, unsafe, wrong type and missing tokens',()=>{for(const link of ['https://evil.example/auth/v1/verify?token=abcDEFGhijk123456789&type=recovery',root.replace('https://','http://')+'?token=abcDEFGhijk123456789&type=recovery',root+'?token=abcDEFGhijk123456789&type=signup',root+'?type=recovery','https://edvttorkimwqsevndafj.supabase.co.evil.com/auth/v1/verify?token=abcDEFGhijk123456789&type=recovery'])assert.throws(()=>parseRecoveryLink(link))});