/** A self-contained preview of the shipped frontend. No Lumiverse or provider requests. */
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { emptyState } from '../src/shared';

const destination = resolve(process.argv[2] || '../KazzWare-preview.html');
const frontend = `data:text/javascript;base64,${Buffer.from(await Bun.file('dist/frontend.js').arrayBuffer()).toString('base64')}`;
const state = emptyState();
state.settings.slop = ['pale orbs', 'a shiver down', 'a dance of'];
state.settings.connectionId = 'demo';
state.turns = [
  { role: 'user', at: Date.UTC(2026, 9, 24), content: 'What did we establish about the lighthouse?' },
  { role: 'assistant', at: Date.UTC(2026, 9, 24), content: 'Three things: the light turns inland at midnight, Elias has the only key, and somebody keeps replacing the broken glass.\n\nThat last bit? Suspicious as hell. Want me to put it in the notebook?' },
];
state.pages = ['forum', 'thread', 'wiki'].map((format, i) => ({ id: `page-${i}`, format: format as 'forum' | 'thread' | 'wiki', title: ['AITA for keeping the lighthouse key?', 'The Elias defense squad is in shambles', 'Blackwater lighthouse'][i], createdAt: Date.UTC(2026, 9, 24), throughMessage: 'm1', votes: [], comments: [], posts: [
  { id: `post-${i}-1`, author: ['u/definitely_not_elias', '@unreliable_narrator', 'The Midnight Archives'][i], title: ['I was keeping them safe. Mostly.', 'Your fave is a walking red flag.', 'The light that looks back'][i], body: 'He says the locked door is for our protection. He also has the only key. I am connecting some extremely inconvenient dots here.' },
  { id: `post-${i}-2`, author: 'moth_to_a_bad_idea', title: 'Okay, but hear me out.', body: 'The fog has better communication skills than this man. Still rooting for him, unfortunately.' },
] }));
state.summaries = [{ id: 'summary', text: 'The light turns inland at midnight. Elias keeps the only key. The broken panes are repaired by an unknown visitor.', messages: 24, throughMessage: 'm1', createdAt: Date.UTC(2026, 9, 24) }];
const script = String.raw`
const { setup } = await import(FRONTEND_URL);
const state = INITIAL_STATE;
const messages = [{id:'m1',content:'The lighthouse turned its pale eye toward the shore. Elias closed his hand around the key.\n\n"Not tonight," he said. The light found them anyway.',name:'Elias',is_user:false,swipe_id:0,index_in_chat:0}];
let chatId = 'demo-chat', stateListener = () => {}, backendListener = () => {}, inputClick = () => {};
const host = document.querySelector('#stage');
function view(){return {chatName:chatId === 'other-chat' ? 'The last train / sample chat' : 'Blackwater / sample chat',messages,totalMessages:1,connections:[{id:'demo',name:'Sample connection',model:'Preview only'}],state};}
function reply(req,result){queueMicrotask(() => backendListener({...req,ok:true,result}));}
const ctx = {
  deferReady(){},ready(){},
  state:{get(){return {chatId}},subscribe(key,fn){stateListener=fn;return ()=>{}}},
  events:{on(){return ()=>{}}},
  onBackendMessage(fn){backendListener=fn;return ()=>{}},
  sendToBackend(req){
    if(req.action === 'message') return reply(req,messages[0]);
    if(req.action === 'page') return reply(req,state.pages.find(p=>p.id===req.data.pageId));
    if(req.action === 'summaryContent') return reply(req,state.summaries[0].text);
    if(req.action === 'settings') state.settings = req.data.settings;
    if(req.action === 'react') {const page=state.pages.find(p=>p.id===req.data.pageId);if(req.data.kind==='vote'){page.votes=page.votes.includes(req.data.postId)?page.votes.filter(id=>id!==req.data.postId):[...page.votes,req.data.postId]}else page.comments.push({id:String(Date.now()),postId:req.data.postId,author:'You',body:req.data.text});}
    if(req.action === 'ask') state.turns.push({role:'user',content:req.data.text},{role:'assistant',content:'Preview mode, boss. The real me uses your chosen connection. These demo messages stay in this page.'});
    if(req.action === 'edit') {const before=messages[0].content, replacement='The light swept ashore. Elias gripped the key. "Not tonight." It found them anyway.';const r=req.data.range;const after=r?before.slice(0,r.start)+'the edited selection'+before.slice(r.end):replacement;state.undo.push({id:String(Date.now()),messageId:'m1',label:'Preview edit',before,after,swipe:0,createdAt:Date.now(),status:'applied'});messages[0].content=after;}
    if(req.action === 'undo'){const u=state.undo.find(u=>u.id===req.data.undoId);messages[0].content=u.before;u.status='undone';}
    if(req.action==='summary') state.summaries.push({...state.summaries[0],id:String(Date.now())});
    if(req.action==='lorebook') state.lorebooks.push({id:'demo-book',name:'Blackwater / preview lorebook'});
    reply(req,view());
  },
  ui:{
    createFloatWidget(options){
      const wrap=document.createElement('div');wrap.className=options.width===110?'pet-wrap':'panel-wrap';const root=document.createElement('div');wrap.append(root);host.append(wrap);
      const size=(w,h)=>{wrap.style.width=w+'px';wrap.style.height=h+'px'};size(options.width,options.height);
      return {root,setVisible(v){wrap.hidden=!v},setSize:size,setFullscreen(v){wrap.classList.toggle('fullscreen',v);if(v){wrap.style.width='100%';wrap.style.height='100dvh'}},getPosition(){return {x:12,y:12}},moveTo(){},destroy(){wrap.remove()}};
    },
    registerInputBarAction(){return {onClick(fn){inputClick=fn;return ()=>{}},setEnabled(){},destroy(){}}}
  },
  registerMessageAction(){return {destroy(){}}},
  dom:{getMessageId(){return null},createSandboxFrame({html,initialHeight}){
    const element=document.createElement('iframe');element.sandbox='allow-scripts';element.style.height=initialHeight+'px';
    element.srcdoc=html.replace('<script>', '<script>window.spindleSandbox={postMessage:function(data){parent.postMessage(data,"*")}};');
    let fn=()=>{};const listener=event=>{if(event.source===element.contentWindow)fn(event.data)};window.addEventListener('message',listener);
    return {element,onMessage(callback){fn=callback},destroy(){window.removeEventListener('message',listener);element.remove()}};
  }}
};
const teardown=setup(ctx);
document.querySelector('#reopen').onclick=()=>inputClick();
document.querySelector('#switch').onchange=event=>{chatId=event.target.value||null;stateListener({chatId});};
document.querySelector('#restart').onclick=()=>location.reload();
inputClick();
window.addEventListener('pagehide',teardown,{once:true});
`;
const body = script.replace('FRONTEND_URL', JSON.stringify(frontend)).replace('INITIAL_STATE', JSON.stringify(state));
await mkdir(dirname(destination), { recursive: true });
await Bun.write(destination, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KazzWare / Cybercore preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#24292e;background-image:linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px);background-size:32px 32px;color:#d7e0e5;font:13px/1.5 system-ui,sans-serif}.preview-tools{position:fixed;left:28px;top:30px;width:225px;padding:18px;border:1px solid #71818a;background:#13191e}.preview-tools h1{font-size:22px;margin:0 0 10px}.preview-tools p{color:#afbfc8}.preview-tools button,.preview-tools select{display:block;width:100%;padding:10px;margin-top:10px;color:#eaf2f6;background:#26353f;border:1px solid #657d8b;border-radius:4px}.panel-wrap{position:fixed;right:26px;top:12px;max-height:calc(100dvh - 24px)}.pet-wrap{position:fixed;bottom:20px;left:275px}.panel-wrap.fullscreen{inset:0;max-height:100dvh;z-index:2}.pet-wrap[hidden],.panel-wrap[hidden]{display:none}@media(max-width:600px){.preview-tools{left:12px;top:12px;width:calc(100% - 24px)}.pet-wrap{left:auto;right:20px;bottom:30px;z-index:1}}
</style></head><body><aside class="preview-tools"><h1>KazzWare 0.2.0</h1><p>Interactive UI preview. Sample story only. No AI calls, no Lumiverse connection, no saved data.</p><button id="reopen">Open KazzWare</button><select id="switch" aria-label="Sample chat"><option value="demo-chat">Blackwater</option><option value="other-chat">The last train</option><option value="">No active chat</option></select><button id="restart">Reset preview</button></aside><div id="stage"></div><script type="module">${body.replaceAll('</script', '<\\/script')}</script></body></html>`);
console.log(`Preview written to ${destination}`);
