import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
export function generate(){
 const shell=read('src/shell.html');
 const css=read('src/style.css');
 const js=['src/renderer.js','src/world.js','src/tanks.js','src/game.js','src/tactics.js','src/v03.js','src/mobility.js'].map(read).join('\n\n');
 const result=shell.replace('/*INLINE_CSS*/',css).replace('/*INLINE_JS*/',js);
 if(result.includes('/*INLINE_CSS*/')||result.includes('/*INLINE_JS*/'))throw Error('Unresolved build placeholders');
 if(/<script[^>]+src=|<link[^>]+href=/.test(result))throw Error('External asset dependency detected');
 new Function(js);
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const html=generate();fs.writeFileSync(path.join(root,'index.html'),html);console.log('Built offline index.html ('+Buffer.byteLength(html)+' bytes)');
}