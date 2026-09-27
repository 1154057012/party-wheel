const {test} = require('node:test');
const assert = require('node:assert/strict');
const {indexAtPointer, targetRotation, stoppingRotation, easeInOut, TAU} = require('../wheel-core.js');
test('all 100 sector centers map to the exact visible question, over multiple full turns',()=>{
  for(let i=0;i<100;i++) for(let turn=0;turn<9;turn++)
    assert.equal(indexAtPointer(-i*TAU/100+turn*TAU,100),i);
});
test('every target stops inside its requested sector from arbitrary starting positions',()=>{
  for(let i=0;i<100;i++) for(const start of [0,1.9,89.34]) for(const jitter of [-.24,0,.24]){
    const end=targetRotation(start,i,100,6,jitter);
    assert.ok(end>start+5*TAU);
    assert.equal(indexAtPointer(end,100),i);
  }
});
test('animation starts and ends precisely and remains monotonic',()=>{
  assert.equal(easeInOut(0),0); assert.equal(easeInOut(1),1);
  let prev=0; for(let i=0;i<=100;i++){const value=easeInOut(i/100);assert.ok(value>=prev);prev=value;}
});
test('quick stop always moves forward and settles at a sector center',()=>{
  const step=TAU/100;
  for(const start of [0,.02,5,19.73,100])for(const speed of [0,.0001,.01,.032]){
    const end=stoppingRotation(start,speed,100,550);
    assert.ok(end>start);
    assert.ok(end-start<=speed*550/3+step*2);
    assert.ok(Math.abs(end/step-Math.round(end/step))<1e-9);
    assert.equal(indexAtPointer(end,100),indexAtPointer(end+step*.2,100));
  }
});
