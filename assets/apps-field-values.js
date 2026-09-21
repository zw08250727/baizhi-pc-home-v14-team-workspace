/* Shared fixture field contract. Production definitions come from the App Manifest. */
window.AppsFieldValues = (() => {
  const inputType=type=>({'日期':'date','日期时间':'datetime-local','整数':'number','数值':'number'}[type]||'text');
  const raw=value=>value==null?'':typeof value==='object'?JSON.stringify(value,null,2):String(value);
  function parse(field,value){
    const [name,type,config={}]=field,text=raw(value).trim();
    if(!text){if(config.required)throw Error(`请填写${name}`);return null;}
    if(type==='整数'){const n=Number(text);if(!/^[+-]?\d+$/.test(text)||!Number.isSafeInteger(n))throw Error('请输入安全范围内的整数');return n;}
    if(type==='数值'){const n=Number(text);if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)||!Number.isFinite(n))throw Error('请输入有效数字');
      const canonical=s=>{let sign=s[0]==='-'?'-':'';s=s.replace(/^[+-]/,'');let [whole,frac='']=s.split('.');whole=(whole||'0').replace(/^0+(?=\d)/,'');frac=frac.replace(/0+$/,'');return (Number(s)===0?'':sign)+whole+(frac?'.'+frac:'');};
      if(canonical(String(n))!==canonical(text))throw Error('数值精度超出当前支持范围');return n;}
    if(type==='布尔'){if(text==='true'||text==='false')return text==='true';throw Error('请选择是或否');}
    if(type==='日期'||type==='日期时间'){
      const date=text.slice(0,10),valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
      if(!valid||(type==='日期'&&text!==date)||(type==='日期时间'&&!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)))throw Error('请输入有效的'+type);
      return text;
    }
    if(type==='UUID'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text))throw Error('请输入有效 UUID');
    if(type==='JSON'){try{return JSON.parse(text);}catch{throw Error('请输入有效 JSON，例如 {"渠道":"电话"}');}}
    return text;
  }
  return {inputType,raw,parse};
})();
