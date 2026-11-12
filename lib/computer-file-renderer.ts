/** Fixed renderer. User content is passed as JSON data, never evaluated as code. */
export const computerFileRenderer = String.raw`
import base64,csv,html,io,json,pathlib,re,subprocess,sys,textwrap,zipfile,time,os,signal
d=json.loads(base64.b64decode(sys.argv[1]))
root=pathlib.Path('/tmp/eureka-exports')/d['job']
root.mkdir(parents=True,exist_ok=False)
title=d['title']
text=d['text']
esc=html.escape
lines=text.splitlines()
blocks=[]
table=[]
def flush():
 if not table:return
 rows=[r for r in table if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in r)]
 blocks.append('<table>'+''.join('<tr>'+''.join(('<th>' if i==0 else '<td>')+esc(c)+('</th>' if i==0 else '</td>') for c in row)+'</tr>' for i,row in enumerate(rows))+'</table>')
 table.clear()
for line in lines:
 if line.strip().startswith('|') and line.strip().endswith('|'):
  table.append([c.strip() for c in line.strip().strip('|').split('|')]);continue
 flush()
 if not line.strip():continue
 m=re.match(r'^(#{1,4})\s+(.+)',line)
 if m:blocks.append('<h'+str(min(3,len(m[1])))+'>'+esc(m[2])+'</h'+str(min(3,len(m[1])))+'>')
 else:blocks.append('<p>'+esc(line).replace('**','')+'</p>')
flush()
refs=''.join('<p>'+str(i+1)+'. '+esc(s['title'])+' — '+esc(s['url'])+'</p>' for i,s in enumerate(d['sources']))
body='<h1>'+esc(title)+'</h1>'+''.join(blocks)+('<h2>Sumber</h2>'+refs if refs else '')
style='@page{size:A4;margin:20mm}body{font-family:DejaVu Sans,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#24222b}h1{font-size:25pt;color:#6241ab}h2{font-size:17pt;margin-top:22pt}h3{font-size:13pt}h1,h2,h3{page-break-after:avoid}p{margin:8pt 0}table{border-collapse:collapse;width:100%;font-size:10pt}td,th{border:1px solid #ddd;padding:8pt;text-align:left;overflow-wrap:anywhere}th{background:#f1edf8}tr{page-break-inside:avoid}'
source=root/'document.html'
source.write_text('<!doctype html><meta charset="utf-8"><style>'+style+'</style>'+body,encoding='utf8')
result=[]
for fmt in d['formats']:
 out=root/('hasil.'+fmt)
 if fmt=='docx':
  ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  paras=[]
  pending=[]
  def paragraph(value,heading=False):
   props='<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' if heading else ''
   return '<w:p>'+props+'<w:r><w:t xml:space="preserve">'+esc(value)+'</w:t></w:r></w:p>'
  def flush_doc_table():
   if not pending:return
   rows=[r for r in pending if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in r)]
   borders='<w:tblBorders>'+''.join('<w:'+side+' w:val="single" w:sz="4" w:color="DDD7E7"/>' for side in ['top','left','bottom','right','insideH','insideV'])+'</w:tblBorders>'
   table='<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'+borders+'</w:tblPr>'
   for i,row in enumerate(rows):
    table+='<w:tr>'+''.join('<w:tc><w:tcPr>'+('<w:shd w:fill="F1EDF8"/>' if i==0 else '')+'</w:tcPr>'+paragraph(c)+'</w:tc>' for c in row)+'</w:tr>'
   paras.append(table+'</w:tbl><w:p/>');pending.clear()
  paras.append(paragraph(title,True))
  for line in lines+(['## Sumber']+[s['title']+' '+s['url'] for s in d['sources']] if d['sources'] else []):
   value=re.sub(r'^#+\s*','',line).replace('**','')
   if value==title:continue
   if line.strip().startswith('|') and line.strip().endswith('|'):
    pending.append([c.strip() for c in line.strip().strip('|').split('|')]);continue
   flush_doc_table()
   paras.append(paragraph(value,line.startswith('#')))
  flush_doc_table()
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
   z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
   z.writestr('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="style" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
   z.writestr('word/document.xml','<w:document xmlns:w="'+ns+'"><w:body>'+''.join(paras)+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>')
   z.writestr('word/styles.xml','<w:styles xmlns:w="'+ns+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="23"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="160"/></w:pPr><w:rPr><w:b/><w:color w:val="6241AB"/><w:sz w:val="32"/></w:rPr></w:style></w:styles>')
 elif fmt=='xlsx':
  rows=[]
  for line in lines:
   if line.strip().startswith('|') and line.strip().endswith('|'):
    row=[c.strip() for c in line.strip().strip('|').split('|')]
    if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in row):rows.append(row)
  if not rows:rows=[['Materi'],[title]]+[[line] for line in lines if line.strip()]
  sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="100" width="32" customWidth="1"/></cols><sheetData>'
  for i,row in enumerate(rows,1):
   sheet+='<row r="'+str(i)+'">'
   for j,value in enumerate(row):
    col='';n=j+1
    while n: n,r=divmod(n-1,26);col=chr(65+r)+col
    sheet+='<c r="'+col+str(i)+'" t="inlineStr"><is><t xml:space="preserve">'+esc(value)+'</t></is></c>'
   sheet+='</row>'
  sheet+='</sheetData></worksheet>'
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
   z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="book" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
   z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Materi" sheetId="1" r:id="sheet"/></sheets></workbook>')
   z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="sheet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
   z.writestr('xl/worksheets/sheet1.xml',sheet)
 elif fmt in ('pdf','odt'):
  src=source
  filters={'pdf':'pdf:writer_pdf_Export','odt':'odt'}
  command=['libreoffice','-env:UserInstallation=file://'+str(root/'lo-profile'),'--headless','--convert-to',filters[fmt],'--outdir',str(root),str(src)]
  actual=root/(src.stem+'.'+fmt)
  process=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
  try:
   deadline=time.monotonic()+45
   while time.monotonic()<deadline:
    if actual.exists() and actual.stat().st_size>0:
     if fmt=='pdf' and b'%%EOF' in actual.read_bytes()[-1024:]:break
     if fmt=='odt' and zipfile.is_zipfile(actual):break
    if process.poll() is not None:break
    time.sleep(.3)
   if not actual.exists() or actual.stat().st_size==0:raise RuntimeError('Konversi '+fmt+' belum berhasil')
  finally:
   if process.poll() is None:
    os.killpg(process.pid,signal.SIGTERM)
    try:process.wait(timeout=3)
    except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()
   else:process.wait()
  actual.rename(out)
 elif fmt in ('txt','md'):out.write_text(text,encoding='utf8')
 elif fmt=='csv':
  rows=[]
  for line in lines:
   if line.strip().startswith('|') and line.strip().endswith('|'):
    row=[c.strip() for c in line.strip().strip('|').split('|')]
    if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in row):rows.append(row)
  if not rows:rows=[['Materi'],[title]]+[[line] for line in lines if line.strip()]
  with out.open('w',encoding='utf-8-sig',newline='') as f:csv.writer(f).writerows([["'"+c if c.startswith(('=','+','-','@')) else c for c in row] for row in rows])
 elif fmt=='png':
  content=[]
  for line in lines:
   value=re.sub(r'[#*|]+',' ',line).strip()
   if not value or value==title or re.fullmatch(r'[-: ]+',value):continue
   content.append(value)
  wrapped=[part for line in content for part in textwrap.wrap(line,72)]
  wrapped=wrapped[:65]
  height=max(900,260+len(wrapped)*36)
  command=['convert','-size','1200x'+str(height),'xc:#faf8ff','-font','DejaVu-Sans','-fill','#7451be','-draw','rectangle 0,0 1200,12','-pointsize','40']
  y=90
  for line in textwrap.wrap(title,44):
   command+=['-annotate','+64+'+str(y),line];y+=54
  command+=['-fill','#282333','-pointsize','24']
  y+=38
  for line in wrapped:
   command+=['-annotate','+64+'+str(y),line];y+=36
  command.append(str(out))
  subprocess.run(command,check=True,capture_output=True,timeout=35)
 elif fmt in ('image','screenshot'):
  out=root/('hasil.'+d['imageExtension'])
  out.write_bytes(base64.b64decode(d['imageData']))
 else:raise RuntimeError('Format belum didukung')
 size=out.stat().st_size
 if size<1 or size>8*1024*1024:raise RuntimeError('Ukuran file melewati batas 8 MB')
 result.append({'name':out.name,'path':str(out),'size':size})
print('EUREKA_FILES='+json.dumps(result,separators=(',',':')))
`;
