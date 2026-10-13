'use strict';
const ORIGINAL_CSS = `html body { filter:none !important; background:#ffffff !important; color:#17212c !important; }
html body #inbox-html-wrapper { color:#17212c !important; }
html body #inbox-html-wrapper a { color:#2467a8; }
html body img { filter:none !important; }`;
function rgb(value) {
  const m = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value || '');
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
}
function luminance([r,g,b]) {
  const c=[r,g,b].map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(fg,bg) {
  const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function repairOriginalColours(document) {
  const changes=[],win=document.defaultView;
  if (!win?.getComputedStyle) return changes;
  for (const element of document.querySelectorAll?.('#inbox-html-wrapper *') || []) {
    if (!Array.from(element.childNodes || []).some(n=>n.nodeType===3 && n.textContent?.trim())) continue;
    const foreground=rgb(win.getComputedStyle(element).color);
    if (!foreground || foreground[3]===0) continue;
    let background=[255,255,255,1], hasBackgroundImage=false;
    for (let node=element;node;node=node.parentElement) {
      const style=win.getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage!=='none') { hasBackgroundImage=true;break; }
      const candidate=rgb(style.backgroundColor);
      if (candidate && candidate[3]>.95) { background=candidate;break; }
    }
    if (hasBackgroundImage) continue;
    const blended=foreground.slice(0,3).map((x,i)=>x*foreground[3]+background[i]*(1-foreground[3]));
    if (contrast(blended,background)>=4.5) continue;
    const colour=contrast([23,33,44],background)>=contrast([242,245,250],background)?'#17212c':'#f2f5fa';
    const change={element,value:element.style.getPropertyValue('color'),priority:element.style.getPropertyPriority('color')};
    element.style.setProperty('color',colour,'important');
    change.colour=element.style.getPropertyValue('color'); changes.push(change);
  }
  return changes;
}
function restoreOriginalColours(changes) {
  for (const {element,value,priority,colour} of changes || []) {
    if (element.style.getPropertyValue('color')===colour && element.style.getPropertyPriority('color')==='important')
      element.style.setProperty('color',value,priority);
  }
}
module.exports={ORIGINAL_CSS,repairOriginalColours,restoreOriginalColours,rgb,contrast};
