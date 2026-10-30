'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function({serverRoot,clientRoot,prepare,insertBefore,copyTree}){
  const coreIndexPath=path.join(clientRoot,'ui-core/frontend/index.html');
  const coreSystemPath=path.join(serverRoot,'ts/systems/aetheriusUiSystem.ts');
  const inventoryPath=path.join(serverRoot,'ts/systems/aetheriusInventoryService.ts');
  for(const file of [coreIndexPath,coreSystemPath,inventoryPath])if(!fs.existsSync(file))throw Error('Integração CORE UI ausente: '+file);
  copyTree(path.join(__dirname,'client/properties'),path.join(clientRoot,'ui-core/frontend/modules/properties'));
  let page=fs.readFileSync(coreIndexPath,'utf8');
  if(!page.includes('modules/properties/properties.js')){
    page=insertBefore(page,'</head>','<link rel="stylesheet" href="modules/properties/properties.css">\n');
    page=insertBefore(page,'</body>','<script src="modules/properties/properties.js"></script>\n');
  }
  prepare(coreIndexPath,page);
  let core=fs.readFileSync(coreSystemPath,'utf8');
  if(!core.includes('// RESIDENCES_PROPERTIES_V3')){
    const anchor=core.split('\n').find(line=>line.includes('this.registerExternalModule("map",'));
    if(!anchor)throw Error('Registro de módulos do CORE UI não encontrado.');
    core=insertBefore(core,anchor,`    // RESIDENCES_PROPERTIES_V3
    this.registerExternalModule("properties", router => {
      const actions = ["snapshot","public","addMember","setFamily","removeMember","payTax","listSale","cancelSale","status"];
      const disposers = actions.map(action => router.register("properties", action, (context, payload) => {
        const api = (globalThis as any).aetheriusResidencesBridge;
        if (!api?.healthy()) return {ok:false,error:{code:"UNAVAILABLE",message:"Residências temporariamente indisponíveis."}};
        return api.request(context.actorId, action, payload);
      }));
      return () => disposers.forEach(dispose => dispose());
    });
`);
  }
  prepare(coreSystemPath,core);
  let source=fs.readFileSync(inventoryPath,'utf8').replace(/\r\n/g,'\n');
  if(!source.includes('// RESIDENCES_BOUND_KEYS_V3')){
    source=insertBefore(source,'    const equipment = this.host.get(actorId, "equipment") || {};',`    // RESIDENCES_BOUND_KEYS_V3
    const residences = (globalThis as any).aetheriusResidencesBridge;
    const boundKeys: Row[] = residences ? await residences.inventoryKeys(actorId, "personal") : [];
    for (let i = inventory.length - 1; i >= 0; i--) if (residences?.isLegacyKey(inventory[i])) inventory.splice(i, 1);
`);
    source=insertBefore(source,'    const hotkeys: Record<string, string> = {};','    items.push(...boundKeys);\n');
    const details='description: "", previewToken: magic ? null :';
    if(source.split(details).length!==2)throw Error('Contrato de detalhes de inventário mudou.');
    source=source.replace(details,'description: row!.description || "", previewToken: magic || row!.bound === true ? null :');
    source=insertBefore(source,'    const ref = this.requireCharacter(actorId);\n    await this.ensureSchema();\n    const fingerprint',
      '    if ([payload.itemId, payload.favoriteId].some(value => typeof value === "string" && value.startsWith("residence-key:"))) fail("BOUND_KEY", "Chave residencial não pode ser alterada ou transferida.");\n');
  }
  prepare(inventoryPath,source);
};
