import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {fireEvent,getByRole,getAllByRole,queryByRole,getByLabelText} from '@testing-library/dom';
export {fireEvent};
export const settle=()=>new Promise(r=>setTimeout(r,15));
export function makeSelection(count=9,orbitCount=0,appliedSettings=null){const t={count,orbitCount,frameWidth:720,frameHeight:400,items:Array.from({length:count},()=>({width:72,height:92,offsetX:0,offsetY:0}))};return{selected:count?1:0,names:count?['QA cards']:[],types:count?['FRAME']:[],targets:{selection:t,children:t,deep:t},appliedSettings,appliedPreset:null};}
export async function boot(options={}){
const messages=[],errors=[],vc=new VirtualConsole();let clipboard=options.clipboard??'',selection=options.selection??makeSelection();
vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...e)=>errors.push(e.map(String).join(' ')));
let dom;
const deliver=m=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{pluginMessage:m}}));
dom=new JSDOM(readFileSync('../dist/ui.html','utf8'),{url:'http://qa.test',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
w.matchMedia=(q)=>({matches:q.includes('prefers-reduced-motion'),addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){} disconnect(){}};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
w.Element.prototype.setPointerCapture=()=>{};w.Element.prototype.releasePointerCapture=()=>{};
w.postMessage=(m)=>{if(!m.pluginMessage)return;messages.push(m.pluginMessage);if(m.pluginMessage.type==='refresh-selection')setTimeout(()=>deliver({type:'selection',selection}),0)};
w.document.execCommand=()=>true;
if(options.languages){Object.defineProperty(w.navigator,'languages',{value:options.languages,configurable:true});Object.defineProperty(w.navigator,'language',{value:options.languages[0]??'en',configurable:true})}
Object.defineProperty(w.navigator,'clipboard',{value:{async writeText(t){if(options.writeDenied)throw Error('denied');clipboard=t},async readText(){if(options.readDenied)throw Error('denied');return clipboard}}});
for(const [key,value]of Object.entries(options.storage??{}))w.localStorage.setItem(key,value);
}});
await new Promise(r=>setTimeout(r,120));await settle();
const w=dom.window,d=w.document,b=d.body;
const find=(role,name)=>getByRole(b,role,{name,exact:true});const query=(role,name)=>queryByRole(b,role,{name,exact:true});
const click=async el=>{fireEvent.click(el);await settle()};
const api={dom,w,d,b,messages,errors,find,query,click,
async select(count=9,orbitCount=0,settings=null){selection=makeSelection(count,orbitCount,settings);deliver({type:'selection',selection});await settle()},
async result(kind='success',extras={}){deliver({type:'result',kind,message:'QA '+kind,...extras});await settle()},
async gallery(label){await click(find('button',label));},
async openFolder(label){const x=d.querySelector('.dialkit-folder-header-top[aria-label="'+label+'"]');if(x&&x.getAttribute('aria-expanded')!=='true')await click(x)},
async openAll(){for(const name of ['Motion','Cards','Trajectory','Other'])await api.openFolder(name);for(const x of Array.from(d.querySelectorAll('[aria-label="Advanced"]')))if(x&&x.getAttribute('aria-expanded')!=='true')await click(x)},
async selectControl(label,option){const x=Array.from(d.querySelectorAll('.dialkit-select-trigger')).find(x=>x.querySelector('.dialkit-select-label')?.textContent===label);if(!x)throw Error('Missing select '+label);await click(x);const choices=Array.from(d.querySelectorAll('.dialkit-select-option'));const q=choices.find(x=>x.textContent===option);if(!q)throw Error('Missing option '+option+' in '+choices.map(x=>x.textContent));await click(q);await new Promise(r=>setTimeout(r,220))},
async snapshotSettings(){await api.openFolder('Other');await click(find('button','Copy JSON'));return JSON.parse(clipboard)},
async importJson(value){await api.openFolder('Other');clipboard=value;await click(find('button','Paste'));},
get clipboard(){return clipboard},set clipboard(v){clipboard=v},
get storage(){return Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{let k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)]}))},
rootText(){return d.querySelector('#root').textContent},
close(){dom.window.close()}}
return api;
}
