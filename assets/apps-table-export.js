/* Standalone XLSX export for the local prototype. Inputs must already be permission-filtered. */
window.AppsTableExport = (() => {
  const encoder = new TextEncoder();
  const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const column = n => { let label=''; for(n++;n;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label; return label; };
  function zip(files) {
    const locals=[],entries=[];let offset=0;
    const header=(size,values)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);values.forEach(([at,value,width])=>width===2?view.setUint16(at,value,true):view.setUint32(at,value>>>0,true));return bytes;};
    for(const [path,source] of Object.entries(files)) {
      const name=encoder.encode(path),data=encoder.encode(source);let crc=0xffffffff;
      for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
      const local=header(30,[[0,0x04034b50,4],[4,20,2],[12,33,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);
      const entry=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[14,33,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);
      locals.push(local,name,data);entries.push(entry,name);offset+=local.length+name.length+data.length;
    }
    const size=entries.reduce((sum,p)=>sum+p.length,0),end=header(22,[[0,0x06054b50,4],[8,Object.keys(files).length,2],[10,Object.keys(files).length,2],[12,size,4],[16,offset,4]]);
    const parts=[...locals,...entries,end],result=new Uint8Array(offset+size+end.length);let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result;
  }
  function build(sheetName,headers,rows) {
    const name=String(sheetName).replace(/[\\/\[\]*?:]/g,' ').replace(/^'+|'+$/g,'').slice(0,31)||'数据表';
    const matrix=[headers,...rows];
    const sheet=matrix.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{
      const ref=column(j)+(i+1),style=i===0?' s="1"':'';
      if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
      if(typeof v==='boolean')return `<c r="${ref}" t="b"><v>${v?1:0}</v></c>`;
      const text=v!==null&&typeof v==='object'?JSON.stringify(v):v;
      // Explicit strings, including values starting with =, never become executable formulas.
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    return zip({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml':`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${headers.length}" width="22" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:${column(headers.length-1)}${matrix.length}"/></worksheet>`
    });
  }
  function download(app,table,rows,users,metadata=false) {
    const headers=[...table.fields.map(f=>f[0]),'数据所属人','所属部门','更新时间',...(metadata?['记录 ID','创建时间']:[])];
    const data=rows.map(r=>[...r.values,users[r.owner]?.name||r.owner,users[r.owner]?.department||'',r.updated,...(metadata?[r.id,r.created||'']:[])]);
    const bytes=build(table.name,headers,data),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;
    anchor.download=`${app.name}-${table.name}-${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})}.xlsx`.replace(/[\\/:*?"<>|]/g,'_');
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  return {build,download};
})();
