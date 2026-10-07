// An SDK request can rotate credentials before its later business step fails.
export async function withSessionCheckpoint(operation,checkpoint){
 let value,operationError;
 try{value=await operation();}catch(error){operationError=error;}
 try{await checkpoint();}catch(error){throw Object.assign(new Error('Session checkpoint failed'),{code:'REAL_CLOUD_SESSION_CHECKPOINT_FAILED',cause:error});}
 if(operationError)throw operationError;
 return value;
}
