export function requestContext(request,route){
  return {
    route,
    requestId:request?.headers?.get('x-vercel-id')||request?.headers?.get('x-request-id')||crypto.randomUUID(),
    deployment:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||'local'
  };
}

export function logInfo(message,context={}){
  console.log(JSON.stringify({level:'info',message,...context}));
}

export function logError(message,error,context={}){
  console.error(JSON.stringify({
    level:'error',message,...context,
    error:error instanceof Error?error.message:String(error)
  }));
}
