/** A self-contained preview of the shipped frontend. No Lumiverse or provider requests. */
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { emptyState } from '../src/shared';

const destination = resolve(process.argv[2] || '../KazzWare-preview.html');
const frontend = `data:text/javascript;base64,${Buffer.from(await Bun.file('dist/frontend.js').arrayBuffer()).toString('base64')}`;
const state = emptyState();
state.settings.slop = ['pale orbs', 'a shiver down', 'a dance of'];
state.settings.connectionId = 'demo';
state.settings.galleryEnabled = true;
state.turns = [
  { role: 'user', at: Date.UTC(2026, 9, 24), content: 'What did we establish about the lighthouse?' },
  { role: 'assistant', at: Date.UTC(2026, 9, 24), content: 'Three things: the light turns inland at midnight, Elias has the only key, and somebody keeps replacing the broken glass.\n\nThat last bit? Suspicious as hell. Want me to put it in the notebook?' },
];
state.pages = ['forum', 'thread', 'wiki'].map((format, i) => ({ id: `page-${i}`, format: format as 'forum' | 'thread' | 'wiki', title: ['AITA for keeping the lighthouse key?', 'The Elias defense squad is in shambles', 'Blackwater lighthouse'][i], createdAt: Date.UTC(2026, 9, 24), throughMessage: ['m1', 'm3', 'm5'][i], votes: [], comments: [], posts: [
  { id: `post-${i}-1`, author: ['u/definitely_not_elias', '@unreliable_narrator', 'The Midnight Archives'][i], title: ['I was keeping them safe. Mostly.', 'Your fave is a walking red flag.', 'The light that looks back'][i], body: 'He says the locked door is for our protection. He also has the only key. I am connecting some extremely inconvenient dots here.' },
  { id: `post-${i}-2`, author: 'moth_to_a_bad_idea', title: 'Okay, but hear me out.', body: 'The fog has better communication skills than this man. Still rooting for him, unfortunately.' },
] }));
state.summaries = [{ id: 'summary', text: 'The light turns inland at midnight. Elias keeps the only key. The broken panes are repaired by an unknown visitor.', messages: 24, throughMessage: 'm1', createdAt: Date.UTC(2026, 9, 24) }];
const script = String.raw`
const { setup } = await import(FRONTEND_URL);
const state = INITIAL_STATE;
const messages = [{id:'m1',content:'The lighthouse turned its pale eye toward the shore. Elias closed his hand around the key.\n\n"Not tonight," he said. The light found them anyway.',name:'Elias',is_user:false,swipe_id:0,index_in_chat:0}];
messages.push(
  {id:'m2',content:'I stopped at the foot of the stairs. \"You said the light was broken.\"',name:'You',is_user:true,swipe_id:0,index_in_chat:1},
  {id:'m3',content:'Elias looked past me at the window. The beam turned inland again.\n\n\"It is.\" He said it too quietly. Something scraped along the floor above us, slow enough to count.\n\nI watched his hand close around the key.',name:'Elias',is_user:false,swipe_id:0,index_in_chat:2},
  {id:'m4',content:'I held out my hand. \"Give me the key.\"',name:'You',is_user:true,swipe_id:0,index_in_chat:3},
  {id:'m5',content:'For a moment he almost did. Then the scraping stopped.\n\nThree knocks came from the other side of the door. Elias stepped in front of it. \"Whatever you hear, let me answer.\"',name:'Elias',is_user:false,swipe_id:0,index_in_chat:4}
);
let chatId = 'demo-chat', stateListener = () => {}, backendListener = () => {}, inputClick = () => {};
const host = document.querySelector('#stage');
const story = document.querySelector('#story');
const injections = new Map();
function drawStory(){story.replaceChildren(...messages.map(m=>{
  const article=document.createElement('article');article.dataset.previewMessage=m.id;
  const title=document.createElement('h2');title.textContent=m.name+' / '+(m.index_in_chat+1);
  const prose=document.createElement('p');prose.textContent=m.content;
  const action=document.createElement('button');action.textContent='Native action '+(m.index_in_chat+1);action.onclick=()=>{document.querySelector('#native-result').textContent='Native action '+(m.index_in_chat+1)+' clicked'};
  article.append(title,prose,action); for(const [wrapper,id] of injections) if(id===m.id) article.append(wrapper); return article;
}));}
drawStory();
function view(){return {chatName:chatId === 'other-chat' ? 'The last train / sample chat' : 'Blackwater / sample chat',messages,totalMessages:messages.length,connections:[{id:'demo',name:'Sample connection',model:'Preview only'}],state};}
function reply(req,result){queueMicrotask(() => backendListener({...req,ok:true,result}));}
const ctx = {
  deferReady(){},ready(){},
  state:{get(){return {chatId}},subscribe(key,fn){stateListener=fn;return ()=>{}}},
  events:{on(){return ()=>{}}},
  onBackendMessage(fn){backendListener=fn;return ()=>{}},
  sendToBackend(req){
    if(req.action === 'message') return reply(req,messages.find(m=>m.id===req.data.messageId));
    if(req.action === 'page') return reply(req,state.pages.find(p=>p.id===req.data.pageId));
    if(req.action === 'summaryContent') return reply(req,state.summaries[0].text);
    if(req.action === 'settings') state.settings = req.data.settings;
    if(req.action === 'react') {const page=state.pages.find(p=>p.id===req.data.pageId);if(req.data.kind==='vote'){page.votes=page.votes.includes(req.data.postId)?page.votes.filter(id=>id!==req.data.postId):[...page.votes,req.data.postId]}else page.comments.push({id:String(Date.now()),postId:req.data.postId,author:'You',body:req.data.text});}
    if(req.action === 'ask') state.turns.push({role:'user',content:req.data.text},{role:'assistant',content:'Preview mode, boss. The real me uses your chosen connection. These demo messages stay in this page.'});
    if(req.action === 'edit') {const message=messages.find(m=>m.id===req.data.messageId),before=message.content, replacement='The light swept ashore. Elias gripped the key. "Not tonight." It found them anyway.';const r=req.data.range;const after=r?before.slice(0,r.start)+'the edited selection'+before.slice(r.end):replacement;state.undo.push({id:String(Date.now()),messageId:message.id,label:'Preview edit',before,after,swipe:0,createdAt:Date.now(),status:'applied'});message.content=after;drawStory();}
    if(req.action === 'undo'){const u=state.undo.find(u=>u.id===req.data.undoId);messages.find(m=>m.id===u.messageId).content=u.before;u.status='undone';drawStory();}
    if(req.action==='summary') state.summaries.push({...state.summaries[0],id:String(Date.now())});
    if(req.action==='lorebook') state.lorebooks.push({id:'demo-book',name:'Blackwater / preview lorebook'});
    reply(req,view());
  },
  ui:{
    createFloatWidget(options){
      const wrap=document.createElement('div');wrap.className=options.width===110?'pet-wrap':'panel-wrap';const content=document.createElement('div');content.className='widget-content';const root=document.createElement('div');content.append(root);wrap.append(content);host.append(wrap);
      let position={...options.initialPosition}; const move=(x,y)=>{x=Math.max(8,Math.min(x,innerWidth-parseFloat(wrap.style.width||'110')-8));y=Math.max(8,Math.min(y,innerHeight-parseFloat(wrap.style.height||'110')-8));position={x,y};wrap.style.left=x+'px';wrap.style.top=y+'px';wrap.style.right='auto';wrap.style.bottom='auto'};move(position.x,position.y);
      const size=(w,h)=>{wrap.style.width=w+'px';wrap.style.height=h+'px'};size(options.width,options.height);const clamp=()=>move(position.x,position.y);window.addEventListener('resize',clamp);clamp();
      return {root,setVisible(v){wrap.hidden=!v},setSize:size,setFullscreen(v){wrap.classList.toggle('fullscreen',v);if(v){wrap.style.width='100%';wrap.style.height='100dvh'}},getPosition(){return position},moveTo:move,destroy(){window.removeEventListener('resize',clamp);wrap.remove()}};
    },
    registerInputBarAction(){return {onClick(fn){inputClick=fn;return ()=>{}},setEnabled(){},destroy(){}}}
  },
  registerMessageAction(){return {destroy(){}}},
  dom:{createElement(tag){return document.createElement(tag)},inject(target,html){const wrapper=document.createElement('div');wrapper.innerHTML=html;target.append(wrapper);injections.set(wrapper,target.dataset.previewMessage);return wrapper},uninject(wrapper){injections.delete(wrapper);wrapper.remove()},getMessageId(el){return el.closest('[data-preview-message]')?.dataset.previewMessage??null},findMessageElement(id){return Array.from(story.children).find(el=>el.dataset.previewMessage===id)??null},listMessageElements(){return Array.from(story.children).map(element=>({messageId:element.dataset.previewMessage,element}))},createSandboxFrame({html,initialHeight}){
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
await Bun.write(destination, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KazzWare / Floating companion preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#24292e;background-image:linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px);background-size:32px 32px;color:#d7e0e5;font:13px/1.5 system-ui,sans-serif}.preview-tools{position:fixed;left:28px;top:30px;width:225px;padding:18px;border:1px solid #71818a;background:#13191e}.preview-tools h1{font-size:22px;margin:0 0 10px}.preview-tools p{color:#afbfc8}.preview-tools button,.preview-tools select{display:block;width:100%;padding:10px;margin-top:10px;color:#eaf2f6;background:#26353f;border:1px solid #657d8b;border-radius:4px}.panel-wrap{position:fixed;right:26px;top:12px;max-height:calc(100dvh - 24px)}.pet-wrap{position:fixed;bottom:20px;left:275px}.panel-wrap.fullscreen{inset:0;max-height:100dvh;z-index:2}.widget-content{width:100%;height:100%;pointer-events:auto}.story-shell{position:fixed;left:280px;top:30px;bottom:25px;right:28px;display:flex;flex-direction:column;background:#101319;border:1px solid #3c444e;border-radius:12px}.story-shell>header{padding:15px 22px;border-bottom:1px solid #343a43;color:#869ca9;font:10px monospace}.story-shell output{display:block;color:#bce9f3;margin-top:4px}#story{overflow:auto;flex:1;min-height:0;padding:24px;scrollbar-width:thin}#story article{margin:0 0 28px;padding:24px;border:1px solid #363f4c;border-left:3px solid #777fa7;border-radius:8px;background:#181d24;max-width:700px}#story h2{font-size:13px;color:#bcbcd6;margin:0 0 18px}#story p{white-space:pre-wrap;font:16px/1.8 Georgia,serif;max-width:560px;color:#c7cbd0}#story button{padding:6px 9px;background:#252c36;color:#b9c6d2;border:1px solid #4b5562;font-size:10px;margin-top:16px}.native-composer{padding:15px 22px;border-top:1px solid #3c444e}.native-composer input{background:#202630;color:#eee;padding:12px;width:100%;border:1px solid #52606c;border-radius:7px}.pet-wrap[hidden],.panel-wrap[hidden]{display:none}@media(max-width:900px){.story-shell{left:16px;right:16px;top:150px}.preview-tools{position:relative;left:16px;top:10px;width:calc(100% - 32px);padding:10px;display:flex;gap:8px;align-items:center}.preview-tools h1{font-size:14px;white-space:nowrap}.preview-tools p{display:none}.preview-tools button,.preview-tools select{font-size:10px;padding:8px;margin:0}.pet-wrap{left:auto;right:12px}}@media(max-width:600px){.story-shell{inset:110px 6px 8px}.preview-tools{left:12px;top:12px;width:calc(100% - 24px)}.pet-wrap{left:auto;right:20px;bottom:30px;z-index:1}}
</style></head><body><aside class="preview-tools"><h1>KazzWare 0.4.0</h1><p>Interactive UI preview. Sample story only. Scroll the chat to test Follow view. Highlight native prose for a quick edit. Open fandom pages beneath messages. Drag Kazz or the menu title. No AI calls or saved data.</p><button id="reopen">Open KazzWare</button><select id="switch" aria-label="Sample chat"><option value="demo-chat">Blackwater</option><option value="other-chat">The last train</option><option value="">No active chat</option></select><button id="restart">Reset preview</button></aside><section class="story-shell"><header>BLACKWATER / SAMPLE CHAT <output id="native-result" aria-live="polite"></output></header><div id="story" tabindex="0" aria-label="Native chat preview"></div><div class="native-composer"><input placeholder="Native chat input · click-through test" aria-label="Native chat input"></div></section><div id="stage"></div><script type="module">${body.replaceAll('</script', '<\\/script')}</script></body></html>`);
console.log(`Preview written to ${destination}`);
