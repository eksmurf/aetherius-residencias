'use strict';
// Offline evidence processing only. Does not connect to a game or database.
const fs = require('node:fs');
const path = require('node:path');
const { validateCatalog } = require('../server/gamemode/residences/catalog.cjs');
const evidence = path.join(__dirname,'evidencias');
const rows = file => fs.readFileSync(path.join(evidence,file),'utf8').trim().split(/\r?\n/).slice(1).map(JSON.parse);
const field = (r,k) => r.fields?.find(f=>f.path===k);
const value = (r,k) => field(r,k)?.value ?? null;
const index = records => new Map(records.map(r=>[r.formid.toLowerCase(),r]));
const get = (map,id) => map.get(String(id).toLowerCase());
const allCells = [...rows('celulas-base.jsonl'),...rows('celulas-mods.jsonl'),...rows('celulas-cidades.jsonl')];
const cells = index(allCells);
const objects = index([...rows('objetos-interiores.jsonl'),...rows('objetos-frostview.jsonl')]);
const partners = index([...rows('portas-parceiras.jsonl'),...rows('portas-frostview.jsonl')]);
const bases = index([...rows('bases-containers.jsonl'),...rows('bases-frostview.jsonl')]);
const membership = JSON.parse(fs.readFileSync(path.join(evidence,'membros-interiores.json'),'utf8')).cells;
const names = {
  '0165a8:skyrim.esm':'breezehome','016dfa:skyrim.esm':'vlindrel-hall','016778:skyrim.esm':'hjerim',
  '016a06:skyrim.esm':'proudspire-manor','016bdd:skyrim.esm':'honeyside',
  '017ebe:dragonborn.esm':'severin-manor','0245ae:granite hill.esp':'forgers-retreat',
  '029f55:amber guard.esp':'karthmans-retreat','0b7f22:neugrad.esp':'fenrens-residence',
  '03a98a:north keep.esp':'falcrost-residence','17901b:vernim wood.esp':'burzag-yomgur-longhouse',
  '4595d9:the great city of winterhold v4.esp':'frostview-hall',
};
function disabled(r) {
  return value(r,'IsDeleted') !== 'False' || (Number(value(r,'MajorRecordFlagsRaw')) & 0x800) !== 0;
}
const inventory = membership.map(member => {
  const cell = get(cells,member.cell);
  if (!cell || !names[member.cell.toLowerCase()]) throw Error('Unknown mapped interior: '+member.cell);
  const children = member.objects.map(id=>get(objects,id)).filter(Boolean);
  const doors = children.filter(r=>field(r,'Base')?.link?.type==='Door');
  const pairs = doors.filter(r=>value(r,'TeleportDestination.Door')).map(exit=>{
    const entry=get(partners,value(exit,'TeleportDestination.Door'));
    const reciprocal=!!entry && value(entry,'TeleportDestination.Door')?.toLowerCase()===exit.formid.toLowerCase();
    const exterior=entry && !String(value(entry,'*parent.Flags')).includes('IsInteriorCell');
    const usable=reciprocal && exterior && !disabled(exit) && !disabled(entry) &&
      !value(exit,'EnableParent.Reference') && !value(entry,'EnableParent.Reference');
    return {entry:entry?.formid ?? value(exit,'TeleportDestination.Door'),exit:exit.formid,reciprocal,
      exterior:!!exterior,structurallyUsable:!!usable,entryCell:value(entry||{},'*parent.FormKey'),
      entryWinner:entry?.winner,exitWinner:exit.winner,nativeKey:value(entry||{},'Lock.Key'),
      nativeLock:value(entry||{},'Lock.Level'),nativeOwner:value(entry||{},'Owner'),
      entryEnableParent:value(entry||{},'EnableParent.Reference'),exitEnableParent:value(exit,'EnableParent.Reference')};
  });
  const containers=children.filter(r=>field(r,'Base')?.link?.type==='Container').map(ref=>{
    const base=get(bases,value(ref,'Base'));
    if(!base)throw Error('Missing container base '+value(ref,'Base'));
    const reasons=[];
    if(String(value(base,'Flags')).includes('Respawns'))reasons.push('respawn');
    if(value(base,'IsDeleted')!=='False'||disabled(ref))reasons.push('deleted_or_initially_disabled');
    if(value(ref,'EnableParent.Reference'))reasons.push('conditional_enable_parent');
    // Store only conventional chests/safes in the draft; every other container stays in this audit.
    if(!/Chest|Safe/i.test(base.editorid||''))reasons.push('not_a_chest_or_safe');
    if(/Merchant|MS11|DLC2RR02|FishTank|Book/i.test(base.editorid||''))reasons.push('special_or_quest_container');
    return {reference:ref.formid,base:base.formid,baseEditorId:base.editorid,baseFlags:value(base,'Flags'),
      referenceWinner:ref.winner,baseWinner:base.winner,owner:value(ref,'Owner'),
      enableParent:value(ref,'EnableParent.Reference'),excludedReasons:reasons,
      suggestedForDraft:reasons.length===0};
  });
  const refs=pairs.filter(p=>p.structurallyUsable).flatMap(p=>[
    {desc:p.entry,kind:'entry',partner:p.exit},{desc:p.exit,kind:'exit',partner:p.entry},
  ]);
  refs.push(...containers.filter(c=>c.suggestedForDraft).map(c=>({desc:c.reference,kind:'container'})));
  const pending=['Confirmar hashes/revisão dos plugins no servidor e no cliente.',
    'Aprovar comercialização, nome exibido e preços em Septims/Diademas.',
    'Conferir todas as rotas de acesso no jogo e a coexistência com missões, NPCs e propriedade nativa.',
    'Homologar fechadura nativa, chave dedicada, persistência e reset dos recipientes.',
    'Integrar carteira oficial de Diademas antes de habilitar cash.'];
  if(!containers.some(c=>c.suggestedForDraft))pending.push('Nenhum baú fixo convencional sem respawn passou na triagem; selecionar/adaptar armazenamento antes de vender.');
  if(pairs.some(p=>!p.structurallyUsable))pending.push('Há pares de porta condicionais ou incompletos; não importar o rascunho antes de resolver.');
  if(containers.some(c=>c.excludedReasons.length))pending.push('Os recipientes excluídos ficam fora da proteção; decidir remoção, bloqueio ou adaptação antes de vender.');
  if(value(cell,'Owner'))pending.push('Resolver o dono nativo da célula: '+value(cell,'Owner')+'.');
  return {id:names[member.cell.toLowerCase()],name:value(cell,'Name'),origin:member.cell.endsWith(':Skyrim.esm')?'base':member.cell.endsWith(':Dragonborn.esm')?'dlc':'mod',
    cell:member.cell,cellEditorId:cell.editorid,cellWinner:cell.winner,nativeCellOwner:value(cell,'Owner'),
    declaredObjects:member.objects.length,placedNpcs:children.filter(r=>r.type==='PlacedNpc').map(r=>r.formid),
    doorPairs:pairs,nonTeleportDoors:doors.filter(r=>!value(r,'TeleportDestination.Door')).map(r=>r.formid),
    containers,pending,status:'mapped_pending_official_confirmation',
    draft:{id:names[member.cell.toLowerCase()],name:value(cell,'Name'),revision:1,forSale:false,prices:{},refs}};
});
const definitions=inventory.map(r=>r.draft);
validateCatalog(definitions); // Structural check of the generated data, not a runtime/game test.
const selected=new Set(membership.map(m=>m.cell.toLowerCase()));
const queue=allCells.filter(r=>!selected.has(r.formid.toLowerCase()) &&
  String(value(r,'Flags')).includes('IsInteriorCell') &&
  /House|Home|Manor|Residence|Retreat|Player|Heljarchen/i.test(`${r.editorid} ${value(r,'Name')}`))
  .map(r=>({cell:r.formid,name:value(r,'Name'),editorId:r.editorid,plugin:r.formid.split(':')[1],winner:r.winner,
    nativeOwner:value(r,'Owner'),status:/Guard|Warehouse|Brewhouse|Bathhouse|Jarls|Utility/i.test(`${r.editorid} ${value(r,'Name')}`)?'non_residential_or_shared_review':'interior_identified_doors_not_mapped',
    forSale:false}));
