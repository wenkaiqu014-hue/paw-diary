const fail=code=>Object.assign(new Error(code),{code});

// Node SDK getSession returns cached user data, even immediately after setSession.
// Refresh the profile first, then take the bearer produced by that current session.
export async function collectVerifiedSession({auth,config,label,serverCall,fetchProfile=fetch}){
 const fresh=await auth.getUser(true),user=fresh?.data?.user;
 const reply=await auth.getSession(),session=reply?.data?.session;
 if(fresh?.error||reply?.error||typeof session?.access_token!=='string'||typeof session?.refresh_token!=='string'||!session.access_token||!session.refresh_token)throw fail('ACCEPTANCE_SESSION_INVALID');
 const response=await fetchProfile(`https://${config.env}.api.tcloudbasegateway.com/auth/v1/user/me`,{headers:{Authorization:`Bearer ${session.access_token}`},redirect:'error'});
 if(!response.ok)throw fail('ACCEPTANCE_PROFILE_READ_FAILED');
 const raw=await response.json(),anonymous=label==='anonymous';
 if(typeof user?.id!=='string'||!user.id||user.id!==(raw?.sub??raw?.uid??raw?.id))throw fail('ACCEPTANCE_IDENTITY_MISMATCH');
 const proof=anonymous?null:await serverCall('auth.session',{},session.access_token);
 if(anonymous?user.is_anonymous!==true:user.is_anonymous!==false||proof?.principal?.userId!==user.id||typeof raw.email!=='string'||!raw.email)throw fail('ACCEPTANCE_IDENTITY_NOT_VERIFIED');
 return {session:{access_token:session.access_token,refresh_token:session.refresh_token},emailVerified:!anonymous,isAnonymous:anonymous};
}
