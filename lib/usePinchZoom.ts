"use client";
import {useEffect,useRef,type RefObject} from 'react';
export function clampZoom(value:number){return Math.max(.25,Math.min(2.5,value));}
export function usePinchZoom(viewport:RefObject<HTMLDivElement|null>,zoom:number,onZoom:(zoom:number)=>void){
 const currentZoom=useRef(zoom);useEffect(()=>{currentZoom.current=zoom;},[zoom]);
 useEffect(()=>{const el=viewport.current;if(!el)return;let start: {distance:number;zoom:number;x:number;y:number}|null=null;
 const distance=(t:TouchList)=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 const begin=(event:TouchEvent)=>{if(event.touches.length!==2)return;event.preventDefault();const r=el.getBoundingClientRect(),x=(event.touches[0].clientX+event.touches[1].clientX)/2-r.left,y=(event.touches[0].clientY+event.touches[1].clientY)/2-r.top;start={distance:Math.max(1,distance(event.touches)),zoom:currentZoom.current,x:(el.scrollLeft+x)/currentZoom.current,y:(el.scrollTop+y)/currentZoom.current};};
 const move=(event:TouchEvent)=>{if(event.touches.length!==2||!start)return;event.preventDefault();const value=clampZoom(start.zoom*distance(event.touches)/start.distance);const r=el.getBoundingClientRect(),x=(event.touches[0].clientX+event.touches[1].clientX)/2-r.left,y=(event.touches[0].clientY+event.touches[1].clientY)/2-r.top;onZoom(value);requestAnimationFrame(()=>{el.scrollLeft=start?start.x*value-x:el.scrollLeft;el.scrollTop=start?start.y*value-y:el.scrollTop;});};
 const end=()=>{start=null;};el.addEventListener('touchstart',begin,{passive:false});el.addEventListener('touchmove',move,{passive:false});el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);return()=>{el.removeEventListener('touchstart',begin);el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',end);};
 // Keep a pinch anchor stable throughout a gesture; update only after fingers leave.
 },[viewport,onZoom]);
}
