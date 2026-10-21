// A dependency-free, conservative text transformer for Cordis YAML with !!js expressions.

// Intentionally does not deserialize YAML; unfamiliar preset layouts fail closed.

export function indentOf(line) { return line.match(/^ */)[0].length; }

export function blockEnd(lines, start, startIndent, cap=lines.length) {
  for (let i=start+1;i<cap;i++) {
    const t=lines[i].trim();
    if(!t || t.startsWith('#'))continue;
    if(indentOf(lines[i]) <= startIndent)return i;
  }
  return cap;
}

export function findRow(lines,id,lo=0,hi=lines.length,requiredIndent=null) {
  const hits=[];
  for(let i=lo;i<hi;i++)if(lines[i].trim()===`- id: ${id}` && (requiredIndent===null || indentOf(lines[i])===requiredIndent))hits.push(i);
  if(hits.length!==1)throw new Error(`Expected exactly one '${id}' entry; found ${hits.length}. No changes made.`);
  const start=hits[0],indent=indentOf(lines[start]);
  return {start,end:blockEnd(lines,start,indent,hi),indent};
}

export function findConfig(lines,row) {
  const idt=row.indent+2,hits=[];
  for(let i=row.start+1;i<row.end;i++)if(indentOf(lines[i])===idt && lines[i].trim()==='config:')hits.push(i);
  if(hits.length!==1)throw new Error(`Expected one config: in plugin row at line ${row.start+1}`);
  return {start:hits[0],end:blockEnd(lines,hits[0],idt,row.end),indent:idt};
}

export function putPersona(lines,policyLines) {
  const row=findRow(lines,'persona');
  const cfg=findConfig(lines,row);
  const prefix=lines.slice(cfg.start+1,cfg.end).some(s=>indentOf(s)===cfg.indent+2 && /^\s*prefix:/.test(s));
  if(!prefix)throw new Error('Persona prefix missing; refusing to replace or synthesize identity.');
  if(lines.slice(cfg.start+1,cfg.end).some(s=>indentOf(s)===cfg.indent+2 && /^\s*complete:\s*true\b/.test(s)))throw new Error('Persona complete:true would suppress suffix and tool guidance; refusing.');
  const suffixIndices=[];
  for(let i=cfg.start+1;i<cfg.end;i++)if(indentOf(lines[i])===cfg.indent+2 && /^\s*suffix:/.test(lines[i]))suffixIndices.push(i);
  if(suffixIndices.length>1)throw new Error('Multiple persona suffix fields found.');
  const prefixIndent=' '.repeat(cfg.indent+2),bodyIndent=' '.repeat(cfg.indent+4);
  const added=policyLines.map(x=>bodyIndent+x);
  if(suffixIndices.length===0) {
    lines.splice(cfg.end,0,prefixIndent+'suffix: |-',...added);
    return;
  }
  const idx=suffixIndices[0];
  const type=lines[idx].trim();
  if(!/^suffix:\s*[|>][-+]?\s*$/.test(type))throw new Error('Existing persona suffix is not a YAML block scalar; convert it to | before rerendering to avoid losing content.');
  const end=blockEnd(lines,idx,cfg.indent+2,cfg.end);
  if(lines.slice(idx+1,end).join('\n').includes('OH-MY-DSH SOURCE INSPECTION'))return;
  lines.splice(end,0,bodyIndent+'',...added);
}

export function putToolRead(lines,readLimit,readMaxBytes) {
  const row=findRow(lines,'tool-fs');
  const configAt=[];
  for(let i=row.start+1;i<row.end;i++)if(indentOf(lines[i])===row.indent+2 && lines[i].trim()==='config:')configAt.push(i);
  if(configAt.length>1)throw new Error('Multiple tool-fs config entries.');
  const ident=' '.repeat(row.indent+2),keyindent=' '.repeat(row.indent+4);
  if(configAt.length===0) {
    lines.splice(row.end,0,ident+'config:',keyindent+`readLimit: ${readLimit}`,keyindent+`readMaxBytes: ${readMaxBytes}`);
    return;
  }
  const start=configAt[0],end=blockEnd(lines,start,row.indent+2,row.end);
  const wanted={readLimit,readMaxBytes};
  const present=new Set();
  for(let i=start+1;i<end;i++){
    if(indentOf(lines[i])!==row.indent+4)continue;
    const m=lines[i].trim().match(/^(readLimit|readMaxBytes):\s*.*$/);
    if(!m)continue;
    if(present.has(m[1]))throw new Error(`Duplicate ${m[1]} key in tool-fs config.`);
    lines[i]=keyindent+`${m[1]}: ${wanted[m[1]]}`;
    present.add(m[1]);
  }
  const adds=Object.entries(wanted).filter(([key])=>!present.has(key)).map(([key,value])=>keyindent+`${key}: ${value}`);
  lines.splice(end,0,...adds);
}

export function renderOverlay(source,options={}) {
  const readLimit=options.readLimit===undefined?160:options.readLimit, readMaxBytes=options.readMaxBytes===undefined?32768:options.readMaxBytes;
  if(!Number.isInteger(readLimit)||readLimit<1||readLimit>2000)throw new Error('readLimit must be an integer between 1 and 2000.');
  if(!Number.isInteger(readMaxBytes)||readMaxBytes<1024||readMaxBytes>524288)throw new Error('readMaxBytes must be between 1024 and 524288.');
  const input=source.replace(/\r\n/g,'\n').split('\n');
  const root=findRow(input,'preset-standard');
  const row=input.slice(root.start,root.end).map(s=>s.startsWith(' '.repeat(root.indent))?s.slice(root.indent):s);
  if(row[0].trim()!=='- id: preset-standard')throw new Error('Unexpected root.');
  const entries=row.join('\n');
  if(!/^\s*id:\s*standard\s*$/m.test(entries) || !/^\s*plugins:\s*$/m.test(entries))throw new Error('Expected a complete Standard preset, including id and plugins.');
  const policy=[
    'OH-MY-DSH SOURCE INSPECTION (coding-agent context discipline):',
    '- Locate relevant symbols, callers, tests, and entry points with search before broad source inspection.',
    '- Prefer bounded reads around matching lines. Expand to full functions, fixtures, or contracts when needed.',
    '- A successful partial read satisfies the Harness read-before-edit observation gate; it does not prove sufficient understanding.',
    '- Read entire files when small or genuinely necessary for file-wide behavior; do not dump every possibly related file.',
    '- Keep grep, command, and test output focused; request more detail only when necessary.',
    '- Preserve privacy/security invariants, error cases, dependency effects, and all required acceptance checks.',
  ];
  putPersona(row,policy);
  putToolRead(row,readLimit,readMaxBytes);
  return `# Generated by oh-my-dsh. Regenerate from the matching DSH standard.patch.yml after upgrades.\n# This replaces preset-standard.config, so inspect other overrides before activation.\n`+row.join('\n').trimEnd()+'\n';
}

