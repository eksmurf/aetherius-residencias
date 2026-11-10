'use strict';
const { fail, integer } = require('./errors.cjs');
const { descriptor } = require('./catalog.cjs');
const labels = {storage:'Armazenamentos utilizáveis',bed:'Camas utilizáveis',enchanting:'Mesa de encantamento',alchemy:'Mesa de alquimia',cooking:'Cozinha',oven:'Forno de assar',forge:'Forja',workbench:'Bancada de armaduras',grindstone:'Pedra de amolar',tanning:'Curtume',smelter:'Fundição'};
function validateSheet(sheet, row) {
  if(!sheet || !integer(sheet.revision) || sheet.catalogRevision!==row.revision ||
    !Array.isArray(sheet.cells) || !Array.isArray(sheet.objects) || sheet.objects.length>4096 ||
    typeof sheet.source!=='string' || !sheet.source.trim() || sheet.source.length>500 ||
    !Number.isFinite(Date.parse(sheet.verifiedAt)) || !Array.isArray(sheet.complete)) fail('AMENITIES');
  const cells=sheet.cells.map(descriptor), actual=row.definition.interiorCells;
  if(cells.length!==actual.length || new Set(cells).size!==cells.length || cells.some(c=>!actual.includes(c))) fail('AMENITIES');
  if(sheet.complete.some(c=>!Object.hasOwn(labels,c)))fail('AMENITIES');
  const objects=new Map();
  for(const raw of sheet.objects){
    const id=descriptor(raw.id), cell=descriptor(raw.cell);
    if(objects.has(id)||!cells.includes(cell)||!Array.isArray(raw.functions)||!raw.functions.length||raw.functions.some(f=>!Object.hasOwn(labels,f))||new Set(raw.functions).size!==raw.functions.length||
      !['usable','unavailable','conditional','unknown'].includes(raw.state)||typeof raw.evidence!=='string'||!raw.evidence.trim()||raw.evidence.length>1000||
      typeof raw.reason!=='string'||raw.reason.length>500||typeof raw.subtype!=='string'||raw.subtype.length>80) fail('AMENITIES');
    if(raw.state==='usable' && (raw.present!==true||raw.accessible!==true||raw.functional!==true||
      (raw.functions.includes('storage')&&raw.persistenceVerified!==true)))fail('AMENITIES');
    objects.set(id,{...raw,id,cell});
  }
  for(const category of sheet.complete) if([...objects.values()].some(o=>o.functions.includes(category)&&['unknown','conditional'].includes(o.state)))fail('AMENITIES');
  return {...sheet,cells,objects:[...objects.values()]};
}
function publicSheet(row){
  let sheet;try{sheet=validateSheet(row.amenities,row);}catch{return {revision:null,verified:false,items:Object.entries(labels).map(([category,label])=>({category,label,count:null,description:'Em verificação'}))};}
  const items=Object.entries(labels).map(([category,label])=>{
    const complete=sheet.complete.includes(category), objects=sheet.objects.filter(o=>o.functions.includes(category)&&o.state==='usable');
    const subtypes={};for(const o of objects)if(o.subtype)subtypes[o.subtype]=(subtypes[o.subtype]||0)+1;
    return {category,label,count:complete?objects.length:null,description:complete?(objects.length?'':'Não possui'):'Em verificação',subtypes:complete?subtypes:{}};
  });
  return {revision:sheet.revision,verified:items.every(i=>i.count!==null),items};
}
module.exports={labels,validateSheet,publicSheet};
