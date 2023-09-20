import express from 'express';
const https = require('https');
const path = require('path');
const parse = require("co-body");
const cookieParser = require('cookie-parser')
// const bodyParser = require('body-parser');
const Database = require("@replit/database")
const db = new Database()

const frontendDir = path.resolve(__dirname)+"/frontend";
const rootDir = path.resolve(__dirname)+"/";
const app = express();
const port = 3000;
let keepAliveStatus = new Map();

app.get('/', (req:any, res:any) => {
  res.sendFile(frontendDir+'/index.html')
})

app.get('/callback', (req:any, res:any) => {
  res.sendFile(frontendDir+'/callback.html')
})

app.get('/pagetwo', (req:any, res:any) => {
  res.sendFile(frontendDir+'/pagetwo.html')
})

app.get("*/nodemodules/*", (req:any, res:any) => {
  // no long requests!
  if (req.url.length > 500) res.sendFile(frontendDir+"/404.html");
  else res.sendFile(rootDir+"node_modules"+req.url.replace(/.*nodemodules/, ""));
})

app.use(new cookieParser());

app.post('/server', async (req:any, res:any) => {

  var body = await parse.json(req);
  if (!body) res.end(JSON.stringify({status:"ERROR", data:{error:"No command string"}}));

  if (body.action == "cookieRequest") {
    res.end(JSON.stringify({data:req.cookies.acceptedQ??false}))
    return;
  }
  if (body.action == "acceptCookies") {
    res.cookie('acceptedQ', true, {httpOnly: true, secure:true, sameSite:"Strict"})
    res.end(JSON.stringify(""));
    return;
  }
  switch(body.action) 
  {
    case 'keepAlive':
      res.end(JSON.stringify({status:"SUCCESS", data:null}));
      break;
    case '60000ms':
      res.end(JSON.stringify({status:"SUCCESS", data:Date.now()+60000}));
      break;
    case 'getStatus':
      // console.log(getStatus());
      // res.end(JSON.stringify({status:"ERROR", data:{error:"KeepAlive"}, token:null}));
      res.end(JSON.stringify({status:"SUCCESS", data:await getStatus()}));
      break;
    default:
      res.end(JSON.stringify({status:"ERROR", data:{error:"KeepAlive"}}));
      break;
  }
})

app.listen(port, () => {
  console.log(`BetaOS KeepAlive listening on port ${port}`)
})

const PINGTIME = 60000;
let lastping = Date.now();
async function keepAlive() 
{
  console.log(Date.now() - lastping);
  lastping = Date.now();
  // await db.set("betatester1024.repl.co", "1");
  // await db.set("unstable.betatester1024.repl.co", "1");
  // await db.set("keepalive2.betatester1024.repl.co", "1");
  let allLinks = await db.list();
  for (let i=0; i<allLinks.length; i++ ) 
  {
    let pingingLinkQ = Number(await db.get(allLinks[i]))>0;
    if (keepAliveStatus.get(allLinks[i]) == undefined
     || pingingLinkQ != keepAliveStatus.get(allLinks[i]).pinging) 
    {
      keepAliveStatus.set(allLinks[i], {pinging:pingingLinkQ, status:pingingLinkQ?"Unknown":"Offline", 
                                        lastTime:-1, nextPing:pingingLinkQ?Date.now()+PINGTIME:-1});
    }
    if (pingingLinkQ) 
    {
      let time = Date.now();
      https.get("https://"+allLinks[i], (res:any) => {
        let data = [];
        const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
        console.log('Sent request to', allLinks[i], 
                    'in ',Date.now()-time,'ms with status code', res.statusCode);
        keepAliveStatus.set(allLinks[i], {pinging:true, status:res.statusCode,
                                         lastTime:Date.now()-time, nextPing:Date.now()+PINGTIME})
      }).on('error', (err:any) => {
        console.log('Error: ', err.message);
        keepAliveStatus.set(allLinks[i], {pinging:true, status:"Error: "+err.message,
                                         lastTime:-1, nextPing:Date.now()+PINGTIME})
      });
      // console.log(allLinks[i], "being pinged now");
    }
  }
  getStatus();
}

async function getStatus() {
  let out:{name:string, status:any}[] = [];
  keepAliveStatus.forEach((value:any, key:string)=>{
    out.push({name:key, status:value});
  })
  // console.log(out);
  return out;
}

setInterval(keepAlive, PINGTIME);
keepAlive();