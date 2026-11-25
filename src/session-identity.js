'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MOPSessionIdentity=api;})(globalThis,()=>({
  describe(account,receipt){
    if(!account?.userId)return null;
    const assumed=receipt?.receipt_user_id===account.userId;
    return {name:account.display_name||account.username||'Usuário',username:account.username?'@'+account.username:'',role:({admin:'Administrador',supervisor:'Supervisor',operator:'Operador',viewer:'Visualizador'})[account.role]||'Usuário',assumed,shift:assumed?'Turno atual':'Turno não assumido'};
  }
}));
