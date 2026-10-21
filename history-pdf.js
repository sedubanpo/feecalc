// Minimal PDF image writer. Each already-paginated document becomes one A4 page.
// No external PDF service and no student data leaves the browser.
window.FeeHistoryPdf={async create(canvases){
 const encoder=new TextEncoder(),bytes=s=>encoder.encode(s),parts=[],offsets=[0];let size=0;
 const append=b=>{parts.push(b);size+=b.length;},obj=(n,body)=>{offsets[n]=size;append(bytes(n+' 0 obj\n'));for(const b of body)append(typeof b==='string'?bytes(b):b);append(bytes('\nendobj\n'));};
 append(bytes('%PDF-1.4\n'));
 obj(1,['<< /Type /Catalog /Pages 2 0 R >>']);obj(2,[`<< /Type /Pages /Count ${canvases.length} /Kids [${canvases.map((_,i)=>(3+i*3)+' 0 R').join(' ')}] >>`]);
 for(let i=0;i<canvases.length;i++){const c=canvases[i];if(c.height/c.width>802/555)throw Error('안내 페이지가 너무 길어 읽기 쉬운 크기로 저장할 수 없습니다.');const n=3+i*3,blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.94));if(!blob)throw Error('PDF 이미지 변환 실패');const jpeg=new Uint8Array(await blob.arrayBuffer()),w=555,h=c.height/c.width*w,rw=w,rh=h,x=(595-rw)/2,y=822-rh,content=`q ${rw} 0 0 ${rh} ${x} ${y} cm /Im0 Do Q`;
  obj(n,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`]);
  obj(n+1,[`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream']);
  obj(n+2,[`<< /Length ${bytes(content).length} >>\nstream\n${content}\nendstream`]);
 }
 const xref=size;append(bytes(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`));for(const offset of offsets.slice(1))append(bytes(String(offset).padStart(10,'0')+' 00000 n \n'));append(bytes(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return new Blob(parts,{type:'application/pdf'});
}};
