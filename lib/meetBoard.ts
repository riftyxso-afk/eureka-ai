import type { StudyMapNode } from './study-mindmap';
export function boardSections(markdown: string) {
 const result: {title:string;content:string}[]=[];
 for(const part of markdown.split(/(?=^##\s+)/m)){if(!part.trim())continue;const heading=part.match(/^#{1,3}\s+(.+)$/m);result.push({title:heading?.[1]?.replace(/[*_`]/g,'')||'Gambaran umum',content:part.trim()});}
 return result;
}
export function boardMap(markdown:string,title:string):StudyMapNode[]{
 const rootTitle=markdown.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g,'')||title;
 const nodes:StudyMapNode[]=[{id:'root',parentId:null,label:rootTitle.slice(0,90),detail:'Gambaran besar materi di papan'}];let branch='root',child='root';
 for(const line of markdown.split('\n')){if(nodes.length>=24)break;const heading=line.match(/^(#{2,3})\s+(.+)/),point=line.match(/^\s*[-*]\s+(.+)/);if(!heading&&!point)continue;
 const label=(heading?.[2]||point?.[1]||'').replace(/[*_`]/g,'').trim();if(!label)continue;const id='b'+nodes.length;
 const parentId=heading?(heading[1].length===2?'root':branch):child;
 nodes.push({id,parentId,label:label.slice(0,90),detail:label.slice(0,360)});if(heading){child=id;if(heading[1].length===2)branch=id;}
 }
 return nodes;
}