const write=(name,data)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(data,null,2)+'\n');
write('residences.draft.json',definitions);
write('cadastro-auditado.json',{date:'2026-10-20',liveDeploymentVerified:false,requiresConfirmation:true,residences:inventory});
write('fila-de-mapeamento.json',{date:'2026-10-20',scope:'Named residential candidates in the inspected source cells; not an exhaustive world inventory.',candidates:queue});
const summary={residences:inventory.length,base:inventory.filter(r=>r.origin==='base').length,dlc:inventory.filter(r=>r.origin==='dlc').length,mods:inventory.filter(r=>r.origin==='mod').length,
  doorPairs:inventory.reduce((n,r)=>n+r.doorPairs.length,0),containersInspected:inventory.reduce((n,r)=>n+r.containers.length,0),
  containersSuggested:inventory.reduce((n,r)=>n+r.containers.filter(c=>c.suggestedForDraft).length,0),queue:queue.length,forSale:0};
write('resumo.json',summary);
const table=['| Imóvel | Origem | Pares de portas | Recipientes inspecionados | Baús/cofres sugeridos |','|---|---|---:|---:|---:|',
  ...inventory.map(r=>`| ${r.name} | ${r.cell.split(':')[1]} | ${r.doorPairs.length} | ${r.containers.length} | ${r.containers.filter(c=>c.suggestedForDraft).length} |`)].join('\n');
fs.writeFileSync(path.join(__dirname,'IMOVEIS.md'),'# Imóveis identificados em 20/10/2026\n\nCadastros preliminares: nenhum imóvel liberado para venda. As referências foram lidas nos plugins disponíveis com ordem compatível com a lista oficial recebida; a revisão instalada ainda precisa ser confirmada.\n\n'+table+'\n\nOs pares são recíprocos no arquivo; sua disponibilidade durante o jogo ainda exige homologação. “Sugerido” significa apenas baú/cofre sem respawn, sem enable parent e não inicialmente desativado nos registros lidos. Não certifica ausência de scripts ou interferência de missões.\n\nVeja `cadastro-auditado.json` para os IDs de todas as portas, recipientes, donos nativos e pendências de cada casa. `residences.draft.json` é um rascunho separado da configuração ativa: preços vazios e `forSale: false`. Não o importe inteiro antes de resolver as pendências; mesmo imóveis sem venda podem receber bloqueios quando cadastrados no módulo.\n\n`fila-de-mapeamento.json` contém os demais candidatos nominais encontrados, incluindo imóveis ocupados, dependências e locais compartilhados. Não é uma lista de casas vagas nem um inventário exaustivo de todas as células dos mods.\n');
console.log(JSON.stringify(summary));
