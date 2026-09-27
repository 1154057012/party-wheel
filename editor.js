(() => {
  'use strict';
  const store=window.partyQuestionStore;
  const $=id=>document.getElementById(id);
  const entry=$('editor-entry'),passwordDialog=$('password-dialog'),editor=$('editor-dialog'),confirmDialog=$('confirm-dialog');
  const list=$('question-list'),category=$('editor-category'),level=$('editor-level'),search=$('editor-search');
  let taps=[],draft=null,dirty=false,confirmAction=null,confirmationReturnFocus=null;
  const pool=()=>draft[category.value][level.value];
  const message=(text,error=true)=>{
    $('editor-message').textContent=text;
    $('editor-message').classList.toggle('success',!error);
  };
  function setDirty(value){
    dirty=value;
    $('editor-save-state').textContent=value?'有未保存的修改':'已保存到当前浏览器';
    message('');
  }
  function ask(title,copy,action,button='确认'){
    confirmationReturnFocus=document.activeElement;
    $('confirm-title').textContent=title;$('confirm-copy').textContent=copy;$('confirm-ok').textContent=button;
    confirmAction=action;confirmDialog.showModal();$('confirm-cancel').focus();
  }
  function dismissConfirmation(){
    confirmDialog.close();confirmAction=null;
    if(confirmationReturnFocus?.isConnected)confirmationReturnFocus.focus();
  }
  $('confirm-cancel').addEventListener('click',dismissConfirmation);
  confirmDialog.addEventListener('cancel',event=>{event.preventDefault();dismissConfirmation();});
  $('confirm-ok').addEventListener('click',()=>{
    const action=confirmAction;dismissConfirmation();if(action)action();
  });
  function updateCount(visible){
    const count=pool().length;
    $('editor-count').textContent=visible===count?`共 ${count} 道题`:`找到 ${visible} 道 · 共 ${count} 道题`;
    $('add-question').disabled=count>=200;
  }
  function renderList(focusIndex){
    list.replaceChildren();
    const query=search.value.trim().toLowerCase();
    let visible=0;
    pool().forEach((item,index)=>{
      const number=String(index+1).padStart(3,'0');
      if(query&&!`${number} ${index+1} ${item.text}`.toLowerCase().includes(query))return;
      visible++;
      const row=document.createElement('div');row.className='question-row';row.dataset.index=index;
      const badge=document.createElement('span');badge.className='edit-number';badge.textContent=number;
      const textWrap=document.createElement('label');textWrap.className='full-question';textWrap.textContent='完整题目';
      const textInput=document.createElement('textarea');textInput.rows=2;textInput.value=item.text;textInput.dataset.field='text';textInput.maxLength=80;
      textInput.setAttribute('aria-label',`第 ${index+1} 题完整内容，最多 40 字`);textInput.placeholder='最多 40 字';
      textWrap.append(textInput);
      const remove=document.createElement('button');remove.type='button';remove.className='delete-question';remove.dataset.action='delete';remove.textContent='删除';remove.setAttribute('aria-label',`删除第 ${index+1} 题`);
      row.append(badge,textWrap,remove);list.append(row);
    });
    if(!visible){const empty=document.createElement('p');empty.className='editor-empty';empty.textContent=pool().length?'没有匹配的题目，换个关键词试试。':'这里还没有题目，点击「新增题目」开始。';list.append(empty);}
    updateCount(visible);
    if(focusIndex!==undefined){const input=list.querySelector(`[data-index="${focusIndex}"] textarea`);if(input){input.focus();input.scrollIntoView({block:'nearest'});}}
  }
  list.addEventListener('input',event=>{
    const field=event.target.dataset.field,row=event.target.closest('.question-row');
    if(!row||field!=='text')return;
    pool()[Number(row.dataset.index)][field]=event.target.value;
    const max=40,count=[...event.target.value.trim()].length;
    event.target.setAttribute('aria-invalid',String(count===0||count>max));
    setDirty(true);
  });
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-action="delete"]');if(!button)return;
    const index=Number(button.closest('.question-row').dataset.index);
    ask(`删除第 ${index+1} 道题？`,'删除后仍需点击「保存并应用」才会更新转盘。',()=>{
      pool().splice(index,1);setDirty(true);renderList();$('add-question').focus();
    },'删除题目');
  });
  category.addEventListener('change',()=>{search.value='';renderList();list.scrollTop=0;});
  level.addEventListener('change',()=>{search.value='';renderList();list.scrollTop=0;});
  search.addEventListener('input',()=>renderList());
  $('add-question').addEventListener('click',()=>{
    if(pool().length>=200)return;
    pool().push({text:'',type:category.value});search.value='';setDirty(true);renderList(pool().length-1);
  });
  function openEditor(){
    draft=store.getDraft();dirty=false;
    category.value=document.querySelector('.category.active').dataset.category==='dare'?'dare':'truth';
    level.value=document.querySelector('.level.active').dataset.level;
    search.value='';$('editor-save-state').textContent='尚未修改';message('');
    $('storage-warning').textContent=store.getWarning();$('storage-warning').hidden=!store.getWarning();
    renderList();editor.showModal();list.scrollTop=0;category.focus();
  }
  function closeEditor(){editor.close();draft=null;dirty=false;entry.focus();}
  function requestClose(){
    if(dirty)ask('放弃未保存的修改？','关闭后，本次未保存的编辑会丢失。',closeEditor,'放弃并关闭');
    else closeEditor();
  }
  $('editor-close').addEventListener('click',requestClose);
  editor.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  $('save-questions').addEventListener('click',()=>{
    try{
      store.save(draft);draft=store.getDraft();setDirty(false);
      $('storage-warning').hidden=true;
      document.dispatchEvent(new CustomEvent('questions-saved'));
      renderList();message('已保存，转盘已更新；刷新页面后仍会保留。',false);
    }catch(error){message(error.message||'保存失败，请重试。');}
  });
  $('export-backup').addEventListener('click',()=>{
    try{
      const blob=new Blob([store.exportBackup(draft)],{type:'application/json'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`微醺题库-${new Date().toISOString().slice(0,10)}.json`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      message(dirty?'已导出当前编辑内容；浏览器中的修改仍需保存。':'题库备份已导出。',false);
    }catch(error){message(error.message);}
  });
  $('import-backup').addEventListener('click',()=>$('backup-file').click());
  $('backup-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
      if(file.size>1024*1024)throw new Error('备份文件过大，请选择小于 1 MB 的题库 JSON。');
      const imported=QuestionStore.parseBackup(await file.text());
      if(!editor.open)return;
      ask('导入这份题库？','将替换编辑面板中的全部六套题库。点击「保存并应用」后才会影响转盘。',()=>{
        draft=imported;search.value='';setDirty(true);renderList();message('备份已载入，请检查后保存。',false);
      },'导入题库');
    }catch(error){if(editor.open)message(error.message||'无法读取备份文件。');}
  });
  entry.addEventListener('click',()=>{
    if(document.querySelector('dialog[open]')||document.querySelector('#spin-button').dataset.state!=='idle'){taps=[];return;}
    const now=performance.now();taps=taps.filter(time=>now-time<=3000);taps.push(now);
    if(taps.length<4)return;
    taps=[];$('editor-password').value='';$('password-error').textContent='';passwordDialog.showModal();$('editor-password').focus();
  });
  $('password-close').addEventListener('click',()=>passwordDialog.close());
  $('password-form').addEventListener('submit',event=>{
    event.preventDefault();
    if($('editor-password').value!=='112211'){$('password-error').textContent='密码不正确，请重新输入。';$('editor-password').select();return;}
    $('editor-password').value='';passwordDialog.close();openEditor();
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
})();
