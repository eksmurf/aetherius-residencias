'use strict';
// Build-time only. Does not modify the supplied IPTU3 tree or run a server.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),impl=path.join(repo,'implementacao');
const input=process.argv[2];if(!input)throw Error('Informe o diretório recebido server/gamemode/residences de IPTU3.');
const source=path.resolve(input),temp=path.join(repo,'.build-0.5'),output=path.join(impl,'compat/IPTU3-0.5.2');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const files=['store.cjs','install.cjs','service.cjs','errors.cjs','tax.cjs'],added=['extensions.cjs','estate-policy.cjs','amenities.cjs','tours.cjs'];
const manifest={version:'0.5.2',base:'IPTU3 + cadastro 08.6 recebido',baseResidencesCommit:'b8717d4cbf2cd0431ce9bac944bcd0b5f730c896',normalization:'UTF-8 CRLF -> LF',files:[]};
for(const file of files){
  const base=cp.execFileSync('git',['show',manifest.baseResidencesCommit+':implementacao/server/gamemode/residences/'+file],{cwd:repo,encoding:'utf8'});
  const old=read(path.join(source,file)),current=read(path.join(impl,'server/gamemode/residences',file));
  for(const [name,text] of [['base',base],['iptu',old],['new',current]])write(path.join(temp,name,file),text);
  const merged=cp.spawnSync('git',['merge-file','-p',path.join(temp,'new',file),path.join(temp,'base',file),path.join(temp,'iptu',file)],{encoding:'utf8'});
  let result=merged.stdout;
  if(merged.status===1&&file==='store.cjs'){
    const conflict=/^<<<<<<<.*\n  return \{ installCatalog, snapshot, keys, status, mutate, properties, inventoryKeys, cityTaxes, extensions, tours \};\n=======\n([\s\S]*?)^>>>>>>>.*\n/m;
    if(!conflict.test(result))throw Error('Conflito de store diferente da composição revisada.');
    result=result.replace(conflict,'$1').replace('cityTaxes, registrationStatus, registerDoor };','cityTaxes, registrationStatus, registerDoor, extensions, tours };');
  }else if(merged.status!==0)throw Error(merged.stderr||'Conflito em '+file);
  if(/^(<<<<<<<|=======|>>>>>>>)/m.test(result))throw Error('Conflito pendente: '+file);
  const relative='server/gamemode/residences/'+file;
  write(path.join(temp,'patch-base',relative),old);write(path.join(temp,'patch-next',relative),result);
  write(path.join(temp,'composed',relative),result);
  manifest.files.push({path:relative,before:hash(old),after:hash(result)});
}
for(const file of added){const relative='server/gamemode/residences/'+file,s=read(path.join(impl,relative));write(path.join(temp,'patch-next',relative),s);write(path.join(temp,'composed',relative),s);manifest.files.push({path:relative,before:null,after:hash(s)});}
const migration=read(path.join(impl,'migrations/006_residence_extensions.sql')),migrationPath='server/gamemode/residences/006_residence_extensions.sql';
write(path.join(temp,'patch-next',migrationPath),migration);write(path.join(temp,'composed',migrationPath),migration);manifest.files.push({path:migrationPath,before:null,after:hash(migration)});
// Retain unchanged files in the isolated composition for verification, never in the delta.
for(const file of fs.readdirSync(source))if(fs.statSync(path.join(source,file)).isFile()&&!files.includes(file)&&!added.includes(file))write(path.join(temp,'composed/server/gamemode/residences',file),read(path.join(source,file)));
const diff=cp.spawnSync('git',['diff','--no-index','--binary','--','patch-base','patch-next'],{cwd:temp,encoding:'utf8'});
if(![0,1].includes(diff.status))throw Error(diff.stderr);
let patch=diff.stdout.replaceAll('a/patch-base/','a/').replaceAll('b/patch-next/','b/').replaceAll('a/patch-next/','a/');
write(path.join(output,'residencias-0.5.2.patch'),patch);write(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
cp.execFileSync('git',['apply','--check',path.join(output,'residencias-0.5.2.patch')],{cwd:path.join(temp,'patch-base')});
console.log('Delta IPTU3 conferido; composição isolada: '+path.join(temp,'composed'));
