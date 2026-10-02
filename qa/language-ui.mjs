import { boot, fireEvent, settle } from './harness.mjs';
import assert from 'node:assert/strict';
const cases = [
  ['en', 'Language', 'Other', 'Copy JSON', 'Apply motion'],
  ['fr', 'Langue', 'Autres', 'Copier le JSON', 'Appliquer le mouvement'],
  ['de', 'Sprache', 'Sonstiges', 'JSON kopieren', 'Bewegung anwenden'],
  ['ja', '言語', 'その他', 'JSONをコピー', 'モーションを適用'],
  ['ko', '언어', '기타', 'JSON 복사', '모션 적용'],
  ['es-ES', 'Idioma', 'Otros', 'Copiar JSON', 'Aplicar movimiento'],
  ['es-419', 'Idioma', 'Otros', 'Copiar JSON', 'Aplicar movimiento'],
  ['pt-BR', 'Idioma', 'Outros', 'Copiar JSON', 'Aplicar movimento'],
];
const names = {en:'English',fr:'Français',de:'Deutsch',ja:'日本語',ko:'한국어','es-ES':'Español (España)','es-419':'Español (Latinoamérica)','pt-BR':'Português (Brasil)'};
const orbitNames = {en:'Orbit',fr:'Orbite',de:'Umlaufbahn',ja:'軌道',ko:'궤도','es-ES':'Órbita','es-419':'Órbita','pt-BR':'Órbita'};
let checked=0;
async function snapshot(h, folder, copy) {
  await h.openFolder(folder); await h.click(h.find('button',copy)); return JSON.parse(h.clipboard);
}
for(const [locale,label,other,copy,apply] of cases){
  const h=await boot({storage:{'orbit-ui-language':locale}});
  try{
    assert.equal(h.d.documentElement.lang,locale);
    const galleryNames=[...h.d.querySelectorAll('.preset-gallery-name')].map(node=>node.textContent);
    assert(!galleryNames.includes(`${orbitNames[locale]} 02`),'Retired Orbit 02 must be absent in every language');
    for(const number of ['01','03','04']) assert(galleryNames.includes(`${orbitNames[locale]} ${number}`),'Remaining Orbit names must localize');
    assert.equal(h.d.querySelectorAll(".orbit-language-control").length,0,"Language must be absent from gallery");
    if(locale!=="en") assert(h.d.querySelector(".preset-gallery-name").textContent!=="Orbit 01","Orbit names must localize");
    await h.click(h.d.querySelector('.preset-gallery-card'));
    await h.openFolder(other);
    assert.equal(h.d.querySelectorAll(".orbit-language-control").length,1,"Language belongs only in Other");
    const before=await snapshot(h,other,copy);
    await h.selectControl(label,'English');
    const english=await snapshot(h,'Other','Copy JSON');
    assert.deepEqual(english,before,'Changing language must preserve motion');
    await h.selectControl('Language',names[locale]);
    assert(h.query('button',apply));
    assert.deepEqual(await snapshot(h,other,copy),before);
    assert.equal(h.storage['orbit-ui-language'],locale);
    await h.click(h.find('button',apply));
    assert.deepEqual(JSON.parse(JSON.stringify(h.messages.filter(m=>m.type==='apply').at(-1).settings)),before);
    await h.result('error',{message:'Select cards in one top-level frame.',diagnostics:'Raw original diagnostics'});
    const status=h.d.querySelector('.status.error').textContent;
    if(locale!=='en') assert(!status.includes('Select cards in one top-level frame.'));
    assert.deepEqual(h.errors,[]);
    const storage=h.storage;
    h.close();
    const reopened=await boot({storage});
    assert.equal(reopened.d.documentElement.lang,locale);assert.deepEqual(reopened.errors,[]);reopened.close();checked++;
  }finally{h.close()}
}
for(const [languages,expected] of [[['fr-CA','en-US'],'fr'],[['es-MX'],'es-419'],[['pt-PT'],'pt-BR'],[['ru-RU'],'en'],[['ru-RU','ja-JP'],'ja']]){
 const h=await boot({languages,storage:{'orbit-ui-language':'invalid'}});
 assert.equal(h.d.documentElement.lang,expected);
 Object.defineProperty(h.w.navigator,'languages',{value:['ko-KR'],configurable:true});
 h.w.dispatchEvent(new h.w.Event('languagechange'));await settle();assert.equal(h.d.documentElement.lang,'ko');
 await h.click(h.d.querySelector('.preset-gallery-card'));await h.openFolder('기타');
 await h.selectControl('언어','Deutsch');
 Object.defineProperty(h.w.navigator,'languages',{value:['fr-FR'],configurable:true});
 h.w.dispatchEvent(new h.w.Event('languagechange'));await settle();assert.equal(h.d.documentElement.lang,'de');
 await h.selectControl('Sprache','Automatisch · Français');
 assert.equal(h.d.documentElement.lang,'fr');assert.equal(h.storage['orbit-ui-language'],'auto');
 assert.deepEqual(h.errors,[]);h.close();checked++;
}
// Language selection also works with unavailable storage and never resets a live draft.
const h=await boot();
Object.defineProperty(h.w.Storage.prototype,'setItem',{value(){throw new Error('Storage unavailable')}});
await h.click(h.d.querySelector('.preset-gallery-card'));await h.openFolder('Other');
await h.selectControl('Language','Français');assert.equal(h.d.documentElement.lang,'fr');
await h.openFolder('Mouvement');
const radio=h.d.querySelector('[role="radiogroup"][aria-label="Démarrer quand la carte est principale"]');
assert(radio);fireEvent.keyDown(radio,{key:'ArrowLeft'});await settle();
const settings=await snapshot(h,'Autres','Copier le JSON');assert.equal(settings.other.startOnEntry,false);
assert.deepEqual(h.errors,[]);h.close();checked++;
console.log(`Language UI: ${checked} workflows passed (all 8 locales, reopen, fallback, languagechange, unchanged JSON/apply, keyboard, unavailable storage)`);
const saved=await boot();
try {
 await saved.gallery('Orbit 01');
 const draft=await saved.snapshotSettings();draft.parameters.cycleDuration+=.25;
 await saved.importJson(JSON.stringify(draft));
 await saved.click(saved.find('button','Choose preset'));
 await saved.click(saved.find('button','Save current preset'));
 await saved.gallery('Row 01');await saved.openFolder('Other');
 await saved.selectControl('Language','Français');
 await saved.click(saved.find('button','Choisir un préréglage'));
 assert.equal(saved.d.querySelectorAll('.orbit-language-control').length,0);
 assert([...saved.d.querySelectorAll('.saved-preset-preview > span')].some(span=>span.textContent==='Orbite 01 · 1'));
 const persisted=JSON.parse(saved.storage['dialkit:orbit-motion-controls-v8']);
 assert(persisted.presets.some(preset=>preset.name==='Orbit 01 · 1'),'Saved identities must keep original names');
 assert.deepEqual(saved.errors,[]);
 console.log('Saved preset names: localized display and unchanged storage passed');
} finally {saved.close()}
