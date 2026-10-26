import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../server/business.mjs';
const fixture=()=>({students:[{id:1,attendance:{},merit:20,coins:10,savings:0},{id:2,savings:0}],ledger:[]});
const run=(state,input,actor='teacher')=>applyAction(state,{studentId:1,note:'Test correction',...input},actor);
test('money entries include exact satang metadata and reversal preserves original audit',()=>{
 const state=fixture();run(state,{action:'deposit',amount:100.25});const original={...state.ledger[0]};
 assert.equal(original.moneyDeltaSatang,10025);assert.equal(original.amount,100.25);
 run(state,{action:'reverseMoney',entryId:original.id});assert.equal(state.students[0].savings,0);assert.equal(state.ledger.length,2);assert.deepEqual(state.ledger[1],original);assert.equal(state.ledger[0].moneyDeltaSatang,-10025);assert.equal(state.ledger[0].reversesEntryId,original.id);assert.equal(state.ledger[0].note,'Test correction');
 assert.throws(()=>run(state,{action:'reverseMoney',entryId:original.id}));assert.equal(state.ledger.length,2);
 assert.equal(state.students[0].merit,20);assert.equal(state.students[0].coins,10);
});
test('withdrawal reversal restores exact balance and does not reverse a reversal',()=>{
 const state=fixture();run(state,{action:'deposit',amount:100});run(state,{action:'withdraw',amount:25.15});const entry=state.ledger[0];assert.equal(entry.moneyDeltaSatang,-2515);
 run(state,{action:'reverseMoney',entryId:entry.id});assert.equal(state.students[0].savings,10000);assert.equal(state.ledger[0].moneyDeltaSatang,2515);assert.throws(()=>run(state,{action:'reverseMoney',entryId:state.ledger[0].id}));
});
test('reversal rejects insufficient savings, other student, legacy entries, missing reason and non-teacher',()=>{
 const state=fixture();run(state,{action:'deposit',amount:100});const entry=state.ledger[0];run(state,{action:'withdraw',amount:70});
 const before=JSON.stringify(state);assert.throws(()=>run(state,{action:'reverseMoney',entryId:entry.id}));assert.equal(JSON.stringify(state),before);
 assert.throws(()=>run(state,{action:'reverseMoney',studentId:2,entryId:entry.id}));assert.throws(()=>run(state,{action:'reverseMoney',entryId:entry.id,note:''}));assert.throws(()=>run(state,{action:'reverseMoney',entryId:entry.id},'student:1'));
 state.ledger.push({id:'legacy',studentId:1,action:'deposit',detail:'100 baht'});assert.throws(()=>run(state,{action:'reverseMoney',entryId:'legacy'}));
});
