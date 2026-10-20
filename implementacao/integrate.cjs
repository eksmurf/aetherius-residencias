'use strict';
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const option = name => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const backend = option('server'), frontend = option('client');
if (!backend || !frontend) throw Error('Uso: node integrate.cjs --server=/caminho/aetherius-server/server --client=/caminho/aetherius-client/client [--apply]');
const serverRoot = path.resolve(backend), clientRoot = path.resolve(frontend);
const phasePath = path.join(serverRoot,'gamemode/phase0-basic.js');
const bridgePath = path.join(clientRoot,'src/services/services/BridgeService.ts');
const htmlPath = path.join(clientRoot,'index.html');
for (const file of [phasePath,bridgePath,htmlPath]) if (!fs.existsSync(file)) throw Error(`Fonte oficial não encontrada: ${file}`);
const changes = [];
function prepare(file, content) {
  if (!fs.existsSync(file) || fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n') !== content.replace(/\r\n/g,'\n')) changes.push({file,content});
}
function insertBefore(source, anchor, addition) {
  if (source.split(anchor).length !== 2) throw Error(`Âncora de integração ambígua/ausente: ${anchor}`);
  return source.replace(anchor, addition + anchor);
}
function copyTree(from, to) {
  for (const entry of fs.readdirSync(from,{withFileTypes:true})) {
    const source=path.join(from,entry.name), target=path.join(to,entry.name);
    if (entry.isDirectory()) copyTree(source,target);
    else prepare(target,fs.readFileSync(source,'utf8'));
  }
}
copyTree(path.join(__dirname,'server/gamemode/residences'),path.join(serverRoot,'gamemode/residences'));
copyTree(path.join(__dirname,'client/residences'),path.join(clientRoot,'residences'));
const configPath=path.join(serverRoot,'config/residences.json');
if (!fs.existsSync(configPath)) prepare(configPath,fs.readFileSync(path.join(__dirname,'server/config/residences.json'),'utf8'));
let phase=fs.readFileSync(phasePath,'utf8');
if (!phase.includes('// AETHERIUS_RESIDENCES_V1')) {
  phase += '\n// AETHERIUS_RESIDENCES_V1\nif (typeof mp !== "undefined") {\n  require(path.join(gamemodeDir, "residences/install.cjs")).install({ mp, gamemodeDir })\n    .catch(error => console.error("[residences] Falha de inicialização; interações bloqueadas até corrigir a configuração e reiniciar:", error.message));\n}\n';
  prepare(phasePath,phase);
}
let bridge=fs.readFileSync(bridgePath,'utf8');
if (!bridge.includes('// AETHERIUS_RESIDENCES_FOCUS_V1')) {
  bridge=insertBefore(bridge,'    if (args[0] !== "cef::ui:event") {',
    '    // AETHERIUS_RESIDENCES_FOCUS_V1\n    if (args[0] === "aetherius-residences:focus") {\n      this.sp.browser.setFocused(args[1] === true);\n      if (args[1] === true) this.sp.browser.setVisible(true);\n      return;\n    }\n');
}
if (!bridge.includes('// AETHERIUS_RESIDENCES_PACKET_V1')) {
  bridge=insertBefore(bridge,'    if (msgContent["customPacketType"] === "aetheriusAdmin") {',
    '    // AETHERIUS_RESIDENCES_PACKET_V1\n    if (msgContent["customPacketType"] === "aetheriusResidences") {\n      this.sp.browser.executeJavaScript("window.AetheriusResidences && window.AetheriusResidences.receive(" + JSON.stringify(msgContent["response"]) + ")");\n      return;\n    }\n');
}
prepare(bridgePath,bridge);
let html=fs.readFileSync(htmlPath,'utf8');
if (!html.includes('residences/style.css')) html=insertBefore(html,'</head>','<link rel="stylesheet" href="residences/style.css">\n');
if (!html.includes('residences/app.js')) html=insertBefore(html,'</body>','<script src="residences/app.js"></script>\n');
prepare(htmlPath,html);
if (args.includes('--apply')) {
  const backup=path.join(serverRoot,'residences-backups',new Date().toISOString().replace(/[:.]/g,'-'));
  for (const [index,change] of changes.entries()) {
    if (fs.existsSync(change.file)) {
      fs.mkdirSync(backup,{recursive:true}); fs.copyFileSync(change.file,path.join(backup,`${index}-${path.basename(change.file)}`));
    }
    fs.mkdirSync(path.dirname(change.file),{recursive:true}); fs.writeFileSync(change.file,change.content,'utf8');
  }
  if(changes.length) { fs.mkdirSync(backup,{recursive:true}); fs.writeFileSync(path.join(backup,'files.json'),JSON.stringify(changes.map(c=>c.file),null,2)); }
}
process.stdout.write(JSON.stringify({applied:args.includes('--apply'),files:changes.map(c=>c.file),databaseModified:false,clientBuildRequired:true},null,2)+'\n');
