import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,attendanceDate,summarizeAttendance} from '../server/business.mjs';
const fixture=()=>({students:[{id:1,attendance:{},merit:0,coins:0,savings:0}],ledger:[]});
test('attendance accepts past dates, corrects one daily record and retries without duplicates',()=>{
 const state=fixture();const mark=status=>applyAction(state,{action:'attendance',studentId:1,date:'2026-09-15',status},'teacher');
 mark('present');mark('present');assert.deepEqual(state.students[0].attendance,{'2026-09-15':'present'});assert.equal(state.ledger.length,1);assert.equal(state.ledger[0].date,'2026-09-15');
 mark('late');assert.equal(state.students[0].attendance['2026-09-15'],'late');assert.equal(state.ledger.length,2);assert.match(state.ledger[0].detail,/present/);
 assert.deepEqual([state.students[0].merit,state.students[0].coins,state.students[0].savings],[0,0,0]);
});
test('attendance rejects impossible or ambiguous dates without changing state',()=>{
 const state=fixture();for(const date of ['2026-02-29','2026-04-31','2026-13-01','2026-1-01','26/10/2026','',null,1])assert.throws(()=>applyAction(state,{action:'attendance',studentId:1,date,status:'present'},'teacher'));
 assert.deepEqual(state.students[0].attendance,{});assert.equal(state.ledger.length,0);assert.equal(attendanceDate('2024-02-29'),'2024-02-29');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());assert.equal(attendanceDate(),today);
});
test('monthly attendance summary counts final daily statuses in selected month',()=>{
 const rows=summarizeAttendance([{id:1,attendance:{'2026-10-01':'present','2026-10-02':'late','2026-10-03':'absent','2026-10-04':'excused','2026-09-30':'present'}},{id:2,attendance:{}}],'2026-10');
 assert.deepEqual(rows,[{studentId:1,present:1,late:1,absent:1,excused:1,total:4},{studentId:2,present:0,late:0,absent:0,excused:0,total:0}]);
 for(const month of ['2026-13','2026-00','2026-1',null])assert.throws(()=>summarizeAttendance([],month));
});
