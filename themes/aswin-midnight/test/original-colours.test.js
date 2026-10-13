'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repairOriginalColours,restoreOriginalColours,contrast}=require('../lib/original-colours');
function element(foreground,background) {
 let value=foreground,priority='';
 const el={childNodes:[{nodeType:3,textContent:'Readable text'}],parentElement:null,background,
  style:{getPropertyValue:()=>value,getPropertyPriority:()=>priority,setProperty(_,next,p){value=next==='#17212c'?'rgb(23, 33, 44)':next==='#f2f5fa'?'rgb(242, 245, 250)':next;priority=p;}}};return el;
}
function doc(elements){return{querySelectorAll:()=>elements,defaultView:{getComputedStyle:el=>({color:el.style.getPropertyValue(),backgroundColor:el.background,backgroundImage:'none'})}};}
test('original reading repairs pale text on white but preserves legible brand colours and restores canonical CSS values',()=>{
 const faint=element('rgb(226, 232, 241)','rgb(255, 255, 255)'),brand=element('rgb(23, 33, 44)','rgb(255, 255, 255)');
 const changes=repairOriginalColours(doc([faint,brand]));assert.equal(changes.length,1);assert.equal(faint.style.getPropertyValue(),'rgb(23, 33, 44)');
 restoreOriginalColours(changes);assert.equal(faint.style.getPropertyValue(),'rgb(226, 232, 241)');assert.equal(faint.style.getPropertyPriority(),'');
});
test('dark sender panels retain white text; unreadable dark text on dark gets a light foreground',()=>{
 const legible=element('rgb(242, 245, 250)','rgb(28, 35, 48)'),faint=element('rgb(23, 33, 44)','rgb(28, 35, 48)');
 const changes=repairOriginalColours(doc([legible,faint]));assert.equal(changes.length,1);assert.equal(faint.style.getPropertyValue(),'rgb(242, 245, 250)');
 assert(contrast([23,33,44],[255,255,255])>=4.5);
});
