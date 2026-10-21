// Deterministic documentation illustrations built from the plugin's real SVG renderers.
// All project names, percentages and reset times below are sample data.
import { writeFile } from 'node:fs/promises';
import { keyIconSvg } from '../plugin/plugin/key-icon.js';
import { quotaIconSvg } from '../plugin/plugin/quota-icon.js';
import { setLocale } from '../plugin/plugin/i18n.js';
setLocale('zh-CN');
const now = Date.UTC(2026, 0, 1);
const font = 'Arial, PingFang SC, Microsoft YaHei, sans-serif';
const text = (x,y,value,size=18,color='#a5b4c8',extra='') => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${color}" ${extra}>${value}</text>`;
function embed(svg, x, y, size, id) {
  const inner = svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replaceAll('key-clip',`key-${id}`).replaceAll('quota-clip',`quota-${id}`);
  return `<g transform="translate(${x} ${y}) scale(${size/144})">${inner}</g>`;
}
const projects = [
  ['storefront','修复支付回调','claude','waiting'],
  ['storefront','购物车重构','codex','working'],
  ['api-service','接口性能优化','cursor','working'],
  ['mobile-app','登录流程测试','gemini','done'],
  ['docs-site','更新使用手册','opencode','idle'],
];
const icon = (row,slot) => keyIconSvg({slot,state:row[3],project:{repo:row[0],displayName:row[1],agents:[{agentType:row[2],state:row[3]}]}});
const quota = (provider,values) => quotaIconSvg(provider,{environmentId:'',environmentName:'本机',status:'ok',windows:values.map(([kind,label,usedPercent,hours])=>({kind,label,usedPercent,resetsAt:now+hours*3600000}))},now);
let hero = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="650" viewBox="0 0 1280 650"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101a2c"/><stop offset="1" stop-color="#080d17"/></linearGradient></defs><rect width="1280" height="650" rx="24" fill="url(#bg)"/>`;
hero+=text(54,56,'ULANZI × ORCA',16,'#7dd3fc','letter-spacing="4"')+text(54,116,'把并行开发，放到指尖。',42,'#f8fafc','font-weight="bold"')+text(54,155,'看状态 · 切终端 · 查额度',21);
hero+=`<rect x="38" y="190" width="1204" height="376" rx="24" fill="#182130" stroke="#2b3b51"/>`;
const tiles=[...projects.map((p,i)=>icon(p,i+1)),keyIconSvg({slot:6,state:'empty'}),quota('claude',[['session','会话',28,2],['weekly','每周',46,72]]),quota('codex',[['weekly','每周',32,96]])];
tiles.forEach((svg,i)=>{const x=66+i*146;hero+=embed(svg,x,244,126,`hero${i}`);hero+=text(x+63,410,['等你确认','正在工作','正在工作','本轮完成','终端空闲','自动补位','Claude 额度','Codex 额度'][i],15,i===0?'#fbbf24':'#cbd5e1','text-anchor="middle"');});
hero+=text(67,220,'工作区按钮 · 放几个，启用几个',15)+text(937,220,'额度按钮 · 单独绑定 Agent',15);
hero+=`<path d="M80 450h1120" stroke="#2b3b51"/>`+text(80,489,'本机 + 远程工作区',20,'#f1f5f9')+text(459,489,'一个 worktree，一个坑位',20,'#f1f5f9')+text(900,489,'按下，跳到对应终端',20,'#f1f5f9');
hero+=text(54,610,'插件实际图标渲染 · 示意布局，非设备实拍 · 项目、状态及额度均为示例数据',15,'#8291a9')+'</svg>';
await writeFile(new URL('../docs/images/overview.svg',import.meta.url),hero);
let flow=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="620" viewBox="0 0 1280 620"><rect width="1280" height="620" rx="24" fill="#0f1726"/>`+text(44,54,'坑位跟着工作区走，不用跟着项目重新配置',29,'#f8fafc','font-weight="bold"')+text(44,89,'示例：只放 3 个工作区按钮；A / B / C / D 代表不同 worktree。',17);
const rows=[['01  首次打开','按最近活跃时间填入',['A','B','C']],['02  活跃时间变化','D 变为最活跃，当前页面仍保留位置',['A','B','C']],['03  关闭 B / 切回页面','按最新活跃时间重排，D 自动进入',['D','C','A']]];
rows.forEach(([title,desc,items],i)=>{const y=125+i*145;flow+=text(46,y+36,title,23,'#e2e8f0','font-weight="bold"')+text(46,y+72,desc,17);items.forEach((name,j)=>{const x=665+j*186;flow+=`<rect x="${x}" y="${y}" width="162" height="105" rx="16" fill="#1e293b" stroke="${name==='D'?'#38bdf8':'#475569'}"/>`+text(x+18,y+26,`坑位 ${j+1}`,13)+text(x+81,y+76,name,39,name==='D'?'#38bdf8':'#f8fafc','text-anchor="middle" font-weight="bold"');});});
flow+=text(44,593,'关闭工作区或返回 Deck 页面时重排；停留期间保持稳定。远程断连会保留坑位。',16)+'</svg>';
await writeFile(new URL('../docs/images/slots.svg',import.meta.url),flow);
console.log('Rendered docs/images/overview.svg and slots.svg (sample data only).');
