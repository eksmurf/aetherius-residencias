'use strict';
// Somente leitura de arquivos. Não carrega módulos instalados, não acessa banco
// ou rede e não afirma qual diretório está sendo usado pelo processo em execução.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const args=process.argv.slice(2);
const allowed=['server','client','ui'];
if(args.includes('--help')) {
  console.log('node atualizacao/conferir-instalacao.cjs --server=/runtime/server [--client=/fontes/client] [--ui=/distribuicao/Platform/UI]');
  process.exit(0);
}
if(args.some(a=>!allowed.some(k=>a.startsWith('--'+k+'='))))throw Error('Parâmetro desconhecido. Use --help.');
const roots={};
for(const key of allowed){const found=args.filter(a=>a.startsWith('--'+key+'='));if(found.length>1)throw Error('Parâmetro repetido: '+key);if(found.length){const value=found[0].slice(key.length+3);if(!value.trim())throw Error('Caminho vazio: '+key);roots[key]=path.resolve(value);if(!fs.statSync(roots[key]).isDirectory())throw Error('Diretório inválido: '+key);}}
if(!roots.server)throw Error('Informe --server no diretório usado pelo serviço oficial.');
const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'referencias-versoes.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
function fingerprint(file){try{const b=fs.readFileSync(file);return{sha256:sha(b),lfSha256:sha(b.toString('utf8').replace(/\r\n/g,'\n'))};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const surfaces=[];
for(const [label,root] of Object.entries(roots)){
  const side=label==='server'?'server':'client';
  const names=[...new Set(reference.releases.flatMap(r=>r.files.filter(f=>f.side===side).map(f=>f.path)))].sort();
  const files=names.map(name=>{const actual=fingerprint(path.join(root,name));return{path:name,present:!!actual,...actual,matches:actual?reference.releases.filter(r=>r.files.some(f=>f.side===side&&f.path===name&&f.lfSha256===actual.lfSha256)).map(r=>r.version):[]};});
  const compatibleVersions=reference.releases.filter(r=>files.every(actual=>{const expected=r.files.find(f=>f.side===side&&f.path===actual.path);return expected?actual.present&&actual.lfSha256===expected.lfSha256:!actual.present;})).map(r=>r.version);
  surfaces.push({surface:label,root,evidence:label==='client'?'source_files_only':'operator_selected_distribution_path',compatibleVersions,files});
}
const configPath=path.join(roots.server,'config/residences.json');
let config={present:false};
if(fs.existsSync(configPath)){
  const c=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const definitions=Array.isArray(c.residences)?c.residences:[];
  config={present:true,...fingerprint(configPath),enabled:c.enabled===true,purchasesEnabled:c.purchasesEnabled===true,maxPerProfile:c.maxPerProfile??null,keyDescriptorConfigured:typeof c.keyDescriptor==='string'&&!!c.keyDescriptor,definitionCount:definitions.length,
    missingInteriorCells:definitions.filter(d=>!Array.isArray(d.interiorCells)||!d.interiorCells.length).length,
    missingStorageGuards:definitions.filter(d=>!Array.isArray(d.storageGuards)).length,
    missingInteriorPassages:definitions.filter(d=>!Array.isArray(d.interiorPassages)).length,
    missingSeptimsBase:definitions.filter(d=>!Number.isSafeInteger(d.prices?.septims)||d.prices.septims<=0).length};
}
const adapter=fingerprint(path.join(roots.server,'gamemode/residences/official-diademas.cjs'));
const compatibleVersions=reference.releases.map(r=>r.version).filter(v=>surfaces.every(s=>s.compatibleVersions.includes(v)));
console.log(JSON.stringify({schemaVersion:1,observedAt:new Date().toISOString(),readOnly:true,processVerified:false,databaseInspected:false,
  compatibleVersions,interpretation:compatibleVersions.length?'Compatibilidade de arquivos com pacotes publicados; não comprova processo ativo ou migração do banco.':'Arquivos ausentes, personalizados ou misturados; conciliar diferenças antes de aplicar.',
  surfaces,config,diademasAdapter:{present:!!adapter,...adapter}},null,2));
